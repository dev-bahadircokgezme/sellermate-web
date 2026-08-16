import { NextRequest, NextResponse } from "next/server";
import { ensureAuthTables, hashPassword, verifyPassword, verifySessionToken, SESSION_COOKIE } from "../../../../src/lib/auth";

export async function POST(req:NextRequest){
  try{
    const session=verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if(!session) return NextResponse.json({ok:false,message:"Oturum gerekli"},{status:401});
    const {currentPassword,newPassword}=await req.json();
    const next=String(newPassword??"");
    if(next.length<8) return NextResponse.json({ok:false,message:"Yeni şifre en az 8 karakter olmalı"},{status:400});
    const sql=await ensureAuthTables();
    const rows=await sql`SELECT id,password_hash FROM app_users WHERE lower(email)=lower(${session.email}) AND active=true LIMIT 1`;
    if(!rows.length) return NextResponse.json({ok:false,message:"Kullanıcı bulunamadı"},{status:404});
    const user=rows[0] as any;
    if(!verifyPassword(String(currentPassword??""),String(user.password_hash))) return NextResponse.json({ok:false,message:"Mevcut şifre hatalı"},{status:400});
    await sql`UPDATE app_users SET password_hash=${hashPassword(next)} WHERE id=${String(user.id)}`;
    return NextResponse.json({ok:true,message:"Şifreniz güncellendi"});
  }catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Şifre değiştirilemedi"},{status:500});}
}
