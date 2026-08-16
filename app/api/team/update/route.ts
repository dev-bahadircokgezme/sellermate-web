import { NextRequest, NextResponse } from "next/server";
import { ensureAuthTables, hashPassword, verifySessionToken, SESSION_COOKIE } from "../../../../src/lib/auth";

export async function POST(req:NextRequest){
  try{
    const session=verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if(!session || session.role!=="ADMIN") return NextResponse.json({ok:false,message:"Yetkiniz yok"},{status:403});
    const {id,action,password}=await req.json();
    const userId=String(id??"");
    if(!userId) return NextResponse.json({ok:false,message:"Kullanıcı seçilmedi"},{status:400});
    const sql=await ensureAuthTables();
    const rows=await sql`SELECT id,email,active FROM app_users WHERE id=${userId} LIMIT 1`;
    if(!rows.length) return NextResponse.json({ok:false,message:"Kullanıcı bulunamadı"},{status:404});
    const user=rows[0] as any;
    if(action==="toggle-active"){
      if(String(user.email).toLowerCase()===session.email.toLowerCase() && user.active) return NextResponse.json({ok:false,message:"Kendi yönetici hesabınızı pasife alamazsınız"},{status:400});
      await sql`UPDATE app_users SET active=${!user.active} WHERE id=${userId}`;
      return NextResponse.json({ok:true,message:user.active?"Kullanıcı pasife alındı":"Kullanıcı yeniden aktifleştirildi"});
    }
    if(action==="reset-password"){
      const clean=String(password??"");
      if(clean.length<8) return NextResponse.json({ok:false,message:"Yeni şifre en az 8 karakter olmalı"},{status:400});
      await sql`UPDATE app_users SET password_hash=${hashPassword(clean)} WHERE id=${userId}`;
      return NextResponse.json({ok:true,message:"Kullanıcının şifresi güncellendi"});
    }
    return NextResponse.json({ok:false,message:"Geçersiz işlem"},{status:400});
  }catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"İşlem başarısız"},{status:500});}
}
