import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "sellermate_session";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(email: string) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${email}|${expires}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [email, expiresRaw] = payload.split("|");
    const expires = Number(expiresRaw);
    if (!email || !expires || expires < Math.floor(Date.now() / 1000)) return null;
    return { email, expires };
  } catch {
    return null;
  }
}

export function sessionMaxAge() {
  return MAX_AGE;
}
