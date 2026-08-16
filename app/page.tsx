import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const menu = ["Dashboard", "Siparişler", "Ürünler", "Kârlılık", "Finans", "Raporlar", "Entegrasyonlar", "Ekip", "Ayarlar"];

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);
}

function menuHref(item:string){
  if(item==="Siparişler") return "/siparisler";
  if(item==="Ürünler") return "/urunler";
  if(item==="Kârlılık") return "/karlilik";
  if(item==="Finans") return "/finans";
  if(item==="Raporlar") return "/raporlar";
  if(item==="Entegrasyonlar") return "/entegrasyonlar";
  if(item==="Ekip") return "/ekip";
  return "#";
}

export default async function Home() {
  const sql = neon(process.env.DATABASE_URL!);
  const [summary] = await sql`SELECT COUNT(*)::int AS orders, COALESCE(SUM(gross_amount),0)::float AS revenue FROM orders`;
  const [today] = await sql`SELECT COUNT(*)::int AS orders, COALESCE(SUM(gross_amount),0)::float AS revenue FROM orders WHERE ordered_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul')`;
  const recent = await sql`SELECT o.marketplace_order_number, o.status, o.gross_amount, o.ordered_at, COALESCE(string_agg(oi.product_name, ', '), '') AS products FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 10`;
  const metrics = [
    { label: "Bugünkü Ciro", value: money(Number(today.revenue)), note: `${today.orders} sipariş bugün` },
    { label: "Toplam Aktarılan Ciro", value: money(Number(summary.revenue)), note: "SellerMate veritabanındaki siparişler" },
    { label: "Aktarılan Sipariş", value: String(summary.orders), note: "Trendyol" },
    { label: "Net Kâr", value: "Kârlılık ekranında", note: "Gerçek komisyon + kargo + ürün maliyeti" },
  ];

  return <main className="shell">
    <aside className="sidebar"><div><div className="brand">SellerMate</div><div className="brandSub">Marketplace Control Center</div></div><nav className="nav">{menu.map((item,index)=><a className={index===0?"navItem active":"navItem"} href={menuHref(item)} key={item}>{item}</a>)}</nav><div className="sidebarFooter"><span className="statusDot"/> Trendyol bağlı</div></aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Satış ve Kârlılık Dashboard</h1><p className="muted">Trendyol gerçek satış verileri</p></div><span className="connectionBadge">Trendyol Bağlı</span></header>
      <section className="metricGrid">{metrics.map(m=><article className="card metricCard" key={m.label}><p className="metricLabel">{m.label}</p><strong className="metricValue">{m.value}</strong><p className="metricNote">{m.note}</p></article>)}</section>
      <section className="card ordersCard"><div className="cardHeader"><div><h2>Son Siparişler</h2><p className="muted">Neon veritabanına kaydedilen gerçek Trendyol siparişleri</p></div></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Ürün</th><th>Satış</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>{recent.map((o:any)=><tr key={o.marketplace_order_number}><td>{o.marketplace_order_number}</td><td>{o.products || "-"}</td><td>{money(Number(o.gross_amount))}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td><td>{o.status}</td></tr>)}</tbody></table></div></section>
    </section>
  </main>;
}
