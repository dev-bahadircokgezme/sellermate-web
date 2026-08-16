import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}
function pct(value:number){return `%${value.toFixed(1)}`}

export default async function ProfitabilityPage({searchParams}:{searchParams:Promise<{days?:string;status?:string}>}){
 const params=await searchParams;
 const days=Math.max(1,Math.min(365,Number(params?.days||30)||30));
 const status=String(params?.status||"all");
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
   )
   SELECT COUNT(*)::int AS orders,
     COUNT(*) FILTER (WHERE oc.complete_cost)::int AS complete_orders,
     COALESCE(SUM(o.gross_amount),0)::float AS revenue,
     COALESCE(SUM(oc.product_cost),0)::float AS product_cost,
     COALESCE(SUM(fin.commission),0)::float AS commission,
     COALESCE(SUM(fin.cargo),0)::float AS cargo
   FROM orders o
   LEFT JOIN order_costs oc ON oc.id=o.id
   LEFT JOIN fin ON fin.order_id=o.id
   WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval`;

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
   )
   SELECT o.marketplace_order_number,o.gross_amount,o.status,o.ordered_at,
     COALESCE(oc.product_cost,0)::float AS product_cost,
     COALESCE(fin.commission,0)::float AS commission,
     COALESCE(fin.cargo,0)::float AS cargo,
     COALESCE(oc.complete_cost,false) AS complete_cost
   FROM orders o
   LEFT JOIN order_costs oc ON oc.id=o.id
   LEFT JOIN fin ON fin.order_id=o.id
   WHERE o.ordered_at >= now() - (${days}::text || ' days')::interval
     AND (${status}='all' OR (${status}='complete' AND COALESCE(oc.complete_cost,false)) OR (${status}='missing' AND NOT COALESCE(oc.complete_cost,false)))
   ORDER BY o.ordered_at DESC LIMIT 150`;

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
   ORDER BY net DESC NULLS LAST
   LIMIT 20`;

 const revenue=Number(summary?.revenue||0), productCost=Number(summary?.product_cost||0), commission=Number(summary?.commission||0), cargo=Number(summary?.cargo||0);
 const completeOrders=Number(summary?.complete_orders||0), totalOrders=Number(summary?.orders||0);
 const allComplete=totalOrders>0 && completeOrders===totalOrders;
 const net=revenue-productCost-commission-cargo;
 const margin=revenue?net/revenue*100:0;

 return <main className="content">
   <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Kârlılık</h1><p className="muted">Gerçek Trendyol komisyonu, gerçek kargo ve ürün maliyetleriyle hesaplanır.</p></div><a className="primaryButton" href="/urunler">Ürün Maliyetleri</a></header>

   <section className="card ordersCard" style={{marginTop:0}}>
     <form method="get" style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
       <select name="days" defaultValue={String(days)} style={{padding:"10px 12px"}}><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="365">Son 365 gün</option></select>
       <select name="status" defaultValue={status} style={{padding:"10px 12px"}}><option value="all">Tüm siparişler</option><option value="complete">Maliyeti tamamlanan</option><option value="missing">Maliyet bekleyen</option></select>
       <button className="primaryButton" type="submit">Uygula</button>
     </form>
   </section>

   <section className="metricGrid">
    <article className="card metricCard"><p className="metricLabel">Ciro</p><strong className="metricValue">{money(revenue)}</strong><p className="metricNote">Son {days} gün</p></article>
    <article className="card metricCard"><p className="metricLabel">Toplam Kesinti</p><strong className="metricValue">{money(commission+cargo)}</strong><p className="metricNote">Komisyon {money(commission)} · Kargo {money(cargo)}</p></article>
    <article className="card metricCard"><p className="metricLabel">Maliyet Tamamlanma</p><strong className="metricValue">{totalOrders?`${Math.round(completeOrders/totalOrders*100)}%`:"0%"}</strong><p className="metricNote">{completeOrders}/{totalOrders} sipariş hesaplamaya hazır</p></article>
    <article className="card metricCard"><p className="metricLabel">Net Kâr</p><strong className="metricValue">{allComplete?money(net):"Maliyet bekliyor"}</strong><p className="metricNote">{allComplete?`Marj ${pct(margin)}`:"Eksik maliyetler tamamlandığında kesinleşir"}</p></article>
   </section>

   <section className="card ordersCard"><div className="cardHeader"><div><h2>Ürün Bazlı Kârlılık</h2><p className="muted">Gerçek komisyon ve kargo, sipariş içindeki satış payına göre ürünlere dağıtılır.</p></div><span className="pill">İlk 20 ürün</span></div><div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Adet</th><th>Satış</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Marj</th></tr></thead><tbody>{products.length?products.map((p:any)=><tr key={p.id}><td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a><div className="metricNote">{p.barcode||"-"}</div></td><td>{p.qty}</td><td>{money(Number(p.sales))}</td><td>{money(Number(p.commission))}</td><td>{money(Number(p.cargo))}</td><td>{p.complete_cost?money(Number(p.net)):"Maliyet bekliyor"}</td><td>{p.complete_cost?pct(Number(p.margin)):"—"}</td></tr>):<tr><td colSpan={7} className="emptyCell">Bu dönem için ürün satışı yok.</td></tr>}</tbody></table></div></section>

   <section className="card ordersCard"><div className="cardHeader"><div><h2>Sipariş Bazlı Kârlılık</h2><p className="muted">Satış − ürün maliyeti − komisyon − kargo</p></div><span className="pill">{rows.length} kayıt</span></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Satış</th><th>Ürün Maliyeti</th><th>Komisyon</th><th>Kargo</th><th>Net</th><th>Marj</th><th>Durum</th></tr></thead><tbody>{rows.map((r:any)=>{const sale=Number(r.gross_amount), n=sale-Number(r.product_cost)-Number(r.commission)-Number(r.cargo), m=sale?n/sale*100:0;return <tr key={r.marketplace_order_number}><td><a href={`/siparisler/${r.marketplace_order_number}`}><strong>{r.marketplace_order_number}</strong></a></td><td>{money(sale)}</td><td>{r.complete_cost?money(Number(r.product_cost)):"Eksik"}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{r.complete_cost?money(n):"—"}</td><td>{r.complete_cost?pct(m):"—"}</td><td>{r.complete_cost?"Hesaplandı":"Maliyet bekliyor"}</td></tr>})}</tbody></table></div></section>
 </main>
}
