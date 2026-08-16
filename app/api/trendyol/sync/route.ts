import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getTrendyolOrders } from "../../../../src/lib/trendyol";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const sql = neon(dbUrl);
    const data = await getTrendyolOrders(100);
    const packages = Array.isArray(data?.content) ? data.content : [];
    let synced = 0;

    for (const pkg of packages) {
      const orderNumber = String(pkg.orderNumber ?? pkg.id ?? pkg.shipmentPackageId);
      const orderId = `ty-${orderNumber}`;
      const status = String(pkg.status ?? "UNKNOWN");
      const gross = Number(pkg.totalPrice ?? pkg.grossAmount ?? 0);
      const orderDateValue = Number(pkg.orderDate ?? pkg.createdDate ?? Date.now());
      const orderedAt = new Date(orderDateValue).toISOString();
      await sql`INSERT INTO orders (id, company_id, marketplace_account_id, marketplace_order_number, status, gross_amount, ordered_at, updated_at)
        VALUES (${orderId}, 'default-company', 'trendyol-main', ${orderNumber}, ${status}, ${gross}, ${orderedAt}, now())
        ON CONFLICT (marketplace_order_number) DO UPDATE SET status=EXCLUDED.status, gross_amount=EXCLUDED.gross_amount, updated_at=now()`;

      await sql`DELETE FROM order_items WHERE order_id=${orderId}`;
      const lines = Array.isArray(pkg.lines) ? pkg.lines : [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qty = Number(line.quantity ?? 1);
        const price = Number(line.price ?? line.amount ?? 0);
        await sql`INSERT INTO order_items (id, order_id, barcode, product_name, quantity, unit_price, cost_at_sale)
          VALUES (${`${orderId}-${i}`}, ${orderId}, ${String(line.barcode ?? "")}, ${String(line.productName ?? line.name ?? "Ürün")}, ${qty}, ${price}, 0)`;
      }
      synced++;
    }

    await sql`UPDATE marketplace_accounts SET last_sync_at=now() WHERE id='trendyol-main'`;
    return NextResponse.json({ ok: true, synced, message: `${synced} Trendyol siparişi veritabanına aktarıldı` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
