import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionMaxAge, ensureAuthTables, hashPassword, verifyPassword, UserRole } from "../../../../src/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");
    if (!cleanEmail || !cleanPassword) return NextResponse.json({ ok:false, message:"E-posta ve şifre gerekli" }, { status:400 });

    const sql = await ensureAuthTables();
    const adminEmail = process.env.SELLERMATE_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SELLERMATE_ADMIN_PASSWORD;

    if (adminEmail && adminPassword && cleanEmail === adminEmail) {
      const existing = await sql`SELECT id FROM app_users WHERE email=${adminEmail} LIMIT 1`;
      if (!existing.length && cleanPassword === adminPassword) {
        await sql`INSERT INTO app_users(id,email,name,password_hash,role,active) VALUES ('admin-primary',${adminEmail},'Yönetici',${hashPassword(adminPassword)},'ADMIN',true)`;
      }
    }

    const users = await sql`SELECT id,email,password_hash,role,active FROM app_users WHERE lower(email)=lower(${cleanEmail}) LIMIT 1`;
    const user:any = users[0];
    if (!user || !user.active || !verifyPassword(cleanPassword, String(user.password_hash))) {
      return NextResponse.json({ ok:false, message:"E-posta veya şifre hatalı" }, { status:401 });
    }

    await sql`UPDATE app_users SET last_login_at=now() WHERE id=${String(user.id)}`;
    const response = NextResponse.json({ ok:true, role:user.role });
    response.cookies.set(SESSION_COOKIE, createSessionToken(String(user.email), String(user.role) as UserRole), { httpOnly:true, secure:true, sameSite:"lax", path:"/", maxAge:sessionMaxAge() });
    return response;
  } catch (error) {
    return NextResponse.json({ ok:false, message:error instanceof Error ? error.message : "Giriş işlemi başarısız" }, { status:400 });
  }
}
