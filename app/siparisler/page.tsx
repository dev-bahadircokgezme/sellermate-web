import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}

export default async function OrdersPage({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}){
  const params=await searchParams;
  const q=String(params.q||"").trim();
  const status=String(params.status||"").trim();
  const sql=neon(process.env.DATABASE_URL!);
  const statuses=await sql`SELECT DISTINCT status FROM orders WHERE status IS NOT NULL ORDER BY status`;
  const orders=await sql`
    SELECT o.id,o.marketplace_order_number,o.status,o.gross_amount,o.ordered_at,
      COALESCE(string_agg(DISTINCT oi.product_name, ', '),'') AS products,
      COALESCE(string_agg(DISTINCT oi.barcode, ', '),'') AS barcodes,
      COALESCE(SUM(oi.quantity),0)::int AS quantity
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE (${q}='' OR o.marketplace_order_number ILIKE ${`%${q}%`} OR oi.product_name ILIKE ${`%${q}%`} OR oi.barcode ILIKE ${`%${q}%`})
      AND (${status}='' OR o.status=${status})
    GROUP BY o.id
    ORDER BY o.ordered_at DESC
    LIMIT 200`;

  return <main className="content">
    <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Siparişler</h1><p className="muted">Trendyol siparişlerini ara, filtrele ve detaylarını görüntüle.</p></div><a className="primaryButton" href="/">Dashboard</a></header>
    <section className="card ordersCard">
      <form method="get" style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:10,alignItems:"end"}}>
        <label><span className="muted">Ara</span><input name="q" defaultValue={q} placeholder="Sipariş no, ürün adı veya barkod" style={{display:"block",width:"100%",marginTop:6,padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/></label>
        <label><span className="muted">Durum</span><select name="status" defaultValue={status} style={{display:"block",width:"100%",marginTop:6,padding:12,border:"1px solid #e5e7eb",borderRadius:10}}><option value="">Tüm durumlar</option>{statuses.map((s:any)=><option key={s.status} value={s.status}>{s.status}</option>)}</select></label>
        <div style={{display:"flex",gap:8}}><button className="primaryButton" type="submit">Filtrele</button><a className="primaryButton" href="/siparisler" style={{textDecoration:"none"}}>Temizle</a></div>
      </form>
    </section>
    <section className="card ordersCard"><div className="cardHeader"><div><h2>Sipariş Listesi</h2><p className="muted">En fazla 200 kayıt gösterilir.</p></div><span className="pill">{orders.length} sonuç</span></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Ürünler</th><th>Adet</th><th>Satış</th><th>Tarih</th><th>Durum</th><th></th></tr></thead><tbody>{orders.map((o:any)=><tr key={o.id}><td><strong>{o.marketplace_order_number}</strong></td><td>{o.products||"-"}</td><td>{o.quantity}</td><td>{money(Number(o.gross_amount))}</td><td>{new Date(o.ordered_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{o.status}</td><td><a href={`/siparisler/${encodeURIComponent(o.id)}`}>Detay</a></td></tr>)}</tbody></table></div></section>
  </main>
}
