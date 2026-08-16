import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureAuthTables, hashPassword } from "../../../../src/lib/auth";

export async function POST(req:NextRequest){
  try{
    const {email,name,role,password}=await req.json();
    const cleanEmail=String(email??"").trim().toLowerCase();
    const cleanName=String(name??"").trim();
    const cleanRole=String(role??"VIEWER");
    const cleanPassword=String(password??"");
    if(!cleanEmail||!cleanName||cleanPassword.length<8||!["ADMIN","OPERATIONS","FINANCE","VIEWER"].includes(cleanRole)) return NextResponse.json({ok:false,message:"Bilgileri kontrol et. Şifre en az 8 karakter olmalı."},{status:400});
    const sql=await ensureAuthTables();
    const existing=await sql`SELECT id FROM app_users WHERE lower(email)=lower(${cleanEmail}) LIMIT 1`;
    if(existing.length) return NextResponse.json({ok:false,message:"Bu e-posta zaten ekipte"},{status:409});
    const id=`usr-${randomBytes(10).toString("hex")}`;
    await sql`INSERT INTO app_users(id,email,name,password_hash,role,active) VALUES(${id},${cleanEmail},${cleanName},${hashPassword(cleanPassword)},${cleanRole},true)`;
    return NextResponse.json({ok:true,message:"Ekip üyesi oluşturuldu"});
  }catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Ekip üyesi oluşturulamadı"},{status:500});}
}
