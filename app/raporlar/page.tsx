import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}
function pct(value:number){if(!Number.isFinite(value)) return "—"; return `${value>=0?"+":""}${value.toFixed(1)}%`}

export default async function ReportsPage({searchParams}:{searchParams:Promise<{days?:string}>}){
 const params=await searchParams;
 const days=Math.max(1,Math.min(365,Number(params?.days||30)||30));
 const sql=neon(process.env.DATABASE_URL!);

 const daily=await sql`
  WITH order_costs AS (
   SELECT o.id,
    COALESCE(SUM(oi.quantity * COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)),0)::float AS product_cost,
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
  SELECT date_trunc('day', o.ordered_at AT TIME ZONE 'Europe/Istanbul')::date AS day,
   COUNT(*)::int AS orders,
   COALESCE(SUM(o.gross_amount),0)::float AS revenue,
   COALESCE(SUM(oc.product_cost),0)::float AS product_cost,
   COALESCE(SUM(fin.commission),0)::float AS commission,
   COALESCE(SUM(fin.cargo),0)::float AS cargo,
   COUNT(*) FILTER (WHERE oc.complete_cost)::int AS complete_orders
  FROM orders o
  LEFT JOIN order_costs oc ON oc.id=o.id
  LEFT JOIN fin ON fin.order_id=o.id
  WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
  GROUP BY day
  ORDER BY day DESC`;

 const [current]:any=await sql`
  WITH order_costs AS (
   SELECT o.id,
    COALESCE(SUM(oi.quantity * COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)),0)::float AS product_cost,
    COALESCE(BOOL_AND(COALESCE(NULLIF(oi.cost_at_sale,0),p.cost,0)>0),false) AS complete_cost
   FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
   WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval GROUP BY o.id
  ), fin AS (
   SELECT order_id,
    COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,
    COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo
   FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id
  )
  SELECT COUNT(*)::int orders,COALESCE(SUM(o.gross_amount),0)::float revenue,
   COALESCE(SUM(oc.product_cost),0)::float product_cost,COALESCE(SUM(fin.commission),0)::float commission,
   COALESCE(SUM(fin.cargo),0)::float cargo,COUNT(*) FILTER (WHERE oc.complete_cost)::int complete_orders
  FROM orders o LEFT JOIN order_costs oc ON oc.id=o.id LEFT JOIN fin ON fin.order_id=o.id
  WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval`;

 const [previous]:any=await sql`
  SELECT COUNT(*)::int orders,COALESCE(SUM(gross_amount),0)::float revenue
  FROM orders
  WHERE ordered_at < now() - (${days}::text || ' days')::interval
    AND ordered_at >= now() - (${days*2}::text || ' days')::interval`;

 const topProducts=await sql`
  SELECT p.id,p.name,p.barcode,COALESCE(SUM(oi.quantity),0)::int qty,
    COALESCE(SUM(oi.quantity*oi.unit_price),0)::float sales
  FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id
  WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
  GROUP BY p.id,p.name,p.barcode ORDER BY sales DESC LIMIT 10`;

 const revenue=Number(current?.revenue||0), orders=Number(current?.orders||0), productCost=Number(current?.product_cost||0), commission=Number(current?.commission||0), cargo=Number(current?.cargo||0), completeOrders=Number(current?.complete_orders||0);
 const net=revenue-productCost-commission-cargo;
 const revenueChange=Number(previous?.revenue||0)?(revenue-Number(previous.revenue))/Number(previous.revenue)*100:0;
 const orderChange=Number(previous?.orders||0)?(orders-Number(previous.orders))/Number(previous.orders)*100:0;
 const allComplete=orders>0&&completeOrders===orders;

 return <main className="content">
  <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Raporlar</h1><p className="muted">Satış, maliyet, komisyon, kargo ve dönem karşılaştırması.</p></div><a className="primaryButton" href={`/api/reports/export?days=${days}`}>CSV İndir</a></header>

  <section className="card ordersCard" style={{marginTop:0}}>
   <form method="get" style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
    <select name="days" defaultValue={String(days)} style={{padding:"10px 12px"}}><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="365">Son 365 gün</option></select>
    <button className="primaryButton" type="submit">Uygula</button>
   </form>
  </section>

  <section className="metricGrid">
   <article className="card metricCard"><p className="metricLabel">Ciro</p><strong className="metricValue">{money(revenue)}</strong><p className="metricNote">Önceki döneme göre {pct(revenueChange)}</p></article>
   <article className="card metricCard"><p className="metricLabel">Sipariş</p><strong className="metricValue">{orders}</strong><p className="metricNote">Önceki döneme göre {pct(orderChange)}</p></article>
   <article className="card metricCard"><p className="metricLabel">Toplam Kesinti</p><strong className="metricValue">{money(commission+cargo)}</strong><p className="metricNote">Komisyon {money(commission)} · Kargo {money(cargo)}</p></article>
   <article className="card metricCard"><p className="metricLabel">Net Sonuç</p><strong className="metricValue">{allComplete?money(net):"Maliyet bekliyor"}</strong><p className="metricNote">{completeOrders}/{orders} sipariş maliyeti tamamlandı</p></article>
  </section>

  <section className="card ordersCard"><div className="cardHeader"><div><h2>En Çok Ciro Üreten Ürünler</h2><p className="muted">Seçili dönemde satış tutarına göre ilk 10 ürün.</p></div><span className="pill">{topProducts.length} ürün</span></div><div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Barkod</th><th>Satılan</th><th>Ciro</th></tr></thead><tbody>{topProducts.length?topProducts.map((p:any)=><tr key={p.id}><td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a></td><td>{p.barcode||"-"}</td><td>{p.qty}</td><td>{money(Number(p.sales))}</td></tr>):<tr><td colSpan={4} className="emptyCell">Bu dönemde ürün satışı yok.</td></tr>}</tbody></table></div></section>

  <section className="card ordersCard"><div className="cardHeader"><div><h2>Günlük Performans</h2><p className="muted">Seçili dönem için gün bazında finansal görünüm.</p></div><span className="pill">{daily.length} gün</span></div><div className="tableWrap"><table><thead><tr><th>Tarih</th><th>Sipariş</th><th>Ciro</th><th>Ürün Maliyeti</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Maliyet</th></tr></thead><tbody>{daily.map((r:any)=>{const n=Number(r.revenue)-Number(r.product_cost)-Number(r.commission)-Number(r.cargo);const complete=Number(r.complete_orders)===Number(r.orders);return <tr key={String(r.day)}><td>{new Date(r.day).toLocaleDateString('tr-TR')}</td><td>{r.orders}</td><td>{money(Number(r.revenue))}</td><td>{complete?money(Number(r.product_cost)):"Eksik"}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{complete?money(n):"—"}</td><td>{r.complete_orders}/{r.orders}</td></tr>})}</tbody></table></div></section>
 </main>
}
