import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sellerId = process.env.TRENDYOL_SELLER_ID;
    const apiKey = process.env.TRENDYOL_API_KEY;
    const apiSecret = process.env.TRENDYOL_API_SECRET;
    if (!sellerId || !apiKey || !apiSecret) throw new Error("Trendyol credentials are not configured");

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const baseHeaders = {
      Authorization: `Basic ${auth}`,
      "User-Agent": `${sellerId} - SelfIntegration`,
      Accept: "application/json",
      storeFrontCode: "TR",
    };

    const endDate = Date.now();
    const startDate = endDate - 15 * 24 * 60 * 60 * 1000;
    const invoicesUrl = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/otherfinancials?startDate=${startDate}&endDate=${endDate}&transactionType=DeductionInvoices&page=0&size=1000`;
    const invoiceRes = await fetch(invoicesUrl, { headers: baseHeaders, cache: "no-store" });
    const invoiceText = await invoiceRes.text();
    if (!invoiceRes.ok) return NextResponse.json({ ok: false, stage: "invoice-list", status: invoiceRes.status, body: invoiceText.slice(0, 1000) });

    const invoiceData = JSON.parse(invoiceText);
    const records = Array.isArray(invoiceData?.content) ? invoiceData.content : [];
    const cargoInvoice = records.find((r: any) => String(r.transactionType ?? "").toLocaleLowerCase("tr-TR").includes("kargo fatura"));
    if (!cargoInvoice?.id) return NextResponse.json({ ok: false, stage: "find-cargo-invoice", message: "Kargo faturası bulunamadı" });

    const invoiceId = String(cargoInvoice.id);
    const candidates = [
      `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${encodeURIComponent(invoiceId)}/items`,
      `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${encodeURIComponent(invoiceId)}/items?page=0&size=1000`,
      `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${encodeURIComponent(invoiceId)}`,
    ];

    const attempts = [];
    for (const url of candidates) {
      const res = await fetch(url, { headers: baseHeaders, cache: "no-store" });
      const body = await res.text();
      attempts.push({ url, status: res.status, body: body.slice(0, 1200) });
    }

    return NextResponse.json({ ok: true, invoiceId, attempts });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Cargo diagnostic failed" }, { status: 500 });
  }
}
