import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value)}

export default async function ProfitabilityPage(){
 const sql=neon(process.env.DATABASE_URL!);
 const [summary]=await sql`
   WITH order_costs AS (
     SELECT o.id,
       COALESCE(SUM(oi.quantity * p.cost),0)::float AS product_cost
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id=o.id
     LEFT JOIN products p ON p.id=oi.product_id
     GROUP BY o.id
   ), fin AS (
     SELECT order_id,
       COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
       COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
     FROM financial_transactions
     WHERE order_id IS NOT NULL
     GROUP BY order_id
   )
   SELECT
     COUNT(*)::int AS orders,
     COALESCE(SUM(o.gross_amount),0)::float AS revenue,
     COALESCE(SUM(oc.product_cost),0)::float AS product_cost,
     COALESCE(SUM(fin.commission),0)::float AS commission,
     COALESCE(SUM(fin.cargo),0)::float AS cargo
   FROM orders o
   LEFT JOIN order_costs oc ON oc.id=o.id
   LEFT JOIN fin ON fin.order_id=o.id`;
 const rows=await sql`
   WITH order_costs AS (
     SELECT o.id, COALESCE(SUM(oi.quantity * p.cost),0)::float AS product_cost,
       BOOL_AND(COALESCE(p.cost,0)>0) AS complete_cost
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id=o.id
     LEFT JOIN products p ON p.id=oi.product_id
     GROUP BY o.id
   ), fin AS (
     SELECT order_id,
       COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
       COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
     FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id
   )
   SELECT o.marketplace_order_number,o.gross_amount,o.status,o.ordered_at,
     COALESCE(oc.product_cost,0)::float AS product_cost,
     COALESCE(fin.commission,0)::float AS commission,
     COALESCE(fin.cargo,0)::float AS cargo,
     COALESCE(oc.complete_cost,false) AS complete_cost
   FROM orders o
   LEFT JOIN order_costs oc ON oc.id=o.id
   LEFT JOIN fin ON fin.order_id=o.id
   ORDER BY o.ordered_at DESC LIMIT 100`;
 const revenue=Number(summary.revenue), productCost=Number(summary.product_cost), commission=Number(summary.commission), cargo=Number(summary.cargo);
 const net=revenue-productCost-commission-cargo;
 const margin=revenue?net/revenue*100:0;
 return <main className="content">
   <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Kârlılık</h1><p className="muted">Gerçek Trendyol komisyonu ve kargo maliyetiyle hesaplanır. Ürün maliyeti girilmeyen siparişler eksik maliyet olarak işaretlenir.</p></div><a className="primaryButton" href="/urunler">Ürün Maliyetleri</a></header>
   <section className="metricGrid">
    <article className="card metricCard"><p className="metricLabel">Ciro</p><strong className="metricValue">{money(revenue)}</strong><p className="metricNote">Aktarılan siparişler</p></article>
    <article className="card metricCard"><p className="metricLabel">Trendyol Komisyonu</p><strong className="metricValue">{money(commission)}</strong><p className="metricNote">Finans API</p></article>
    <article className="card metricCard"><p className="metricLabel">Kargo</p><strong className="metricValue">{money(cargo)}</strong><p className="metricNote">Kargo faturası detayları</p></article>
    <article className="card metricCard"><p className="metricLabel">Net Kâr</p><strong className="metricValue">{money(net)}</strong><p className="metricNote">Marj %{margin.toFixed(1)} · maliyetler tamamlandıkça kesinleşir</p></article>
   </section>
   <section className="card ordersCard"><div className="cardHeader"><div><h2>Sipariş Bazlı Kârlılık</h2><p className="muted">Satış − ürün maliyeti − komisyon − kargo</p></div><span className="pill">Son 100 sipariş</span></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Satış</th><th>Ürün Maliyeti</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Durum</th></tr></thead><tbody>{rows.map((r:any)=>{const n=Number(r.gross_amount)-Number(r.product_cost)-Number(r.commission)-Number(r.cargo);return <tr key={r.marketplace_order_number}><td>{r.marketplace_order_number}</td><td>{money(Number(r.gross_amount))}</td><td>{r.complete_cost?money(Number(r.product_cost)):"Eksik"}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{r.complete_cost?money(n):"—"}</td><td>{r.complete_cost?"Hesaplandı":"Maliyet bekliyor"}</td></tr>})}</tbody></table></div></section>
 </main>
}
