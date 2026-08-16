import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionMaxAge } from "../../../../src/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const adminEmail = process.env.SELLERMATE_ADMIN_EMAIL;
    const adminPassword = process.env.SELLERMATE_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      return NextResponse.json({ ok: false, message: "Giriş bilgileri sunucuda tanımlı değil" }, { status: 500 });
    }
    if (String(email).trim().toLowerCase() !== adminEmail.trim().toLowerCase() || String(password) !== adminPassword) {
      return NextResponse.json({ ok: false, message: "E-posta veya şifre hatalı" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(adminEmail), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge(),
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Giriş işlemi başarısız" }, { status: 400 });
  }
}
