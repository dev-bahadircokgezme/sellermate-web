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
  if(item==="Ayarlar") return "/ayarlar";
  return "#";
}

export default async function Home() {
  const sql = neon(process.env.DATABASE_URL!);

  const periods=await sql`
    SELECT
      COUNT(*) FILTER (WHERE ordered_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul'))::int AS today_orders,
      COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul')),0)::float AS today_revenue,
      COUNT(*) FILTER (WHERE ordered_at >= now() - interval '7 days')::int AS week_orders,
      COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at >= now() - interval '7 days'),0)::float AS week_revenue,
      COUNT(*) FILTER (WHERE ordered_at >= now() - interval '30 days')::int AS month_orders,
      COALESCE(SUM(gross_amount) FILTER (WHERE ordered_at >= now() - interval '30 days'),0)::float AS month_revenue,
      COUNT(*)::int AS total_orders,
      COALESCE(SUM(gross_amount),0)::float AS total_revenue
    FROM orders`;
  const p:any=periods[0]||{};

  const [finance30]=await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
      COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
    FROM financial_transactions
    WHERE transaction_at >= now() - interval '30 days'`;

  const [cost30]=await sql`
    SELECT
      COALESCE(SUM(oi.quantity * p.cost),0)::float AS product_cost,
      COUNT(*) FILTER (WHERE COALESCE(p.cost,0)<=0)::int AS missing_cost_lines
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    LEFT JOIN products p ON p.id=oi.product_id
    WHERE o.ordered_at >= now() - interval '30 days'`;

  const commission30=Number(finance30?.commission||0);
  const cargo30=Number(finance30?.cargo||0);
  const productCost30=Number(cost30?.product_cost||0);
  const missingCosts=Number(cost30?.missing_cost_lines||0);
  const revenue30=Number(p.month_revenue||0);
  const net30=revenue30-productCost30-commission30-cargo30;

  const daily=await sql`
    SELECT
      to_char((ordered_at AT TIME ZONE 'Europe/Istanbul')::date,'DD.MM') AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM(gross_amount),0)::float AS revenue
    FROM orders
    WHERE ordered_at >= now() - interval '7 days'
    GROUP BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY (ordered_at AT TIME ZONE 'Europe/Istanbul')::date ASC`;

  const recent = await sql`SELECT o.marketplace_order_number, o.status, o.gross_amount, o.ordered_at, COALESCE(string_agg(oi.product_name, ', '), '') AS products FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.ordered_at DESC LIMIT 10`;

  const metrics = [
    { label: "Bugünkü Ciro", value: money(Number(p.today_revenue||0)), note: `${Number(p.today_orders||0)} sipariş bugün` },
    { label: "Son 7 Gün", value: money(Number(p.week_revenue||0)), note: `${Number(p.week_orders||0)} sipariş` },
    { label: "Son 30 Gün", value: money(revenue30), note: `${Number(p.month_orders||0)} sipariş` },
    { label: "30 Gün Net Sonuç", value: missingCosts===0?money(net30):"Maliyet bekliyor", note: missingCosts===0?`Komisyon ${money(commission30)} · Kargo ${money(cargo30)}`:`${missingCosts} ürün satırında maliyet eksik` },
  ];

  return <main className="shell">
    <aside className="sidebar"><div><div className="brand">SellerMate</div><div className="brandSub">Marketplace Control Center</div></div><nav className="nav">{menu.map((item,index)=><a className={index===0?"navItem active":"navItem"} href={menuHref(item)} key={item}>{item}</a>)}</nav><div className="sidebarFooter"><span className="statusDot"/> Trendyol bağlı · 5 dk senkron</div></aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Satış ve Kârlılık Dashboard</h1><p className="muted">Trendyol gerçek satış, komisyon ve kargo verileri</p></div><span className="connectionBadge">Otomatik Senkron Aktif</span></header>
      <section className="metricGrid">{metrics.map(m=><article className="card metricCard" key={m.label}><p className="metricLabel">{m.label}</p><strong className="metricValue">{m.value}</strong><p className="metricNote">{m.note}</p></article>)}</section>

      <section className="card ordersCard">
        <div className="cardHeader"><div><h2>Son 7 Gün Satış Özeti</h2><p className="muted">Günlük sipariş ve ciro görünümü</p></div><a className="primaryButton" href="/raporlar">Detaylı Rapor</a></div>
        <div className="tableWrap"><table><thead><tr><th>Gün</th><th>Sipariş</th><th>Ciro</th></tr></thead><tbody>{daily.length?daily.map((d:any)=><tr key={d.day}><td>{d.day}</td><td>{d.orders}</td><td>{money(Number(d.revenue))}</td></tr>):<tr><td colSpan={3}>Henüz veri yok</td></tr>}</tbody></table></div>
      </section>

      <section className="card ordersCard"><div className="cardHeader"><div><h2>Son Siparişler</h2><p className="muted">Neon veritabanına kaydedilen gerçek Trendyol siparişleri</p></div><a className="primaryButton" href="/siparisler">Tüm Siparişler</a></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Ürün</th><th>Satış</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>{recent.map((o:any)=><tr key={o.marketplace_order_number}><td>{o.marketplace_order_number}</td><td>{o.products || "-"}</td><td>{money(Number(o.gross_amount))}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td><td>{o.status}</td></tr>)}</tbody></table></div></section>
    </section>
  </main>;
}
