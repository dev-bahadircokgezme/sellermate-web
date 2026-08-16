import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    const dbUrl = process.env.DATABASE_URL;
    if (!sellerId || !apiKey || !apiSecret || !dbUrl) throw new Error("Required environment variables are not configured");
    const sql = neon(dbUrl);
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const endDate = Date.now();
    const startDate = endDate - 30 * 24 * 60 * 60 * 1000;
    let page = 0;
    let totalPages = 1;
    let synced = 0;

    while (page < totalPages && page < 20) {
      const url = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/v2/orders?startDate=${startDate}&endDate=${endDate}&page=${page}&size=200&orderByField=PackageLastModifiedDate&orderByDirection=DESC`;
      const response = await fetch(url, { headers: { Authorization: `Basic ${auth}`, "User-Agent": `${sellerId} - SelfIntegration`, Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Trendyol Orders API error: ${response.status}`);
      const data = await response.json();
      const packages = Array.isArray(data?.content) ? data.content : [];
      totalPages = Number(data?.totalPages ?? 1);
      for (const pkg of packages) {
        const orderNumber = String(pkg.orderNumber ?? pkg.id ?? pkg.shipmentPackageId);
        const orderId = `ty-${orderNumber}`;
        const status = String(pkg.status ?? "UNKNOWN");
        const gross = Number(pkg.totalPrice ?? pkg.grossAmount ?? 0);
        const rawDate = Number(pkg.orderDate ?? pkg.createdDate ?? Date.now());
        const orderedAt = new Date(rawDate).toISOString();
        await sql`INSERT INTO orders (id, company_id, marketplace_account_id, marketplace_order_number, status, gross_amount, ordered_at, updated_at) VALUES (${orderId},'default-company','trendyol-main',${orderNumber},${status},${gross},${orderedAt},now()) ON CONFLICT (marketplace_order_number) DO UPDATE SET status=EXCLUDED.status,gross_amount=EXCLUDED.gross_amount,updated_at=now()`;
        await sql`DELETE FROM order_items WHERE order_id=${orderId}`;
        const lines = Array.isArray(pkg.lines) ? pkg.lines : [];
        for (let i=0;i<lines.length;i++) {
          const line=lines[i];
          await sql`INSERT INTO order_items (id,order_id,barcode,product_name,quantity,unit_price,cost_at_sale) VALUES (${`${orderId}-${i}`},${orderId},${String(line.barcode ?? "")},${String(line.productName ?? line.name ?? "Ürün")},${Number(line.quantity ?? 1)},${Number(line.price ?? line.amount ?? 0)},0)`;
        }
        synced++;
      }
      page++;
    }
    await sql`UPDATE marketplace_accounts SET last_sync_at=now() WHERE id='trendyol-main'`;
    return NextResponse.json({ok:true,synced,pages:page,message:`Son 30 günlük ${synced} Trendyol siparişi senkronize edildi`});
  } catch(error) {
    return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Order history sync failed"},{status:500});
  }
}
