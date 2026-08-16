import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value)}

export default async function FinancePage(){
  const sql=neon(process.env.DATABASE_URL!);
  const [totals]=await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type='Sale' THEN amount ELSE 0 END),0)::float AS sales,
      COALESCE(SUM(CASE WHEN type='Return' THEN amount ELSE 0 END),0)::float AS returns,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
      COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN seller_revenue ELSE 0 END),0)::float AS seller_revenue,
      COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo,
      COUNT(*)::int AS records
    FROM financial_transactions`;

  const typeRows=await sql`
    SELECT type, COUNT(*)::int AS records,
      COALESCE(SUM(amount),0)::float AS amount,
      COALESCE(SUM(commission_amount),0)::float AS commission,
      COALESCE(SUM(seller_revenue),0)::float AS seller_revenue
    FROM financial_transactions
    GROUP BY type
    ORDER BY records DESC, type ASC`;

  const recent=await sql`
    SELECT type,amount,commission_amount,seller_revenue,order_number,barcode,transaction_at,description
    FROM financial_transactions
    ORDER BY transaction_at DESC
    LIMIT 100`;

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Finans</h1><p className="muted">Trendyol finans ve kargo hareketlerinin tek panelde görünümü.</p></div>
      <a className="primaryButton" href="/karlilik">Kârlılık</a>
    </header>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Satış Hareketleri</p><strong className="metricValue">{money(Number(totals.sales))}</strong><p className="metricNote">Trendyol finans kayıtları</p></article>
      <article className="card metricCard"><p className="metricLabel">İade Hareketleri</p><strong className="metricValue">{money(Number(totals.returns))}</strong><p className="metricNote">İade finans hareketleri</p></article>
      <article className="card metricCard"><p className="metricLabel">Komisyon</p><strong className="metricValue">{money(Number(totals.commission))}</strong><p className="metricNote">Trendyol commissionAmount</p></article>
      <article className="card metricCard"><p className="metricLabel">Kargo</p><strong className="metricValue">{money(Number(totals.cargo))}</strong><p className="metricNote">Kargo faturası detayları</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Finans Özeti</h2><p className="muted">Hareket türlerine göre toplamlar</p></div><span className="pill">{totals.records} kayıt</span></div>
      <div className="tableWrap"><table><thead><tr><th>Tür</th><th>Kayıt</th><th>Tutar</th><th>Komisyon</th><th>Hakediş</th></tr></thead><tbody>{typeRows.map((r:any)=><tr key={r.type}><td>{r.type}</td><td>{r.records}</td><td>{money(Number(r.amount))}</td><td>{money(Number(r.commission))}</td><td>{money(Number(r.seller_revenue))}</td></tr>)}</tbody></table></div>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Son Finans Hareketleri</h2><p className="muted">En güncel 100 kayıt</p></div></div>
      <div className="tableWrap"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Sipariş</th><th>Barkod</th><th>Tutar</th><th>Komisyon</th><th>Hakediş</th></tr></thead><tbody>{recent.map((r:any,i:number)=><tr key={`${r.order_number}-${r.transaction_at}-${i}`}><td>{new Date(r.transaction_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{r.type}</td><td>{r.order_number||"-"}</td><td>{r.barcode||"-"}</td><td>{money(Number(r.amount))}</td><td>{money(Number(r.commission_amount))}</td><td>{money(Number(r.seller_revenue))}</td></tr>)}</tbody></table></div>
    </section>
  </main>
}
