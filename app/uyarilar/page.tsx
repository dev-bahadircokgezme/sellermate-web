import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){
  return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0);
}

function dateText(value:any){
  if(!value) return "Bilinmiyor";
  return new Date(value).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"});
}

type AlertItem={
  level:"critical"|"warning"|"info"|"success";
  title:string;
  description:string;
  href:string;
  action:string;
};

export default async function AlertsPage(){
  const sql=neon(process.env.DATABASE_URL!);
  const alerts:AlertItem[]=[];

  let missingCosts=0;
  let lossOrders=0;
  let lossTotal=0;
  let returnCount=0;
  let saleCount=0;
  let failedSyncs=0;
  let latestSync:any=null;

  try{
    const [row]:any=await sql`SELECT COUNT(*)::int AS count FROM products WHERE COALESCE(cost,0)<=0`;
    missingCosts=Number(row?.count||0);
  }catch{}

  try{
    const [row]:any=await sql`
      WITH order_costs AS (
        SELECT o.id,
          COALESCE(SUM(oi.quantity*COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)),0)::float AS product_cost,
          COALESCE(BOOL_AND(COALESCE(NULLIF(oi.cost_at_sale,0),p.cost,0)>0),false) AS complete_cost
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id=o.id
        LEFT JOIN products p ON p.id=oi.product_id
        WHERE o.ordered_at>=now()-interval '30 days'
        GROUP BY o.id
      ), fin AS (
        SELECT order_id,
          COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
          COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
        FROM financial_transactions
        WHERE order_id IS NOT NULL
        GROUP BY order_id
      ), result AS (
        SELECT o.id,(o.gross_amount-oc.product_cost-COALESCE(fin.commission,0)-COALESCE(fin.cargo,0))::float AS net
        FROM orders o
        JOIN order_costs oc ON oc.id=o.id AND oc.complete_cost=true
        LEFT JOIN fin ON fin.order_id=o.id
        WHERE o.ordered_at>=now()-interval '30 days'
      )
      SELECT COUNT(*) FILTER (WHERE net<0)::int AS loss_orders,
             COALESCE(SUM(CASE WHEN net<0 THEN ABS(net) ELSE 0 END),0)::float AS loss_total
      FROM result`;
    lossOrders=Number(row?.loss_orders||0);
    lossTotal=Number(row?.loss_total||0);
  }catch{}

  try{
    const [row]:any=await sql`
      SELECT COUNT(*) FILTER (WHERE type='Return')::int AS returns,
             COUNT(*) FILTER (WHERE type='Sale')::int AS sales
      FROM financial_transactions
      WHERE transaction_at>=now()-interval '30 days'`;
    returnCount=Number(row?.returns||0);
    saleCount=Number(row?.sales||0);
  }catch{}

  try{
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
    const [failed]:any=await sql`SELECT COUNT(*)::int AS count FROM sync_runs WHERE success=false AND started_at>=now()-interval '7 days'`;
    const rows:any[]=await sql`SELECT started_at,finished_at,success,failed_jobs FROM sync_runs ORDER BY started_at DESC LIMIT 1` as any[];
    failedSyncs=Number(failed?.count||0);
    latestSync=rows[0]||null;
  }catch{}

  if(failedSyncs>0){
    alerts.push({level:"critical",title:`${failedSyncs} senkronizasyon hatası tespit edildi`,description:"Son 7 gündeki otomatik Trendyol senkronizasyonlarında başarısız çalışma var. Entegrasyon geçmişini kontrol et.",href:"/entegrasyonlar",action:"Senkronları kontrol et"});
  }

  if(missingCosts>0){
    alerts.push({level:"warning",title:`${missingCosts} üründe maliyet eksik`,description:"Eksik alış maliyetleri net kâr ve marj hesaplarını kesinleştirmeyi engelliyor.",href:"/urunler?status=pending",action:"Maliyetleri tamamla"});
  }

  if(lossOrders>0){
    alerts.push({level:"critical",title:`Son 30 günde ${lossOrders} zarar eden sipariş`,description:`Maliyeti tamamlanmış siparişlerde toplam yaklaşık ${money(lossTotal)} zarar tespit edildi.`,href:"/karlilik?days=30&profit=loss",action:"Zararları incele"});
  }

  const returnRate=saleCount>0?(returnCount/saleCount)*100:0;
  if(returnRate>=10){
    alerts.push({level:"warning",title:`İade oranı %${returnRate.toFixed(1)}`,description:`Son 30 günde ${returnCount} iade hareketi ve ${saleCount} satış hareketi var. İade oranı dikkat gerektiriyor.`,href:"/finans?days=30&type=Return",action:"İadeleri incele"});
  }else if(returnCount>0){
    alerts.push({level:"info",title:`Son 30 günde ${returnCount} iade hareketi`,description:`Finans kayıtlarına göre iade/satış hareket oranı %${returnRate.toFixed(1)}.`,href:"/finans?days=30&type=Return",action:"İadeleri gör"});
  }

  if(latestSync){
    const ageHours=(Date.now()-new Date(latestSync.started_at).getTime())/3600000;
    if(ageHours>36){
      alerts.push({level:"warning",title:"Otomatik senkronizasyon gecikmiş olabilir",description:`Son otomatik çalışma ${dateText(latestSync.started_at)} tarihinde başladı.`,href:"/entegrasyonlar",action:"Entegrasyonu kontrol et"});
    }
  }

  if(alerts.length===0){
    alerts.push({level:"success",title:"Kritik uyarı yok",description:"SellerMate şu anda maliyet, kârlılık, iade ve senkronizasyon kontrollerinde kritik bir problem tespit etmedi.",href:"/",action:"Dashboard'a dön"});
  }

  const critical=alerts.filter(a=>a.level==="critical").length;
  const warnings=alerts.filter(a=>a.level==="warning").length;

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Uyarı Merkezi</h1><p className="muted">Kârlılık, maliyet, iadeler ve entegrasyon sağlığı için otomatik kontroller.</p></div>
      <a className="primaryButton" href="/">Dashboard</a>
    </header>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Kritik</p><strong className="metricValue">{critical}</strong><p className="metricNote">Hızlı aksiyon gerektiren durumlar</p></article>
      <article className="card metricCard"><p className="metricLabel">Uyarı</p><strong className="metricValue">{warnings}</strong><p className="metricNote">Kontrol edilmesi önerilen durumlar</p></article>
      <article className="card metricCard"><p className="metricLabel">Maliyet Eksik</p><strong className="metricValue">{missingCosts}</strong><p className="metricNote">Kâr hesabını etkileyen ürünler</p></article>
      <article className="card metricCard"><p className="metricLabel">30 Gün İade Oranı</p><strong className="metricValue">%{returnRate.toFixed(1)}</strong><p className="metricNote">{returnCount} iade / {saleCount} satış hareketi</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Aktif Uyarılar</h2><p className="muted">Veritabanındaki güncel verilerden anlık olarak oluşturulur.</p></div><span className="pill">{alerts.length} bildirim</span></div>
      <div style={{display:"grid",gap:10,marginTop:18}}>
        {alerts.map((alert,index)=><article key={`${alert.title}-${index}`} className="integrationRow" style={{marginTop:0}}>
          <div className="marketLogo" style={{background:alert.level==="critical"?"#d70015":alert.level==="warning"?"#b25000":alert.level==="success"?"#248a3d":"#0071e3"}}>{alert.level==="critical"?"!":alert.level==="warning"?"!":alert.level==="success"?"✓":"i"}</div>
          <div className="integrationInfo"><strong>{alert.title}</strong><span>{alert.description}</span></div>
          <a className="secondaryButton compact" href={alert.href}>{alert.action}</a>
        </article>)}
      </div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Kontrol Kapsamı</h2><p className="muted">Şu anda otomatik değerlendirilen SellerMate sinyalleri.</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>Kontrol</th><th>Kriter</th><th>Yönlendirme</th></tr></thead><tbody>
        <tr><td>Eksik maliyet</td><td>Ürün maliyeti 0 veya boş</td><td>Ürünler</td></tr>
        <tr><td>Zarar eden sipariş</td><td>Satış − maliyet − komisyon − kargo &lt; 0</td><td>Kârlılık</td></tr>
        <tr><td>Yüksek iade</td><td>30 günlük iade/satış hareket oranı ≥ %10</td><td>Finans</td></tr>
        <tr><td>Senkronizasyon hatası</td><td>Son 7 günde başarısız otomatik çalışma</td><td>Entegrasyonlar</td></tr>
        <tr><td>Senkronizasyon gecikmesi</td><td>Son çalışma 36 saatten eski</td><td>Entegrasyonlar</td></tr>
      </tbody></table></div>
    </section>
  </main>;
}
