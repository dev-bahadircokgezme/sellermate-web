import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}
function pct(value:number){return `${value>=0?"+":""}%${Math.abs(value).toFixed(1)}`}
function change(current:number,previous:number){if(previous===0)return current===0?0:100;return ((current-previous)/Math.abs(previous))*100}

export default async function FinancePage({searchParams}:{searchParams:Promise<{days?:string;type?:string;q?:string}>}){
  const params=await searchParams;
  const days=Math.max(1,Math.min(365,Number(params?.days||30)||30));
  const type=String(params?.type||"all");
  const q=String(params?.q||"").trim();
  const sql=neon(process.env.DATABASE_URL!);

  const [current]:any=await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type='Sale' THEN amount ELSE 0 END),0)::float AS sales,
      COALESCE(SUM(CASE WHEN type='Return' THEN amount ELSE 0 END),0)::float AS returns,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN seller_revenue ELSE 0 END),0)::float AS seller_revenue,
      COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo,
      COUNT(*)::int AS records,
      COUNT(*) FILTER (WHERE type='Sale')::int AS sale_records,
      COUNT(*) FILTER (WHERE type='Return')::int AS return_records
    FROM financial_transactions
    WHERE transaction_at >= now() - (${days}::text || ' days')::interval`;

  const [previous]:any=await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type='Sale' THEN amount ELSE 0 END),0)::float AS sales,
      COALESCE(SUM(CASE WHEN type='Return' THEN amount ELSE 0 END),0)::float AS returns,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN seller_revenue ELSE 0 END),0)::float AS seller_revenue,
      COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
    FROM financial_transactions
    WHERE transaction_at >= now() - (${days*2}::text || ' days')::interval
      AND transaction_at < now() - (${days}::text || ' days')::interval`;

  const typeRows=await sql`
    SELECT type, COUNT(*)::int AS records,
      COALESCE(SUM(amount),0)::float AS amount,
      COALESCE(SUM(commission_amount),0)::float AS commission,
      COALESCE(SUM(seller_revenue),0)::float AS seller_revenue
    FROM financial_transactions
    WHERE transaction_at >= now() - (${days}::text || ' days')::interval
    GROUP BY type
    ORDER BY records DESC,type ASC`;

  const availableTypes=await sql`SELECT DISTINCT type FROM financial_transactions ORDER BY type ASC`;

  const recent=await sql`
    SELECT type,amount,commission_amount,seller_revenue,order_number,barcode,transaction_at,description
    FROM financial_transactions
    WHERE transaction_at >= now() - (${days}::text || ' days')::interval
      AND (${type}='all' OR type=${type})
      AND (${q}='' OR COALESCE(order_number,'') ILIKE ${'%'+q+'%'} OR COALESCE(barcode,'') ILIKE ${'%'+q+'%'} OR COALESCE(description,'') ILIKE ${'%'+q+'%'})
    ORDER BY transaction_at DESC
    LIMIT 200`;

  const daily=await sql`
    SELECT to_char((transaction_at AT TIME ZONE 'Europe/Istanbul')::date,'DD.MM') AS day,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN seller_revenue ELSE 0 END),0)::float AS seller_revenue,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
      COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo,
      COALESCE(SUM(CASE WHEN type='Return' THEN amount ELSE 0 END),0)::float AS returns
    FROM financial_transactions
    WHERE transaction_at >= now() - (${Math.min(days,30)}::text || ' days')::interval
    GROUP BY (transaction_at AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY (transaction_at AT TIME ZONE 'Europe/Istanbul')::date DESC`;

  const sales=Number(current?.sales||0), returns=Number(current?.returns||0), commission=Number(current?.commission||0), sellerRevenue=Number(current?.seller_revenue||0), cargo=Number(current?.cargo||0);
  const prevSales=Number(previous?.sales||0), prevCommission=Number(previous?.commission||0), prevSellerRevenue=Number(previous?.seller_revenue||0), prevCargo=Number(previous?.cargo||0);
  const returnAbs=Math.abs(returns);
  const returnRate=sales>0?returnAbs/sales*100:0;
  const estimatedNetPayout=sellerRevenue-cargo;
  const prevEstimated=prevSellerRevenue-prevCargo;

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Finans</h1><p className="muted">Trendyol finans hareketleri, hakediş, iade etkisi ve dönem karşılaştırması.</p></div>
      <a className="primaryButton" href="/karlilik">Kârlılık</a>
    </header>

    <section className="card ordersCard" style={{marginTop:0}}>
      <form method="get" style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <select name="days" defaultValue={String(days)} style={{padding:"10px 12px"}}><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="365">Son 365 gün</option></select>
        <select name="type" defaultValue={type} style={{padding:"10px 12px"}}><option value="all">Tüm hareketler</option>{availableTypes.map((r:any)=><option key={r.type} value={r.type}>{r.type}</option>)}</select>
        <input name="q" defaultValue={q} placeholder="Sipariş, barkod veya açıklama ara" style={{minWidth:260,padding:"10px 12px"}}/>
        <button className="primaryButton" type="submit">Uygula</button>
        {(q||type!=="all"||days!==30)&&<a className="primaryButton" href="/finans" style={{background:"#6e6e73"}}>Temizle</a>}
      </form>
    </section>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Satış Hareketleri</p><strong className="metricValue">{money(sales)}</strong><p className="metricNote">Önceki döneme göre {pct(change(sales,prevSales))}</p></article>
      <article className="card metricCard"><p className="metricLabel">Hesaplanan Hakediş</p><strong className="metricValue">{money(sellerRevenue)}</strong><p className="metricNote">Önceki döneme göre {pct(change(sellerRevenue,prevSellerRevenue))}</p></article>
      <article className="card metricCard"><p className="metricLabel">Komisyon</p><strong className="metricValue">{money(commission)}</strong><p className="metricNote">Önceki döneme göre {pct(change(commission,prevCommission))}</p></article>
      <article className="card metricCard"><p className="metricLabel">Kargo Sonrası Tahmini Net</p><strong className="metricValue">{money(estimatedNetPayout)}</strong><p className="metricNote">Hakediş − kargo · değişim {pct(change(estimatedNetPayout,prevEstimated))}</p></article>
    </section>

    <section className="metricGrid" style={{marginTop:14}}>
      <article className="card metricCard"><p className="metricLabel">İade Etkisi</p><strong className="metricValue">{money(returnAbs)}</strong><p className="metricNote">Satış hareketlerine oranı %{returnRate.toFixed(1)}</p></article>
      <article className="card metricCard"><p className="metricLabel">İade Kaydı</p><strong className="metricValue">{Number(current?.return_records||0)}</strong><p className="metricNote">{Number(current?.sale_records||0)} satış hareketine karşı</p></article>
      <article className="card metricCard"><p className="metricLabel">Kargo</p><strong className="metricValue">{money(cargo)}</strong><p className="metricNote">Önceki döneme göre {pct(change(cargo,prevCargo))}</p></article>
      <article className="card metricCard"><p className="metricLabel">Finans Kaydı</p><strong className="metricValue">{Number(current?.records||0)}</strong><p className="metricNote">Son {days} günlük hareket</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Günlük Finans Akışı</h2><p className="muted">Son {Math.min(days,30)} gün için hakediş, komisyon, kargo ve iade etkisi.</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>Gün</th><th>Hakediş</th><th>Komisyon</th><th>Kargo</th><th>İade</th><th>Kargo Sonrası</th></tr></thead><tbody>{daily.length?daily.map((r:any)=><tr key={r.day}><td>{r.day}</td><td>{money(Number(r.seller_revenue))}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.cargo))}</td><td>{money(Math.abs(Number(r.returns)))}</td><td>{money(Number(r.seller_revenue)-Number(r.cargo))}</td></tr>):<tr><td colSpan={6} className="emptyCell">Bu dönem için finans hareketi yok.</td></tr>}</tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Hareket Türü Özeti</h2><p className="muted">Seçilen dönemde hareket türlerine göre toplamlar.</p></div><span className="pill">{typeRows.length} tür</span></div>
      <div className="tableWrap"><table><thead><tr><th>Tür</th><th>Kayıt</th><th>Tutar</th><th>Komisyon</th><th>Hakediş</th></tr></thead><tbody>{typeRows.map((r:any)=><tr key={r.type}><td>{r.type}</td><td>{r.records}</td><td>{money(Number(r.amount))}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.seller_revenue))}</td></tr>)}</tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Finans Hareketleri</h2><p className="muted">Filtreye uyan en güncel {recent.length} kayıt.</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Sipariş</th><th>Barkod</th><th>Tutar</th><th>Komisyon</th><th>Hakediş</th></tr></thead><tbody>{recent.length?recent.map((r:any,i:number)=><tr key={`${r.order_number}-${r.transaction_at}-${i}`}><td>{new Date(r.transaction_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{r.type}</td><td>{r.order_number?<a href={`/siparisler/${r.order_number}`}><strong>{r.order_number}</strong></a>:"-"}</td><td>{r.barcode||"-"}</td><td>{money(Number(r.amount))}</td><td>{money(Number(r.commission_amount))}</td><td>{money(Number(r.seller_revenue))}</td></tr>):<tr><td colSpan={7} className="emptyCell">Filtreye uygun finans hareketi bulunamadı.</td></tr>}</tbody></table></div>
    </section>

    <section className="card ordersCard"><p className="muted" style={{margin:0}}><strong>Not:</strong> “Kargo sonrası tahmini net”, Trendyol sellerRevenue toplamından SellerMate'e aktarılan kargo faturalarının çıkarılmasıyla hesaplanır. Bankaya gerçekleşmiş ödeme veya henüz bekleyen ödeme bilgisini Trendyol ödeme takvimi verisi olmadan kesin ödeme statüsü olarak göstermiyoruz.</p></section>
  </main>
}
