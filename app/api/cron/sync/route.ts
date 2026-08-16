import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, message: "Yetkisiz cron isteği" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const headers = { Authorization: `Bearer ${cronSecret}` };
  const jobs = [
    { name: "orders", path: "/api/trendyol/order-history-sync" },
    { name: "finance", path: "/api/trendyol/finance-full-sync" },
    { name: "cargo", path: "/api/trendyol/cargo-sync" },
    { name: "products", path: "/api/products/sync" },
  ];

  const results: Record<string, unknown> = {};
  let success = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const response = await fetch(`${origin}${job.path}`, { headers, cache: "no-store" });
      const text = await response.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = text.slice(0, 1000); }
      results[job.name] = { status: response.status, ok: response.ok, body };
      if (response.ok) success++; else failed++;
    } catch (error) {
      failed++;
      results[job.name] = { ok: false, message: error instanceof Error ? error.message : "İşlem başarısız" };
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    automatic: true,
    success,
    failed,
    ranAt: new Date().toISOString(),
    results,
  }, { status: failed === 0 ? 200 : 207 });
}
