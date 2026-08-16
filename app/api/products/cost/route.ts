import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const body = await request.json();
    const id = String(body.id ?? "");
    const cost = Number(body.cost ?? 0);
    if (!id || !Number.isFinite(cost) || cost < 0) return NextResponse.json({ ok: false, message: "Geçersiz ürün veya maliyet" }, { status: 400 });
    const sql = neon(dbUrl);
    await sql`UPDATE products SET cost=${cost} WHERE id=${id}`;
    await sql`UPDATE order_items oi SET cost_at_sale=${cost} FROM products p WHERE oi.product_id=p.id AND p.id=${id} AND oi.cost_at_sale=0`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Cost update failed" }, { status: 500 });
  }
}
