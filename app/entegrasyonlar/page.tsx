import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function dateText(value:any){
  if(!value) return "Henüz senkronize edilmedi";
  return new Date(value).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"});
}

export default async function IntegrationsPage(){
  const sql=neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS sync_runs (
    id bigserial PRIMARY KEY,
    source text NOT NULL DEFAULT 'TRENDYOL',
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    success boolean,
    successful_jobs integer NOT NULL DEFAULT 0,
    failed_jobs integer NOT NULL DEFAULT 0,
    details jsonb
  )`;
  const accounts=await sql`SELECT id,marketplace,seller_id,display_name,active,last_sync_at,created_at FROM marketplace_accounts ORDER BY created_at ASC`;
  const trendyol=accounts.find((a:any)=>String(a.marketplace).toUpperCase()==="TRENDYOL");
  const [orderStats]=await sql`SELECT COUNT(*)::int AS orders, MAX(updated_at) AS latest_order_update FROM orders WHERE marketplace_account_id='trendyol-main'`;
  const [financeStats]=await sql`SELECT COUNT(*)::int AS records, MAX(transaction_at) AS latest_finance FROM financial_transactions WHERE marketplace_account_id='trendyol-main'`;
  const syncRuns=await sql`SELECT id,started_at,finished_at,success,successful_jobs,failed_jobs FROM sync_runs ORDER BY started_at DESC LIMIT 10`;

  const future=[
    {name:"Hepsiburada",code:"HEPSIBURADA",note:"Sipariş, ürün, stok ve finans entegrasyonu için hazırlanacak."},
    {name:"N11",code:"N11",note:"Sipariş ve ürün yönetimi için sonraki pazaryeri."},
    {name:"Amazon Türkiye",code:"AMAZON_TR",note:"Amazon SP-API bağlantısı ileride eklenebilir."},
  ];

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Entegrasyonlar</h1><p className="muted">Pazaryeri hesaplarının bağlantı ve senkronizasyon durumunu tek ekrandan takip et.</p></div>
      <a className="primaryButton" href="/">Dashboard</a>
    </header>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Aktif Pazaryerleri</h2><p className="muted">Şu anda gerçek verilerle çalışan bağlantılar.</p></div><span className="pill">{accounts.filter((a:any)=>a.active).length} aktif</span></div>
      <div className="integrationRow">
        <div className="marketLogo">TY</div>
        <div className="integrationInfo">
          <strong>{trendyol?.display_name || "Trendyol"}</strong>
          <span>Satıcı ID: {trendyol?.seller_id || "-"}</span>
          <span>Son senkronizasyon: {dateText(trendyol?.last_sync_at)}</span>
        </div>
        <span className="connectionBadge">Bağlı</span>
      </div>
      <div className="metricGrid" style={{marginTop:16}}>
        <article className="card metricCard"><p className="metricLabel">Sipariş</p><strong className="metricValue">{Number(orderStats.orders)}</strong><p className="metricNote">SellerMate veritabanındaki Trendyol siparişleri</p></article>
        <article className="card metricCard"><p className="metricLabel">Finans Kaydı</p><strong className="metricValue">{Number(financeStats.records)}</strong><p className="metricNote">Komisyon, iade, kargo ve diğer hareketler</p></article>
        <article className="card metricCard"><p className="metricLabel">Son Sipariş Güncellemesi</p><strong className="metricValue" style={{fontSize:18}}>{dateText(orderStats.latest_order_update)}</strong><p className="metricNote">Sipariş veritabanı</p></article>
        <article className="card metricCard"><p className="metricLabel">Son Finans Hareketi</p><strong className="metricValue" style={{fontSize:18}}>{dateText(financeStats.latest_finance)}</strong><p className="metricNote">Finans veritabanı</p></article>
      </div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Otomatik Senkronizasyon Geçmişi</h2><p className="muted">Vercel Cron tarafından çalıştırılan son Trendyol senkronizasyonları.</p></div><span className="pill">Günlük 06:00 TR</span></div>
      <div className="tableWrap"><table><thead><tr><th>Başlangıç</th><th>Bitiş</th><th>Başarılı İş</th><th>Hatalı İş</th><th>Durum</th></tr></thead><tbody>
        {syncRuns.length===0?<tr><td colSpan={5} className="emptyCell">Henüz otomatik senkronizasyon çalışmadı.</td></tr>:syncRuns.map((r:any)=><tr key={r.id}><td>{dateText(r.started_at)}</td><td>{dateText(r.finished_at)}</td><td>{Number(r.successful_jobs)}</td><td>{Number(r.failed_jobs)}</td><td>{r.success===true?"Başarılı":r.success===false?"Hata":"Çalışıyor"}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Sıradaki Entegrasyonlar</h2><p className="muted">Altyapı çoklu pazaryeri mantığıyla hazırlanıyor. Bu bağlantıları daha sonra ekleyebiliriz.</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>Pazaryeri</th><th>Durum</th><th>Plan</th></tr></thead><tbody>
        {future.map(item=><tr key={item.code}><td>{item.name}</td><td>Hazır değil</td><td>{item.note}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Trendyol Senkronizasyon Araçları</h2><p className="muted">Gerekirse verileri manuel olarak yenileyebilirsin.</p></div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
        <a className="primaryButton" href="/api/trendyol/order-history-sync">Siparişleri Yenile</a>
        <a className="primaryButton" href="/api/trendyol/finance-full-sync">Finansı Yenile</a>
        <a className="primaryButton" href="/api/trendyol/cargo-sync">Kargoyu Yenile</a>
        <a className="primaryButton" href="/api/products/sync">Ürünleri Yenile</a>
      </div>
    </section>
  </main>;
}
