import { neon } from "@neondatabase/serverless";
import CostEditor from "../CostEditor";

export const dynamic="force-dynamic";
function money(v:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(v||0)}

export default async function ProductDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const sql=neon(process.env.DATABASE_URL!);
 await sql`CREATE TABLE IF NOT EXISTS product_cost_history (id bigserial PRIMARY KEY,product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,old_cost numeric(14,2) NOT NULL DEFAULT 0,new_cost numeric(14,2) NOT NULL DEFAULT 0,changed_at timestamptz NOT NULL DEFAULT now())`;
 const rows=await sql`SELECT * FROM products WHERE id=${id} LIMIT 1`;
 if(!rows.length) return <main className="content"><h1>Ürün bulunamadı</h1><a href="/urunler">Ürünlere dön</a></main>;
 const p:any=rows[0];
 const [stats]:any=await sql`
   WITH order_totals AS (
     SELECT order_id,COALESCE(SUM(quantity*unit_price),0)::float item_total FROM order_items GROUP BY order_id
   ), finance AS (
     SELECT order_id,
       COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,
       COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo
     FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id
   )
   SELECT COALESCE(SUM(oi.quantity),0)::int qty,
     COALESCE(SUM(oi.quantity*oi.unit_price),0)::float sales,
     COALESCE(SUM(oi.quantity*COALESCE(NULLIF(oi.cost_at_sale,0),${Number(p.cost||0)})),0)::float costs,
     COALESCE(SUM(CASE WHEN ot.item_total>0 THEN COALESCE(f.commission,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float commission,
     COALESCE(SUM(CASE WHEN ot.item_total>0 THEN COALESCE(f.cargo,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float cargo,
     COUNT(DISTINCT oi.order_id)::int orders,MAX(o.ordered_at) last_sale
   FROM order_items oi
   JOIN orders o ON o.id=oi.order_id
   LEFT JOIN order_totals ot ON ot.order_id=oi.order_id
   LEFT JOIN finance f ON f.order_id=oi.order_id
   WHERE oi.product_id=${id}`;
 const sales=Number(stats?.sales||0), costs=Number(stats?.costs||0), commission=Number(stats?.commission||0), cargo=Number(stats?.cargo||0), net=sales-costs-commission-cargo;
 const history=await sql`SELECT old_cost,new_cost,changed_at FROM product_cost_history WHERE product_id=${id} ORDER BY changed_at DESC LIMIT 20`;
 const recent=await sql`
   WITH order_totals AS (SELECT order_id,COALESCE(SUM(quantity*unit_price),0)::float item_total FROM order_items GROUP BY order_id),
   finance AS (SELECT order_id,COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id)
   SELECT o.marketplace_order_number,o.ordered_at,o.status,oi.quantity,oi.unit_price,oi.cost_at_sale,
     CASE WHEN ot.item_total>0 THEN COALESCE(f.commission,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END AS commission_share,
     CASE WHEN ot.item_total>0 THEN COALESCE(f.cargo,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END AS cargo_share
   FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN order_totals ot ON ot.order_id=oi.order_id LEFT JOIN finance f ON f.order_id=oi.order_id
   WHERE oi.product_id=${id} ORDER BY o.ordered_at DESC LIMIT 20`;
 return <main className="content">
   <header className="topbar"><div><p className="eyebrow">ÜRÜN DETAYI</p><h1>{p.name}</h1><p className="muted">Barkod: {p.barcode||"-"} · SKU: {p.sku||"-"}</p></div><a className="primaryButton" href="/urunler">Ürünlere Dön</a></header>
   <section className="metricGrid">
    <article className="card metricCard"><p className="metricLabel">Toplam Satış</p><strong className="metricValue">{money(sales)}</strong><p className="metricNote">{Number(stats?.qty||0)} adet · {Number(stats?.orders||0)} sipariş</p></article>
    <article className="card metricCard"><p className="metricLabel">Komisyon + Kargo</p><strong className="metricValue">{money(commission+cargo)}</strong><p className="metricNote">Komisyon {money(commission)} · Kargo {money(cargo)}</p></article>
    <article className="card metricCard"><p className="metricLabel">Gerçek Net Sonuç</p><strong className="metricValue">{Number(p.cost)>0?money(net):"Maliyet bekliyor"}</strong><p className="metricNote">Satış − ürün maliyeti − komisyon − kargo</p></article>
    <article className="card metricCard"><p className="metricLabel">Güncel Maliyet</p><CostEditor id={p.id} initialCost={Number(p.cost||0)}/><p className="metricNote">Değişiklikler geçmişe kaydedilir</p></article>
   </section>
   <section className="card ordersCard"><div className="cardHeader"><div><h2>Maliyet Geçmişi</h2><p className="muted">Ürünün alış maliyetindeki son değişiklikler.</p></div></div><div className="tableWrap"><table><thead><tr><th>Tarih</th><th>Eski Maliyet</th><th>Yeni Maliyet</th><th>Fark</th></tr></thead><tbody>{history.length?history.map((h:any,i:number)=><tr key={i}><td>{new Date(h.changed_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{money(Number(h.old_cost))}</td><td>{money(Number(h.new_cost))}</td><td>{money(Number(h.new_cost)-Number(h.old_cost))}</td></tr>):<tr><td colSpan={4} className="emptyCell">Henüz maliyet değişikliği yok.</td></tr>}</tbody></table></div></section>
   <section className="card ordersCard"><div className="cardHeader"><div><h2>Son Satışlar</h2><p className="muted">Komisyon ve kargo payı siparişteki ürün satış tutarı oranında dağıtılır.</p></div></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Tarih</th><th>Adet</th><th>Satış</th><th>Maliyet</th><th>Komisyon</th><th>Kargo</th><th>Net</th></tr></thead><tbody>{recent.length?recent.map((r:any)=>{const lineSales=Number(r.unit_price)*Number(r.quantity);const lineCost=Number(r.cost_at_sale||p.cost||0)*Number(r.quantity);const c=Number(r.commission_share||0),cg=Number(r.cargo_share||0);return <tr key={`${r.marketplace_order_number}-${r.ordered_at}`}><td><a href={`/siparisler/${r.marketplace_order_number}`}><strong>#{r.marketplace_order_number}</strong></a></td><td>{new Date(r.ordered_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{r.quantity}</td><td>{money(lineSales)}</td><td>{Number(p.cost)>0?money(lineCost):"Bekliyor"}</td><td>{money(c)}</td><td>{money(cg)}</td><td><strong>{Number(p.cost)>0?money(lineSales-lineCost-c-cg):"Bekliyor"}</strong></td></tr>}):<tr><td colSpan={8} className="emptyCell">Satış bulunamadı.</td></tr>}</tbody></table></div></section>
 </main>
}
