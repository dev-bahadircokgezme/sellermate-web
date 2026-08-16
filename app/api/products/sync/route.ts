import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT barcode, MAX(product_name) AS name
      FROM order_items
      WHERE COALESCE(barcode,'') <> ''
      GROUP BY barcode
      ORDER BY MAX(product_name)
    `;
    let synced = 0;
    for (const row of rows) {
      const barcode = String(row.barcode);
      const id = `prd-${createHash("sha1").update(barcode).digest("hex")}`;
      await sql`
        INSERT INTO products (id, company_id, barcode, name, cost, stock)
        VALUES (${id}, 'default-company', ${barcode}, ${String(row.name ?? "Ürün")}, 0, 0)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, barcode=EXCLUDED.barcode
      `;
      await sql`UPDATE order_items SET product_id=${id} WHERE barcode=${barcode}`;
      synced++;
    }
    return NextResponse.json({ ok: true, synced, message: `${synced} ürün SellerMate ürün kataloğuna aktarıldı` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Product sync failed" }, { status: 500 });
  }
}
