import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}
function pct(value:number){return `%${value.toFixed(1)}`}

export default async function ProfitabilityPage({searchParams}:{searchParams:Promise<{days?:string;status?:string;result?:string}>}){
 const params=await searchParams;
 const days=Math.max(1,Math.min(365,Number(params?.days||30)||30));
 const status=String(params?.status||"all");
 const result=String(params?.result||"all");
 const sql=neon(process.env.DATABASE_URL!);

 const [summary]:any=await sql`
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
   ), calc AS (
     SELECT o.id,o.gross_amount,oc.product_cost,oc.complete_cost,
       COALESCE(fin.commission,0)::float commission,COALESCE(fin.cargo,0)::float cargo,
       (o.gross_amount-oc.product_cost-COALESCE(fin.commission,0)-COALESCE(fin.cargo,0))::float net
     FROM orders o
     LEFT JOIN order_costs oc ON oc.id=o.id
     LEFT JOIN fin ON fin.order_id=o.id
     WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
   )
   SELECT COUNT(*)::int AS orders,
     COUNT(*) FILTER (WHERE complete_cost)::int AS complete_orders,
     COUNT(*) FILTER (WHERE complete_cost AND net>=0)::int AS profitable_orders,
     COUNT(*) FILTER (WHERE complete_cost AND net<0)::int AS loss_orders,
     COALESCE(SUM(gross_amount),0)::float AS revenue,
     COALESCE(SUM(product_cost),0)::float AS product_cost,
     COALESCE(SUM(commission),0)::float AS commission,
     COALESCE(SUM(cargo),0)::float AS cargo,
     COALESCE(SUM(net) FILTER (WHERE complete_cost),0)::float AS confirmed_net,
     COALESCE(SUM(gross_amount) FILTER (WHERE complete_cost),0)::float AS confirmed_revenue,
     COALESCE(AVG(net) FILTER (WHERE complete_cost),0)::float AS avg_order_net
   FROM calc`;

 const rows=await sql`
   WITH order_costs AS (
     SELECT o.id,
       COALESCE(SUM(oi.quantity * COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)),0)::float AS product_cost,
       COALESCE(BOOL_AND(COALESCE(NULLIF(oi.cost_at_sale,0),p.cost,0)>0),false) AS complete_cost
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id=o.id
     LEFT JOIN products p ON p.id=oi.product_id
     GROUP BY o.id
   ), fin AS (
     SELECT order_id,
       COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
       COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
     FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id
   ), calc AS (
     SELECT o.marketplace_order_number,o.gross_amount,o.status,o.ordered_at,
       COALESCE(oc.product_cost,0)::float AS product_cost,
       COALESCE(fin.commission,0)::float AS commission,
       COALESCE(fin.cargo,0)::float AS cargo,
       COALESCE(oc.complete_cost,false) AS complete_cost,
       (o.gross_amount-COALESCE(oc.product_cost,0)-COALESCE(fin.commission,0)-COALESCE(fin.cargo,0))::float AS net
     FROM orders o
     LEFT JOIN order_costs oc ON oc.id=o.id
     LEFT JOIN fin ON fin.order_id=o.id
     WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
   )
   SELECT * FROM calc
   WHERE (${status}='all' OR (${status}='complete' AND complete_cost) OR (${status}='missing' AND NOT complete_cost))
     AND (${result}='all' OR (${result}='profit' AND complete_cost AND net>=0) OR (${result}='loss' AND complete_cost AND net<0))
   ORDER BY ordered_at DESC LIMIT 150`;

 const products=await sql`
   WITH order_fin AS (
     SELECT o.id,o.gross_amount,
       COALESCE(SUM(CASE WHEN ft.type IN ('Sale','Return') THEN ft.commission_amount ELSE 0 END),0)::float AS commission,
       COALESCE(SUM(CASE WHEN ft.type='Cargo' THEN ft.amount ELSE 0 END),0)::float AS cargo
     FROM orders o LEFT JOIN financial_transactions ft ON ft.order_id=o.id
     WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
     GROUP BY o.id
   ), product_lines AS (
     SELECT p.id,p.name,p.barcode,
       SUM(oi.quantity)::int qty,
       SUM(oi.quantity*oi.unit_price)::float sales,
       SUM(oi.quantity*COALESCE(NULLIF(oi.cost_at_sale,0),p.cost))::float costs,
       BOOL_AND(COALESCE(NULLIF(oi.cost_at_sale,0),p.cost,0)>0) AS complete_cost,
       SUM(CASE WHEN ofn.gross_amount>0 THEN ofn.commission*((oi.quantity*oi.unit_price)/ofn.gross_amount) ELSE 0 END)::float commission,
       SUM(CASE WHEN ofn.gross_amount>0 THEN ofn.cargo*((oi.quantity*oi.unit_price)/ofn.gross_amount) ELSE 0 END)::float cargo
     FROM order_items oi
     JOIN orders o ON o.id=oi.order_id
     JOIN products p ON p.id=oi.product_id
     JOIN order_fin ofn ON ofn.id=o.id
     WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
     GROUP BY p.id,p.name,p.barcode
   )
   SELECT *, (sales-costs-commission-cargo)::float AS net,
     CASE WHEN sales>0 THEN ((sales-costs-commission-cargo)/sales*100)::float ELSE 0 END AS margin
   FROM product_lines
   ORDER BY CASE WHEN complete_cost THEN (sales-costs-commission-cargo) ELSE NULL END ASC NULLS LAST
   LIMIT 20`;

 const revenue=Number(summary?.revenue||0), commission=Number(summary?.commission||0), cargo=Number(summary?.cargo||0);
 const completeOrders=Number(summary?.complete_orders||0), totalOrders=Number(summary?.orders||0);
 const profitableOrders=Number(summary?.profitable_orders||0), lossOrders=Number(summary?.loss_orders||0);
 const confirmedNet=Number(summary?.confirmed_net||0), confirmedRevenue=Number(summary?.confirmed_revenue||0), avgOrderNet=Number(summary?.avg_order_net||0);
 const confirmedMargin=confirmedRevenue?confirmedNet/confirmedRevenue*100:0;

 return <main className="content">
   <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Kârlılık</h1><p className="muted">Gerçek Trendyol komisyonu, gerçek kargo ve ürün maliyetleriyle hesaplanır.</p></div><a className="primaryButton" href="/urunler">Ürün Maliyetleri</a></header>

   <section className="card ordersCard" style={{marginTop:0}}>
     <form method="get" style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
       <select name="days" defaultValue={String(days)} style={{padding:"10px 12px"}}><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="365">Son 365 gün</option></select>
       <select name="status" defaultValue={status} style={{padding:"10px 12px"}}><option value="all">Tüm siparişler</option><option value="complete">Maliyeti tamamlanan</option><option value="missing">Maliyet bekleyen</option></select>
       <select name="result" defaultValue={result} style={{padding:"10px 12px"}}><option value="all">Kâr / zarar: tümü</option><option value="profit">Sadece kârlı</option><option value="loss">Sadece zarar eden</option></select>
       <button className="primaryButton" type="submit">Uygula</button>
     </form>
   </section>

   <section className="metricGrid">
    <article className="card metricCard"><p className="metricLabel">Ciro</p><strong className="metricValue">{money(revenue)}</strong><p className="metricNote">Son {days} gün · {totalOrders} sipariş</p></article>
    <article className="card metricCard"><p className="metricLabel">Kesinleşmiş Net</p><strong className="metricValue">{money(confirmedNet)}</strong><p className="metricNote">Marj {pct(confirmedMargin)} · yalnız maliyeti tamamlananlar</p></article>
    <article className="card metricCard"><p className="metricLabel">Kârlı / Zararlı</p><strong className="metricValue">{profitableOrders} / {lossOrders}</strong><p className="metricNote">{completeOrders} hesaplanmış sipariş</p></article>
    <article className="card metricCard"><p className="metricLabel">Ort. Sipariş Neti</p><strong className="metricValue">{money(avgOrderNet)}</strong><p className="metricNote">Maliyet tamamlama %{totalOrders?Math.round(completeOrders/totalOrders*100):0}</p></article>
   </section>

   <section className="card ordersCard"><div className="cardHeader"><div><h2>Riskli Ürünler</h2><p className="muted">Net sonucu en düşük ürünler önce gösterilir. Komisyon ve kargo satış payına göre dağıtılır.</p></div><span className="pill">İlk 20 ürün</span></div><div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Adet</th><th>Satış</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Marj</th><th>Durum</th></tr></thead><tbody>{products.length?products.map((p:any)=>{const net=Number(p.net||0);return <tr key={p.id}><td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a><div className="metricNote">{p.barcode||"-"}</div></td><td>{p.qty}</td><td>{money(Number(p.sales))}</td><td>{money(Number(p.commission))}</td><td>{money(Number(p.cargo))}</td><td>{p.complete_cost?money(net):"Maliyet bekliyor"}</td><td>{p.complete_cost?pct(Number(p.margin)):"—"}</td><td><span className="pill">{!p.complete_cost?"Eksik maliyet":net<0?"Zarar":"Kârlı"}</span></td></tr>}):<tr><td colSpan={8} className="emptyCell">Bu dönem için ürün satışı yok.</td></tr>}</tbody></table></div></section>

   <section className="card ordersCard"><div className="cardHeader"><div><h2>Sipariş Bazlı Kârlılık</h2><p className="muted">Satış − ürün maliyeti − komisyon − kargo</p></div><span className="pill">{rows.length} kayıt</span></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Satış</th><th>Ürün Maliyeti</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Marj</th><th>Durum</th></tr></thead><tbody>{rows.length?rows.map((r:any)=>{const sale=Number(r.gross_amount), n=Number(r.net), m=sale?n/sale*100:0;return <tr key={r.marketplace_order_number}><td><a href={`/siparisler/${r.marketplace_order_number}`}><strong>{r.marketplace_order_number}</strong></a></td><td>{money(sale)}</td><td>{r.complete_cost?money(Number(r.product_cost)):"Eksik"}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{r.complete_cost?money(n):"—"}</td><td>{r.complete_cost?pct(m):"—"}</td><td><span className="pill">{!r.complete_cost?"Maliyet bekliyor":n<0?"Zarar":"Kârlı"}</span></td></tr>}):<tr><td colSpan={8} className="emptyCell">Bu filtreye uygun sipariş yok.</td></tr>}</tbody></table></div></section>

   <section className="card ordersCard"><div className="cardHeader"><div><h2>Kesinti Özeti</h2><p className="muted">Dönem boyunca Trendyol tarafından oluşan gerçek kesintiler.</p></div></div><div className="metricGrid" style={{marginTop:16}}><article className="card metricCard"><p className="metricLabel">Komisyon</p><strong className="metricValue">{money(commission)}</strong></article><article className="card metricCard"><p className="metricLabel">Kargo</p><strong className="metricValue">{money(cargo)}</strong></article><article className="card metricCard"><p className="metricLabel">Toplam Kesinti</p><strong className="metricValue">{money(commission+cargo)}</strong></article></div></section>
 </main>
}
