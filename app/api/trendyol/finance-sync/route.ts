import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";

export async function GET() {
  try {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    const dbUrl = process.env.DATABASE_URL;
    if (!sellerId || !apiKey || !apiSecret || !dbUrl) throw new Error("Required environment variables are not configured");

    const endDate = Date.now();
    const startDate = endDate - 15 * 24 * 60 * 60 * 1000;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements?startDate=${startDate}&endDate=${endDate}&transactionType=Sale&page=0&size=500`;
    const response = await fetch(url, { headers: { Authorization: `Basic ${auth}`, "User-Agent": `${sellerId} - SelfIntegration`, Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Trendyol Finance API error: ${response.status}`);
    const data = await response.json();
    const records = Array.isArray(data?.content) ? data.content : [];
    const sql = neon(dbUrl);
    let synced = 0;
    let matched = 0;

    for (const r of records) {
      const orderNumber = String(r.orderNumber ?? r.orderNo ?? "");
      const amount = Number(r.amount ?? r.paymentOrderIdAmount ?? r.salePrice ?? 0);
      const transactionDateRaw = Number(r.transactionDate ?? r.transactionDateTime ?? r.createdDate ?? Date.now());
      const transactionAt = new Date(transactionDateRaw).toISOString();
      const rawKey = `${orderNumber}|${r.transactionType ?? "Sale"}|${r.id ?? r.transactionId ?? ""}|${transactionDateRaw}|${amount}|${r.barcode ?? ""}`;
      const id = `ty-fin-${createHash("sha1").update(rawKey).digest("hex")}`;
      const orderId = orderNumber ? `ty-${orderNumber}` : null;
      if (orderNumber) {
        const found = await sql`SELECT id FROM orders WHERE marketplace_order_number=${orderNumber} LIMIT 1`;
        if (found.length) matched++;
      }
      await sql`INSERT INTO financial_transactions (id, company_id, marketplace_account_id, order_id, type, amount, description, transaction_at)
        VALUES (${id}, 'default-company', 'trendyol-main', ${orderId && orderNumber ? orderId : null}, ${String(r.transactionType ?? "Sale")}, ${amount}, ${String(r.description ?? r.barcode ?? "Trendyol settlement")}, ${transactionAt})
        ON CONFLICT (id) DO UPDATE SET amount=EXCLUDED.amount, description=EXCLUDED.description, transaction_at=EXCLUDED.transaction_at`;
      synced++;
    }
    return NextResponse.json({ ok: true, synced, matched, message: `${synced} finans kaydı SellerMate veritabanına aktarıldı` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Finance sync failed" }, { status: 500 });
  }
}
