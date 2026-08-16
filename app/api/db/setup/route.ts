import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    const sql = neon(url);
    await sql`CREATE TABLE IF NOT EXISTS companies (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS marketplace_accounts (id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id), marketplace text NOT NULL, seller_id text, display_name text, active boolean NOT NULL DEFAULT true, last_sync_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id), barcode text, sku text, name text NOT NULL, cost numeric(14,2) NOT NULL DEFAULT 0, stock integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id), marketplace_account_id text NOT NULL REFERENCES marketplace_accounts(id), marketplace_order_number text NOT NULL UNIQUE, status text NOT NULL, gross_amount numeric(14,2) NOT NULL DEFAULT 0, ordered_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS order_items (id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id text REFERENCES products(id), barcode text, product_name text NOT NULL, quantity integer NOT NULL, unit_price numeric(14,2) NOT NULL, cost_at_sale numeric(14,2) NOT NULL DEFAULT 0)`;
    await sql`CREATE TABLE IF NOT EXISTS financial_transactions (id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id), marketplace_account_id text NOT NULL REFERENCES marketplace_accounts(id), order_id text REFERENCES orders(id), type text NOT NULL, amount numeric(14,2) NOT NULL, description text, transaction_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`INSERT INTO companies (id,name) VALUES ('default-company','SellerMate') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO marketplace_accounts (id,company_id,marketplace,seller_id,display_name) VALUES ('trendyol-main','default-company','TRENDYOL',${process.env.TRENDYOL_SELLER_ID ?? ""},'Trendyol') ON CONFLICT (id) DO UPDATE SET seller_id=EXCLUDED.seller_id`;
    return NextResponse.json({ ok: true, message: "SellerMate veritabanı hazır" });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Database setup failed" }, { status: 500 });
  }
}
