import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value)}

export default async function ReportsPage(){
 const sql=neon(process.env.DATABASE_URL!);
 const daily=await sql`
  WITH order_costs AS (
   SELECT o.id, COALESCE(SUM(oi.quantity * p.cost),0)::float AS product_cost
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
  SELECT date_trunc('day', o.ordered_at AT TIME ZONE 'Europe/Istanbul')::date AS day,
   COUNT(*)::int AS orders,
   COALESCE(SUM(o.gross_amount),0)::float AS revenue,
   COALESCE(SUM(oc.product_cost),0)::float AS product_cost,
   COALESCE(SUM(fin.commission),0)::float AS commission,
   COALESCE(SUM(fin.cargo),0)::float AS cargo
  FROM orders o
  LEFT JOIN order_costs oc ON oc.id=o.id
  LEFT JOIN fin ON fin.order_id=o.id
  GROUP BY day
  ORDER BY day DESC
  LIMIT 30`;

 const last7=daily.slice(0,7);
 const revenue7=last7.reduce((s:any,r:any)=>s+Number(r.revenue),0);
 const orders7=last7.reduce((s:any,r:any)=>s+Number(r.orders),0);
 const commission7=last7.reduce((s:any,r:any)=>s+Number(r.commission),0);
 const cargo7=last7.reduce((s:any,r:any)=>s+Number(r.cargo),0);

 return <main className="content">
  <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Raporlar</h1><p className="muted">Günlük satış, ciro, komisyon, kargo ve kârlılık özeti.</p></div><a className="primaryButton" href="/">Dashboard</a></header>
  <section className="metricGrid">
   <article className="card metricCard"><p className="metricLabel">Son 7 Gün Ciro</p><strong className="metricValue">{money(revenue7)}</strong><p className="metricNote">Trendyol siparişleri</p></article>
   <article className="card metricCard"><p className="metricLabel">Son 7 Gün Sipariş</p><strong className="metricValue">{orders7}</strong><p className="metricNote">Toplam sipariş adedi</p></article>
   <article className="card metricCard"><p className="metricLabel">Son 7 Gün Komisyon</p><strong className="metricValue">{money(commission7)}</strong><p className="metricNote">Gerçek finans verisi</p></article>
   <article className="card metricCard"><p className="metricLabel">Son 7 Gün Kargo</p><strong className="metricValue">{money(cargo7)}</strong><p className="metricNote">Gerçek kargo faturaları</p></article>
  </section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Son 30 Gün</h2><p className="muted">Gün bazında performans</p></div><span className="pill">{daily.length} gün</span></div><div className="tableWrap"><table><thead><tr><th>Tarih</th><th>Sipariş</th><th>Ciro</th><th>Ürün Maliyeti</th><th>Komisyon</th><th>Kargo</th><th>Tahmini Net</th></tr></thead><tbody>{daily.map((r:any)=>{const net=Number(r.revenue)-Number(r.product_cost)-Number(r.commission)-Number(r.cargo);return <tr key={String(r.day)}><td>{new Date(r.day).toLocaleDateString('tr-TR')}</td><td>{r.orders}</td><td>{money(Number(r.revenue))}</td><td>{money(Number(r.product_cost))}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{money(net)}</td></tr>})}</tbody></table></div></section>
 </main>
}
