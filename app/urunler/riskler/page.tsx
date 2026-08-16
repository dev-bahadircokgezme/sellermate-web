import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}
function pct(value:number){return `%${value.toFixed(1)}`}

export default async function ProductRisksPage(){
  const sql=neon(process.env.DATABASE_URL!);

  const rows=await sql`
    WITH order_totals AS (
      SELECT order_id, COALESCE(SUM(quantity*unit_price),0)::float item_total
      FROM order_items GROUP BY order_id
    ), finance AS (
      SELECT order_id,
        COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,
        COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo
      FROM financial_transactions WHERE order_id IS NOT NULL GROUP BY order_id
    ), product_perf AS (
      SELECT p.id,p.name,p.barcode,p.sku,p.cost,
        MAX(o.ordered_at) last_sale_at,
        COALESCE(SUM(oi.quantity) FILTER (WHERE o.ordered_at>=now()-interval '7 days'),0)::int qty_7,
        COALESCE(SUM(oi.quantity) FILTER (WHERE o.ordered_at>=now()-interval '14 days' AND o.ordered_at<now()-interval '7 days'),0)::int qty_prev_7,
        COALESCE(SUM(oi.quantity) FILTER (WHERE o.ordered_at>=now()-interval '30 days'),0)::int qty_30,
        COALESCE(SUM(oi.quantity*oi.unit_price) FILTER (WHERE o.ordered_at>=now()-interval '30 days'),0)::float sales_30,
        COALESCE(SUM(oi.quantity*COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)) FILTER (WHERE o.ordered_at>=now()-interval '30 days'),0)::float costs_30,
        COALESCE(SUM(CASE WHEN o.ordered_at>=now()-interval '30 days' AND ot.item_total>0 THEN COALESCE(f.commission,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float commission_30,
        COALESCE(SUM(CASE WHEN o.ordered_at>=now()-interval '30 days' AND ot.item_total>0 THEN COALESCE(f.cargo,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float cargo_30
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id=p.id
      LEFT JOIN orders o ON o.id=oi.order_id
      LEFT JOIN order_totals ot ON ot.order_id=o.id
      LEFT JOIN finance f ON f.order_id=o.id
      GROUP BY p.id
    )
    SELECT *,
      (sales_30-costs_30-commission_30-cargo_30)::float net_30,
      CASE WHEN sales_30>0 THEN ((sales_30-costs_30-commission_30-cargo_30)/sales_30*100)::float ELSE 0 END margin_30,
      CASE WHEN qty_prev_7>0 THEN ((qty_7-qty_prev_7)::float/qty_prev_7*100) WHEN qty_7>0 THEN 100 ELSE 0 END velocity_change
    FROM product_perf
    ORDER BY qty_7 DESC, sales_30 DESC, name ASC`;

  const items=rows as any[];
  const missingCost=items.filter(p=>Number(p.cost||0)<=0);
  const lossMaking=items.filter(p=>Number(p.cost||0)>0 && Number(p.sales_30||0)>0 && Number(p.net_30||0)<0);
  const fastMoving=items.filter(p=>Number(p.qty_7||0)>=3 && Number(p.velocity_change||0)>=50);
  const dormant=items.filter(p=>!p.last_sale_at || (Date.now()-new Date(p.last_sale_at).getTime())>30*86400000);

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Ürün Riskleri</h1><p className="muted">Satış hızı, kârlılık ve veri eksiklerine göre ürünleri otomatik sınıflandır.</p></div>
      <a className="primaryButton" href="/urunler">Ürünlere Dön</a>
    </header>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Zarar Eden</p><strong className="metricValue">{lossMaking.length}</strong><p className="metricNote">Son 30 günde net sonucu negatif</p></article>
      <article className="card metricCard"><p className="metricLabel">Hızlanan Ürün</p><strong className="metricValue">{fastMoving.length}</strong><p className="metricNote">Son 7 gün satışı önceki haftaya göre ≥ %50 arttı</p></article>
      <article className="card metricCard"><p className="metricLabel">30+ Gün Satış Yok</p><strong className="metricValue">{dormant.length}</strong><p className="metricNote">Uzun süredir hareket görmeyen ürün</p></article>
      <article className="card metricCard"><p className="metricLabel">Maliyet Eksik</p><strong className="metricValue">{missingCost.length}</strong><p className="metricNote">Net kâr hesabı kesinleşmeyen ürün</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Öncelikli Riskler</h2><p className="muted">Zarar eden ve hızla satış kazanan ürünleri önce kontrol et.</p></div><span className="pill">{lossMaking.length+fastMoving.length} sinyal</span></div>
      <div className="tableWrap"><table><thead><tr><th>Ürün</th><th>7 Gün</th><th>Önceki 7 Gün</th><th>Hız Değişimi</th><th>30 Gün Satış</th><th>30 Gün Net</th><th>Marj</th><th>Sinyal</th></tr></thead><tbody>
        {items.filter(p=>lossMaking.includes(p)||fastMoving.includes(p)).slice(0,50).map((p:any)=>{
          const loss=Number(p.cost||0)>0&&Number(p.sales_30||0)>0&&Number(p.net_30||0)<0;
          const fast=Number(p.qty_7||0)>=3&&Number(p.velocity_change||0)>=50;
          return <tr key={p.id}><td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a><div className="metricNote">{p.barcode||p.sku||"-"}</div></td><td>{p.qty_7}</td><td>{p.qty_prev_7}</td><td>{pct(Number(p.velocity_change||0))}</td><td>{money(Number(p.sales_30||0))}</td><td>{Number(p.cost||0)>0?money(Number(p.net_30||0)):"Maliyet bekliyor"}</td><td>{Number(p.cost||0)>0?pct(Number(p.margin_30||0)):"—"}</td><td>{loss?"Zarar ediyor":fast?"Satış hızlanıyor":"—"}</td></tr>
        })}
        {(lossMaking.length+fastMoving.length)===0&&<tr><td colSpan={8} className="emptyCell">Şu anda öncelikli ürün riski tespit edilmedi.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Uzun Süredir Satmayan Ürünler</h2><p className="muted">Son satışı 30 günden eski olan veya hiç satışı olmayan ürünler.</p></div><span className="pill">{dormant.length} ürün</span></div>
      <div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Son Satış</th><th>30 Gün Adet</th><th>30 Gün Ciro</th><th>Maliyet</th></tr></thead><tbody>{dormant.slice(0,100).map((p:any)=><tr key={p.id}><td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a></td><td>{p.last_sale_at?new Date(p.last_sale_at).toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"}):"Hiç satış yok"}</td><td>{p.qty_30}</td><td>{money(Number(p.sales_30||0))}</td><td>{Number(p.cost||0)>0?money(Number(p.cost)):"Eksik"}</td></tr>)}</tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Stok Notu</h2><p className="muted">SellerMate ürün tablosunda stok alanı mevcut, ancak mevcut ürün senkronu stok bilgisini Trendyol’dan almıyor.</p></div></div>
      <p className="muted" style={{marginTop:14}}>Bu nedenle yanlış “stok kritik” uyarısı üretmiyoruz. Gerçek pazaryeri stok senkronizasyonu bağlandığında satış hızıyla birlikte tahmini tükenme süresi ve kritik stok uyarıları eklenebilir.</p>
    </section>
  </main>;
}
