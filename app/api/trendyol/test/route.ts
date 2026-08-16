import { NextResponse } from "next/server";
import { getTrendyolOrders } from "../../../../src/lib/trendyol";

export async function GET() {
  try {
    const data = await getTrendyolOrders();
    const count = Array.isArray(data?.content) ? data.content.length : 0;
    return NextResponse.json({ ok: true, message: "Trendyol bağlantısı başarılı", receivedOrders: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
