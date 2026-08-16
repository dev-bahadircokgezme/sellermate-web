import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const rawDays = Number(request.nextUrl.searchParams.get("days") || 30);
    const days = Math.max(1, Math.min(365, Number.isFinite(rawDays) ? rawDays : 30));
    const sql = neon(dbUrl);

    const rows = await sql`
      WITH order_costs AS (
        SELECT o.id,
          COALESCE(SUM(oi.quantity * COALESCE(NULLIF(oi.cost_at_sale,0), p.cost)),0)::float AS product_cost,
          COALESCE(BOOL_AND(COALESCE(NULLIF(oi.cost_at_sale,0),p.cost,0)>0),false) AS complete_cost
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id=o.id
        LEFT JOIN products p ON p.id=oi.product_id
        WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
        GROUP BY o.id
      ), fin AS (
        SELECT order_id,
          COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
          COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
        FROM financial_transactions
        WHERE order_id IS NOT NULL
        GROUP BY order_id
      )
      SELECT o.marketplace_order_number,o.ordered_at,o.status,o.gross_amount,
        COALESCE(oc.product_cost,0)::float AS product_cost,
        COALESCE(fin.commission,0)::float AS commission,
        COALESCE(fin.cargo,0)::float AS cargo,
        COALESCE(oc.complete_cost,false) AS complete_cost,
        COALESCE(string_agg(oi.product_name, ' | ' ORDER BY oi.product_name), '') AS products
      FROM orders o
      LEFT JOIN order_costs oc ON oc.id=o.id
      LEFT JOIN fin ON fin.order_id=o.id
      LEFT JOIN order_items oi ON oi.order_id=o.id
      WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
      GROUP BY o.id,oc.product_cost,oc.complete_cost,fin.commission,fin.cargo
      ORDER BY o.ordered_at DESC`;

    const header = ["Sipariş No","Tarih","Durum","Ürünler","Ciro","Ürün Maliyeti","Komisyon","Kargo","Net Sonuç","Maliyet Durumu"];
    const lines = [header.map(csvEscape).join(";")];

    for (const row of rows as any[]) {
      const sale = Number(row.gross_amount || 0);
      const cost = Number(row.product_cost || 0);
      const commission = Number(row.commission || 0);
      const cargo = Number(row.cargo || 0);
      const net = sale - cost - commission - cargo;
      lines.push([
        row.marketplace_order_number,
        new Date(row.ordered_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
        row.status,
        row.products,
        sale.toFixed(2),
        row.complete_cost ? cost.toFixed(2) : "",
        commission.toFixed(2),
        cargo.toFixed(2),
        row.complete_cost ? net.toFixed(2) : "",
        row.complete_cost ? "Tamamlandı" : "Maliyet bekliyor"
      ].map(csvEscape).join(";"));
    }

    const bom = "\uFEFF";
    return new NextResponse(bom + lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sellermate-rapor-${days}-gun.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ ok:false, message:error instanceof Error ? error.message : "Rapor dışa aktarılamadı" }, { status:500 });
  }
}
