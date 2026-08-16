import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const menu = [
  ["Dashboard","/","⌂"], ["Siparişler","/siparisler","▤"], ["Ürünler","/urunler","◫"],
  ["Kârlılık","/karlilik","↗"], ["Finans","/finans","₺"], ["Raporlar","/raporlar","◒"],
  ["Entegrasyonlar","/entegrasyonlar","⌁"], ["Ekip","/ekip","◎"], ["Ayarlar","/ayarlar","⚙"]
];

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(value)}
function moneyFull(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value)}

export default async function Home(){
 const sql=neon(process.env.DATABASE_URL!);

 let p:any={today_orders:0,today_revenue:0,week_orders:0,week_revenue:0,month_orders:0,month_revenue:0};
 let finance:any={commission:0,cargo:0};
 let cost:any={product_cost:0,missing:1};
 let daily:any[]=[];
 let recent:any[]=[];

 try {
   const rows:any=await sql`SELECT COUNT(*) FILTER (WHERE ordered_at>=date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul'))::int today_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')),0)::float today_revenue,COUNT(*) FILTER (WHERE ordered_at>=now()-interval '7 days')::int week_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=now()-interval '7 days'),0)::float week_revenue,COUNT(*) FILTER (WHERE ordered_at>=now()-interval '30 days')::int month_orders,COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at>=now()-interval '30 days'),0)::float month_revenue FROM orders`;
   p=rows[0]||p;
 } catch {}

 try {
   const rows:any=await sql`SELECT COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float commission,COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float cargo FROM financial_transactions WHERE transaction_at>=now()-interval '30 days'`;
   finance=rows[0]||finance;
 } catch {}

 try {
   const rows:any=await sql`SELECT COALESCE(SUM(oi.quantity*p.cost),0)::float product_cost,COUNT(*) FILTER (WHERE COALESCE(p.cost,0)<=0)::int missing FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.ordered_at>=now()-interval '30 days'`;
   cost=rows[0]||cost;
 } catch {}

 try {
   daily=await sql`SELECT to_char((ordered_at AT TIME ZONE 'Europe/Istanbul')::date,'DD.MM') day,COUNT(*)::int orders,COALESCE(SUM(gross_amount),0)::float revenue FROM orders WHERE ordered_at>=now()-interval '7 days' GROUP BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date ORDER BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date` as any[];
 } catch {}

 try {
   recent=await sql`SELECT o.marketplace_order_number,o.status,o.gross_amount,o.ordered_at,COALESCE(string_agg(oi.product_name,', '),'') products FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 8` as any[];
 } catch {}

 const revenue30=Number(p?.month_revenue||0), commission=Number(finance?.commission||0), cargo=Number(finance?.cargo||0), productCost=Number(cost?.product_cost||0), missing=Number(cost?.missing||0), net=revenue30-productCost-commission-cargo;
 const maxDay=Math.max(1,...daily.map(d=>Number(d.revenue||0)));

 return <main className="shell appleShell">
  <aside className="sidebar appleSidebar">
   <a href="/" className="brandBlock"><div className="brandMark">S</div><div><div className="brand">SellerMate</div><div className="brandSub">Commerce intelligence</div></div></a>
   <nav className="nav appleNav">{menu.map(([label,href,icon],i)=><a className={i===0?"navItem active":"navItem"} href={href} key={label}><span className="navIcon">{icon}</span><span>{label}</span></a>)}</nav>
   <div className="sidebarFooter"><span className="statusDot"/><span><strong>Trendyol bağlı</strong><small>Otomatik senkron aktif</small></span></div>
  </aside>

  <section className="content appleContent">
   <header className="appleTopbar">
    <div className="topbarCrumb">SellerMate <span>/</span> Genel Bakış</div>
    <div className="topbarActions"><span className="liveBadge"><span className="statusDot"/> Canlı</span><a href="/ayarlar" className="avatarButton">SM</a></div>
   </header>

   <section className="heroPanel">
    <div><p className="eyebrow">GENEL BAKIŞ</p><h1>İşletmenin bugünkü resmi.</h1><p className="heroLead">Satış, komisyon, kargo ve kârlılık verilerini tek bakışta gör.</p></div>
    <div className="heroActionRow"><a className="primaryButton" href="/raporlar">Raporları aç</a><a className="secondaryButton" href="/siparisler">Siparişleri görüntüle</a></div>
   </section>

   <section className="metricGrid premiumMetrics">
    <article className="card metricCard accentCard"><div className="metricTop"><p className="metricLabel">Bugünkü ciro</p><span className="metricGlyph">↗</span></div><strong className="metricValue">{money(Number(p?.today_revenue||0))}</strong><p className="metricNote">{Number(p?.today_orders||0)} sipariş bugün</p></article>
    <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Son 7 gün</p><span className="metricGlyph">7</span></div><strong className="metricValue">{money(Number(p?.week_revenue||0))}</strong><p className="metricNote">{Number(p?.week_orders||0)} sipariş</p></article>
    <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Son 30 gün</p><span className="metricGlyph">30</span></div><strong className="metricValue">{money(revenue30)}</strong><p className="metricNote">{Number(p?.month_orders||0)} sipariş</p></article>
    <article className="card metricCard"><div className="metricTop"><p className="metricLabel">Net sonuç</p><span className="metricGlyph">₺</span></div><strong className="metricValue">{missing===0?money(net):"Bekliyor"}</strong><p className="metricNote">{missing===0?"30 günlük net sonuç":`${missing} ürün satırında maliyet eksik`}</p></article>
   </section>

   <section className="insightGrid">
    <article className="card analyticsCard">
      <div className="cardHeader"><div><p className="sectionKicker">SATIŞ PERFORMANSI</p><h2>Son 7 gün</h2><p className="muted">Günlük ciro eğilimi</p></div><a className="textLink" href="/raporlar">Tüm raporlar ›</a></div>
      <div className="appleChart">{daily.length?daily.map((d:any)=><div className="chartColumn" key={d.day}><div className="chartValue">{money(Number(d.revenue))}</div><div className="chartTrack"><span style={{height:`${Math.max(8,(Number(d.revenue)/maxDay)*100)}%`}}/></div><div className="chartLabel">{d.day}</div></div>):<div className="emptyState">Henüz veri yok</div>}</div>
    </article>
    <article className="card financeSnapshot">
      <div className="cardHeader"><div><p className="sectionKicker">30 GÜNLÜK MALİYET</p><h2>Finans özeti</h2></div><a className="textLink" href="/finans">Detay ›</a></div>
      <div className="snapshotRows"><div><span>Komisyon</span><strong>{moneyFull(commission)}</strong></div><div><span>Kargo</span><strong>{moneyFull(cargo)}</strong></div><div><span>Ürün maliyeti</span><strong>{missing===0?moneyFull(productCost):"Eksik"}</strong></div><div className="snapshotTotal"><span>Net sonuç</span><strong>{missing===0?moneyFull(net):"Maliyet bekliyor"}</strong></div></div>
    </article>
   </section>

   <section className="card ordersCard premiumTable">
    <div className="cardHeader"><div><p className="sectionKicker">SON HAREKETLER</p><h2>Son siparişler</h2><p className="muted">En yeni Trendyol siparişlerin</p></div><a className="secondaryButton compact" href="/siparisler">Tümünü gör</a></div>
    <div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Ürün</th><th>Satış</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>{recent.length?recent.map((o:any)=><tr key={o.marketplace_order_number}><td><strong>#{o.marketplace_order_number}</strong></td><td className="productCell">{o.products||"-"}</td><td>{moneyFull(Number(o.gross_amount))}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td><td><span className="statusPill">{o.status}</span></td></tr>):<tr><td colSpan={5} className="emptyCell">Siparişler yüklenemedi veya henüz veri yok.</td></tr>}</tbody></table></div>
   </section>
  </section>
 </main>
}
