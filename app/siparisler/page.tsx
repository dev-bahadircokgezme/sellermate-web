import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}

function bucket(status:string){
  const s=String(status||"").toLowerCase();
  if(s.includes("cancel")||s.includes("iptal")||s.includes("return")||s.includes("iade")) return "exception";
  if(s.includes("deliver")||s.includes("teslim")) return "delivered";
  if(s.includes("ship")||s.includes("kargo")) return "shipped";
  if(s.includes("pick")||s.includes("pack")||s.includes("prepare")||s.includes("hazır")) return "preparing";
  return "new";
}

export default async function OrdersPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;group?:string}>}){
  const params=await searchParams;
  const q=String(params.q||"").trim();
  const status=String(params.status||"").trim();
  const group=String(params.group||"").trim();
  const sql=neon(process.env.DATABASE_URL!);

  const statuses=await sql`SELECT DISTINCT status FROM orders WHERE status IS NOT NULL ORDER BY status`;
  const allStats=await sql`SELECT status,COUNT(*)::int AS count FROM orders GROUP BY status`;
  const totals={new:0,preparing:0,shipped:0,delivered:0,exception:0};
  allStats.forEach((r:any)=>{const b=bucket(r.status) as keyof typeof totals;totals[b]+=Number(r.count||0)});

  const [problemStats]:any=await sql`
    SELECT
      COUNT(*) FILTER (WHERE (lower(status) LIKE '%created%' OR lower(status) LIKE '%new%' OR lower(status) LIKE '%pick%' OR lower(status) LIKE '%pack%' OR lower(status) LIKE '%prepare%') AND updated_at < now()-interval '24 hours')::int AS waiting,
      COUNT(*) FILTER (WHERE (lower(status) LIKE '%ship%' OR lower(status) LIKE '%kargo%') AND updated_at < now()-interval '7 days')::int AS shipping_delay,
      COUNT(*) FILTER (WHERE lower(status) LIKE '%cancel%' OR lower(status) LIKE '%iptal%' OR lower(status) LIKE '%return%' OR lower(status) LIKE '%iade%')::int AS exceptions
    FROM orders`;

  const orders=await sql`
    SELECT o.id,o.marketplace_order_number,o.status,o.gross_amount,o.ordered_at,o.updated_at,
      COALESCE(string_agg(DISTINCT oi.product_name, ', '),'') AS products,
      COALESCE(string_agg(DISTINCT oi.barcode, ', '),'') AS barcodes,
      COALESCE(SUM(oi.quantity),0)::int AS quantity
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE (${q}='' OR o.marketplace_order_number ILIKE ${`%${q}%`} OR oi.product_name ILIKE ${`%${q}%`} OR oi.barcode ILIKE ${`%${q}%`})
      AND (${status}='' OR o.status=${status})
      AND (
        ${group}='' OR
        (${group}='new' AND NOT (lower(o.status) LIKE '%deliver%' OR lower(o.status) LIKE '%teslim%' OR lower(o.status) LIKE '%ship%' OR lower(o.status) LIKE '%kargo%' OR lower(o.status) LIKE '%pick%' OR lower(o.status) LIKE '%pack%' OR lower(o.status) LIKE '%prepare%' OR lower(o.status) LIKE '%hazır%' OR lower(o.status) LIKE '%cancel%' OR lower(o.status) LIKE '%iptal%' OR lower(o.status) LIKE '%return%' OR lower(o.status) LIKE '%iade%')) OR
        (${group}='preparing' AND (lower(o.status) LIKE '%pick%' OR lower(o.status) LIKE '%pack%' OR lower(o.status) LIKE '%prepare%' OR lower(o.status) LIKE '%hazır%')) OR
        (${group}='shipped' AND (lower(o.status) LIKE '%ship%' OR lower(o.status) LIKE '%kargo%')) OR
        (${group}='delivered' AND (lower(o.status) LIKE '%deliver%' OR lower(o.status) LIKE '%teslim%')) OR
        (${group}='exception' AND (lower(o.status) LIKE '%cancel%' OR lower(o.status) LIKE '%iptal%' OR lower(o.status) LIKE '%return%' OR lower(o.status) LIKE '%iade%')) OR
        (${group}='problem' AND (((lower(o.status) LIKE '%created%' OR lower(o.status) LIKE '%new%' OR lower(o.status) LIKE '%pick%' OR lower(o.status) LIKE '%pack%' OR lower(o.status) LIKE '%prepare%') AND o.updated_at < now()-interval '24 hours') OR ((lower(o.status) LIKE '%ship%' OR lower(o.status) LIKE '%kargo%') AND o.updated_at < now()-interval '7 days')))
      )
    GROUP BY o.id
    ORDER BY o.ordered_at DESC
    LIMIT 200`;

  return <main className="content">
    <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Sipariş Operasyonu</h1><p className="muted">Trendyol siparişlerini operasyon durumuna göre izle, gecikenleri ayır ve detaylarına ulaş.</p></div><a className="primaryButton" href="/">Dashboard</a></header>

    <section className="metricGrid">
      <a className="card metricCard" href="/siparisler?group=new"><p className="metricLabel">Yeni</p><strong className="metricValue">{totals.new}</strong><p className="metricNote">İşleme alınmayı bekleyen</p></a>
      <a className="card metricCard" href="/siparisler?group=preparing"><p className="metricLabel">Hazırlanıyor</p><strong className="metricValue">{totals.preparing}</strong><p className="metricNote">Paketleme / hazırlık aşaması</p></a>
      <a className="card metricCard" href="/siparisler?group=shipped"><p className="metricLabel">Kargoda</p><strong className="metricValue">{totals.shipped}</strong><p className="metricNote">Taşıma sürecindeki siparişler</p></a>
      <a className="card metricCard" href="/siparisler?group=delivered"><p className="metricLabel">Teslim Edildi</p><strong className="metricValue">{totals.delivered}</strong><p className="metricNote">Tamamlanan siparişler</p></a>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Operasyon Uyarıları</h2><p className="muted">Uzun süre güncellenmeyen veya istisna durumundaki siparişler.</p></div><a className="secondaryButton compact" href="/siparisler?group=problem">Gecikenleri göster</a></div>
      <div className="metricGrid" style={{marginTop:16}}>
        <article className="card metricCard"><p className="metricLabel">24+ Saat Bekleyen</p><strong className="metricValue">{Number(problemStats?.waiting||0)}</strong><p className="metricNote">Yeni / hazırlık durumunda uzun süredir güncellenmeyen</p></article>
        <article className="card metricCard"><p className="metricLabel">7+ Gün Kargoda</p><strong className="metricValue">{Number(problemStats?.shipping_delay||0)}</strong><p className="metricNote">Kargo durumunda uzun süredir güncellenmeyen</p></article>
        <a className="card metricCard" href="/siparisler?group=exception"><p className="metricLabel">İptal / İade</p><strong className="metricValue">{Number(problemStats?.exceptions||0)}</strong><p className="metricNote">Operasyon istisnaları</p></a>
      </div>
    </section>

    <section className="card ordersCard">
      <form method="get" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
        <label><span className="muted">Ara</span><input name="q" defaultValue={q} placeholder="Sipariş no, ürün adı veya barkod" style={{display:"block",width:"100%",marginTop:6,padding:12}}/></label>
        <label><span className="muted">Durum</span><select name="status" defaultValue={status} style={{display:"block",width:"100%",marginTop:6,padding:12}}><option value="">Tüm durumlar</option>{statuses.map((s:any)=><option key={s.status} value={s.status}>{s.status}</option>)}</select></label>
        <label><span className="muted">Operasyon</span><select name="group" defaultValue={group} style={{display:"block",width:"100%",marginTop:6,padding:12}}><option value="">Tümü</option><option value="new">Yeni</option><option value="preparing">Hazırlanıyor</option><option value="shipped">Kargoda</option><option value="delivered">Teslim edildi</option><option value="exception">İptal / İade</option><option value="problem">Geciken</option></select></label>
        <div style={{display:"flex",gap:8}}><button className="primaryButton" type="submit">Filtrele</button><a className="secondaryButton" href="/siparisler">Temizle</a></div>
      </form>
    </section>

    <section className="card ordersCard"><div className="cardHeader"><div><h2>Sipariş Listesi</h2><p className="muted">En fazla 200 kayıt gösterilir.</p></div><span className="pill">{orders.length} sonuç</span></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Ürünler</th><th>Adet</th><th>Satış</th><th>Sipariş Tarihi</th><th>Son Güncelleme</th><th>Durum</th><th></th></tr></thead><tbody>{orders.length?orders.map((o:any)=><tr key={o.id}><td><strong>{o.marketplace_order_number}</strong></td><td>{o.products||"-"}</td><td>{o.quantity}</td><td>{money(Number(o.gross_amount))}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{new Date(o.updated_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td><span className="statusPill">{o.status}</span></td><td><a className="textLink" href={`/siparisler/${encodeURIComponent(o.id)}`}>Detay ›</a></td></tr>):<tr><td colSpan={8} className="emptyCell">Bu filtrede sipariş bulunamadı.</td></tr>}</tbody></table></div></section>
  </main>
}
