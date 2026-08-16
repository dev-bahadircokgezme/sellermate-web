import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { neon } from "@neondatabase/serverless";

export const SESSION_COOKIE = "sellermate_session";
const MAX_AGE = 60 * 60 * 12;
export type UserRole = "ADMIN" | "OPERATIONS" | "FINANCE" | "VIEWER";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(email: string, role: UserRole = "ADMIN") {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${email}|${expires}|${role}`;
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
    const [email, expiresRaw, rawRole] = payload.split("|");
    const expires = Number(expiresRaw);
    if (!email || !expires || expires < Math.floor(Date.now() / 1000)) return null;
    const role = (rawRole || "ADMIN") as UserRole;
    return { email, expires, role };
  } catch { return null; }
}

export function sessionMaxAge() { return MAX_AGE; }

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  try {
    const [salt, hash] = stored.split(":");
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch { return false; }
}

export async function ensureAuthTables() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS app_users (
    id text PRIMARY KEY,
    company_id text NOT NULL DEFAULT 'default-company',
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'VIEWER',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`;
  await sql`CREATE TABLE IF NOT EXISTS team_invites (
    id text PRIMARY KEY,
    company_id text NOT NULL DEFAULT 'default-company',
    email text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  return sql;
}

export function inviteTokenHash(token: string) {
  return createHmac("sha256", secret()).update(`invite:${token}`).digest("hex");
}
