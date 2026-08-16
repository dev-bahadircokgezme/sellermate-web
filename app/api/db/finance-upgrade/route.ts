import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const sql = neon(dbUrl);
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS commission_amount numeric(14,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS seller_revenue numeric(14,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS payment_order_id text`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS order_number text`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS barcode text`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS raw_type text`;
    return NextResponse.json({ ok: true, message: "Finans veri modeli güncellendi" });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Finance schema upgrade failed" }, { status: 500 });
  }
}
