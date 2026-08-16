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
    await sql`CREATE TABLE IF NOT EXISTS product_cost_history (
      id bigserial PRIMARY KEY,
      product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_cost numeric(14,2) NOT NULL DEFAULT 0,
      new_cost numeric(14,2) NOT NULL DEFAULT 0,
      changed_at timestamptz NOT NULL DEFAULT now()
    )`;

    const current = await sql`SELECT cost FROM products WHERE id=${id} LIMIT 1`;
    if (!current.length) return NextResponse.json({ ok: false, message: "Ürün bulunamadı" }, { status: 404 });
    const oldCost = Number(current[0].cost || 0);

    await sql`UPDATE products SET cost=${cost} WHERE id=${id}`;
    if (oldCost !== cost) {
      await sql`INSERT INTO product_cost_history(product_id,old_cost,new_cost) VALUES(${id},${oldCost},${cost})`;
    }
    await sql`UPDATE order_items oi SET cost_at_sale=${cost} FROM products p WHERE oi.product_id=p.id AND p.id=${id} AND oi.cost_at_sale=0`;
    return NextResponse.json({ ok: true, oldCost, newCost: cost });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Cost update failed" }, { status: 500 });
  }
}
