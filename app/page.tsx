import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(value)}
function moneyFull(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value)}

export default async function Home(){
 const sql=neon(process.env.DATABASE_URL!);
 let p:any={today_orders:0,today_revenue:0,week_orders:0,week_revenue:0,month_orders:0,month_revenue:0};
 let finance:any={commission:0,cargo:0};
 let cost:any={product_cost:0,missing:1};
 let daily:any[]=[]; let recent:any[]=[]; let topProducts:any[]=[];
 try{const rows:any=await sql`SELECT COUNT(*) FILTER (WHERE ordered_at>=date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul'))::int today_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')),0)::float today_revenue,COUNT(*) FILTER (WHERE ordered_at>=now()-interval '7 days')::int week_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=now()-interval '7 days'),0)::float week_revenue,COUNT(*) FILTER (WHERE ordered_at>=now()-interval '30 days')::int month_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=now()-interval '30 days'),0)::float month_revenue FROM orders`;p=rows[0]||p}catch{}
 try{const rows:any=await sql`SELECT COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo FROM financial_transactions WHERE transaction_at>=now()-interval '30 days'`;finance=rows[0]||finance}catch{}
 try{const rows:any=await sql`SELECT COALESCE(SUM(oi.quantity*p.cost),0)::float product_cost,COUNT(*) FILTER (WHERE COALESCE(p.cost,0)<=0)::int missing FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.ordered_at>=now()-interval '30 days'`;cost=rows[0]||cost}catch{}
 try{daily=await sql`SELECT to_char((ordered_at AT TIME ZONE 'Europe/Istanbul')::date,'DD.MM') day,COUNT(*)::int orders,COALESCE(SUM(gross_amount),0)::float revenue FROM orders WHERE ordered_at>=now()-interval '7 days' GROUP BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date ORDER BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date` as any[]}catch{}
 try{recent=await sql`SELECT o.marketplace_order_number,o.status,o.gross_amount,o.ordered_at,COALESCE(string_agg(oi.product_name,', '),'') products FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 6` as any[]}catch{}
 try{topProducts=await sql`SELECT p.id,p.name,COALESCE(SUM(oi.quantity),0)::int qty,COALESCE(SUM(oi.quantity*oi.unit_price),0)::float sales FROM products p JOIN order_items oi ON oi.product_id=p.id JOIN orders o ON o.id=oi.order_id WHERE o.ordered_at>=now()-interval '30 days' GROUP BY p.id,p.name ORDER BY sales DESC LIMIT 5` as any[]}catch{}

 const revenue30=Number(p.month_revenue||0),commission=Number(finance.commission||0),cargo=Number(finance.cargo||0),productCost=Number(cost.product_cost||0),missing=Number(cost.missing||0),net=revenue30-productCost-commission-cargo;
 const maxDay=Math.max(1,...daily.map(d=>Number(d.revenue||0)));

 return <main className="dashboardPage">
   <section className="dashboardIntro">
     <div><h1>Hoş geldin.</h1><p>Mağazanın satış, sipariş ve kârlılık performansına hızlı bir bakış.</p></div>
     <a className="dateChip" href="/raporlar">Son 30 gün <span>⌄</span></a>
   </section>

   <section className="dashboardLayout">
    <div className="dashboardMain">
      <section className="metricGrid dashboardMetrics">
        <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Bugünkü Satış</p><span className="metricGlyph">▢</span></div><strong className="metricValue">{moneyFull(Number(p.today_revenue||0))}</strong><p className="metricNote">{Number(p.today_orders||0)} sipariş bugün</p><div className="sparklineMini"/></article>
        <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Sipariş Sayısı</p><span className="metricGlyph">▤</span></div><strong className="metricValue">{Number(p.month_orders||0)}</strong><p className="metricNote">Son 30 gün</p><div className="sparklineMini"/></article>
        <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Kâr (Net)</p><span className="metricGlyph">↗</span></div><strong className="metricValue">{missing===0?moneyFull(net):"Bekliyor"}</strong><p className="metricNote">{missing===0?"Gerçek komisyon + kargo + maliyet":"Eksik maliyetler tamamlanmalı"}</p><div className="sparklineMini"/></article>
        <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Kâr Marjı</p><span className="metricGlyph">%</span></div><strong className="metricValue">{missing===0&&revenue30>0?`%${(net/revenue30*100).toFixed(1)}`:"—"}</strong><p className="metricNote">Son 30 gün</p><div className="sparklineMini"/></article>
      </section>

      <section className="card dashboardChartCard">
        <div className="cardHeader"><div><h2>Satış Grafiği</h2><p className="muted">Son 7 günlük ciro performansı</p></div><span className="pill">Günlük</span></div>
        <div className="lineChartMock">{daily.map((d:any,i:number)=><div className="linePointCol" key={d.day}><span className="linePoint" style={{bottom:`${Math.max(6,(Number(d.revenue)/maxDay)*82)}%`}} title={`${d.day} ${moneyFull(Number(d.revenue))}`}/><div className="lineStem" style={{height:`${Math.max(6,(Number(d.revenue)/maxDay)*82)}%`}}/><small>{d.day}</small></div>)}</div>
      </section>

      <section className="card ordersCard recentOrdersCard">
        <div className="cardHeader"><div><h2>Son Siparişler</h2><p className="muted">En yeni Trendyol siparişleri</p></div><a className="textLink" href="/siparisler">Tümünü Gör →</a></div>
        <div className="tableWrap"><table><thead><tr><th>Sipariş No</th><th>Ürün</th><th>Tarih</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>{recent.length?recent.map((o:any)=><tr key={o.marketplace_order_number}><td><strong>#{o.marketplace_order_number}</strong></td><td className="productCell">{o.products||"-"}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td><td>{moneyFull(Number(o.gross_amount))}</td><td><span className="statusPill">{o.status}</span></td></tr>):<tr><td colSpan={5} className="emptyCell">Sipariş bulunamadı.</td></tr>}</tbody></table></div>
      </section>
    </div>

    <aside className="dashboardRail">
      <section className="card railCard"><div className="cardHeader"><h2>Bildirimler</h2><a className="textLink" href="/entegrasyonlar">Tümünü Gör →</a></div><div className="notificationList"><div><span className="noticeIcon warn">!</span><p><strong>{missing} ürün satırında maliyet eksik</strong><small>Kârlılık hesabını tamamlamak için maliyetleri gir.</small></p></div><div><span className="noticeIcon info">✓</span><p><strong>Trendyol bağlantısı aktif</strong><small>Sipariş ve finans verileri senkronize ediliyor.</small></p></div><div><span className="noticeIcon good">₺</span><p><strong>30 günlük komisyon</strong><small>{moneyFull(commission)}</small></p></div></div></section>

      <section className="card railCard"><div className="cardHeader"><h2>En Çok Satan Ürünler</h2><a className="textLink" href="/urunler">Tümünü Gör →</a></div><div className="topProductList">{topProducts.length?topProducts.map((p:any,i:number)=><a key={p.id} href={`/urunler/${encodeURIComponent(p.id)}`}><span className="productRank">{i+1}</span><span className="productSummary"><strong>{p.name}</strong><small>{p.qty} adet satıldı</small></span><b>{money(Number(p.sales))}</b></a>):<p className="muted">Ürün verisi yok.</p>}</div></section>

      <section className="card railCard quickInfo"><h2>Kısa Bilgiler</h2><div className="quickGrid"><div><span>◫</span><small>30 Gün Ciro</small><strong>{money(revenue30)}</strong></div><div><span>₺</span><small>Komisyon</small><strong>{money(commission)}</strong></div><div><span>▣</span><small>Kargo</small><strong>{money(cargo)}</strong></div><div><span>↗</span><small>Net</small><strong>{missing===0?money(net):"—"}</strong></div></div></section>
    </aside>
   </section>
 </main>
}
