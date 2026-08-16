import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    if (!sellerId || !apiKey || !apiSecret) throw new Error("Trendyol credentials are not configured");

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const baseHeaders: Record<string,string> = {
      Authorization: `Basic ${auth}`,
      "User-Agent": `${sellerId} - SelfIntegration`,
      Accept: "application/json",
    };

    const invoiceId = "DDF2026018383375";
    const urls = [
      `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${invoiceId}/items?page=0&size=500`,
      `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${invoiceId}/items`,
    ];

    const results = [];
    for (const url of urls) {
      for (const withStoreFront of [false, true]) {
        const headers = withStoreFront ? { ...baseHeaders, storeFrontCode: "TR" } : baseHeaders;
        const res = await fetch(url, { headers, cache: "no-store" });
        const text = await res.text();
        results.push({
          status: res.status,
          withStoreFront,
          path: new URL(url).pathname + new URL(url).search,
          body: text.slice(0, 800),
        });
      }
    }

    return NextResponse.json({ ok: true, invoiceId, results });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Cargo debug failed" }, { status: 500 });
  }
}
