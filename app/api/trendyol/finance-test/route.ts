import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    if (!sellerId || !apiKey || !apiSecret) throw new Error("Trendyol credentials are not configured");
    const endDate = Date.now();
    const startDate = endDate - 15 * 24 * 60 * 60 * 1000;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements?startDate=${startDate}&endDate=${endDate}&transactionType=Sale&page=0&size=500`;
    const response = await fetch(url, { headers: { Authorization: `Basic ${auth}`, "User-Agent": `${sellerId} - SelfIntegration`, Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Trendyol Finance API error: ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ ok: true, message: "Trendyol finans bağlantısı başarılı", records: Array.isArray(data?.content) ? data.content.length : 0, totalElements: data?.totalElements ?? 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Finance test failed" }, { status: 500 });
  }
}
