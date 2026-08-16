import { neon } from "@neondatabase/serverless";
import CostEditor from "./CostEditor";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}

export default async function ProductsPage({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}) {
  const params=await searchParams;
  const q=String(params?.q||"").trim();
  const status=String(params?.status||"all");
  const sql = neon(process.env.DATABASE_URL!);

  await sql`CREATE TABLE IF NOT EXISTS product_cost_history (
    id bigserial PRIMARY KEY,
    product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_cost numeric(14,2) NOT NULL DEFAULT 0,
    new_cost numeric(14,2) NOT NULL DEFAULT 0,
    changed_at timestamptz NOT NULL DEFAULT now()
  )`;

  const products = await sql`
    WITH order_totals AS (
      SELECT order_id, COALESCE(SUM(quantity*unit_price),0)::float AS item_total
      FROM order_items GROUP BY order_id
    ), finance AS (
      SELECT order_id,
        COALESCE(SUM(CASE WHEN type IN ('Sale','Return') THEN commission_amount ELSE 0 END),0)::float AS commission,
        COALESCE(SUM(CASE WHEN type='Cargo' THEN amount ELSE 0 END),0)::float AS cargo
      FROM financial_transactions
      WHERE order_id IS NOT NULL
      GROUP BY order_id
    )
    SELECT p.id,p.barcode,p.sku,p.name,p.cost,
      COUNT(oi.id)::int AS sold_lines,
      COALESCE(SUM(oi.quantity),0)::int AS sold_qty,
      COALESCE(SUM(oi.quantity*oi.unit_price),0)::float AS sales_total,
      COALESCE(SUM(oi.quantity*COALESCE(NULLIF(oi.cost_at_sale,0),p.cost)),0)::float AS cost_total,
      COALESCE(SUM(CASE WHEN ot.item_total>0 THEN COALESCE(f.commission,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float AS commission_total,
      COALESCE(SUM(CASE WHEN ot.item_total>0 THEN COALESCE(f.cargo,0)*((oi.quantity*oi.unit_price)/ot.item_total) ELSE 0 END),0)::float AS cargo_total,
      MAX(o.ordered_at) AS last_sale_at,
      (SELECT MAX(ch.changed_at) FROM product_cost_history ch WHERE ch.product_id=p.id) AS last_cost_change
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id=p.id
    LEFT JOIN orders o ON o.id=oi.order_id
    LEFT JOIN order_totals ot ON ot.order_id=oi.order_id
    LEFT JOIN finance f ON f.order_id=oi.order_id
    WHERE (${q}='' OR p.name ILIKE ${'%' + q + '%'} OR COALESCE(p.barcode,'') ILIKE ${'%' + q + '%'} OR COALESCE(p.sku,'') ILIKE ${'%' + q + '%'})
      AND (${status}='all' OR (${status}='pending' AND COALESCE(p.cost,0)<=0) OR (${status}='ready' AND COALESCE(p.cost,0)>0))
    GROUP BY p.id
    ORDER BY sold_qty DESC,p.name ASC
  `;

  const [summary]:any=await sql`
    SELECT COUNT(*)::int total,
      COUNT(*) FILTER (WHERE COALESCE(cost,0)>0)::int ready,
      COUNT(*) FILTER (WHERE COALESCE(cost,0)<=0)::int pending
    FROM products`;

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Ürünler ve Kârlılık</h1><p className="muted">Ürün maliyetlerini yönet; gerçek Trendyol komisyonu ve kargo payıyla ürün bazında net sonucu gör.</p></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a className="secondaryButton" href="/urunler/riskler">Ürün Riskleri</a><a className="primaryButton" href="/">Dashboard</a></div>
    </header>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Toplam Ürün</p><strong className="metricValue">{Number(summary?.total||0)}</strong><p className="metricNote">SellerMate ürün kataloğu</p></article>
      <article className="card metricCard"><p className="metricLabel">Maliyeti Hazır</p><strong className="metricValue">{Number(summary?.ready||0)}</strong><p className="metricNote">Net kâr hesabına hazır</p></article>
      <article className="card metricCard"><p className="metricLabel">Maliyet Bekleyen</p><strong className="metricValue">{Number(summary?.pending||0)}</strong><p className="metricNote">Daha sonra tamamlanabilir</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Ürün Kataloğu</h2><p className="muted">Komisyon ve kargo, aynı siparişteki ürünlerin satış tutarı oranında dağıtılır.</p></div><span className="pill">{products.length} sonuç</span></div>
      <form method="get" style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
        <input name="q" defaultValue={q} placeholder="Ürün, barkod veya SKU ara" style={{minWidth:280,padding:"10px 12px"}}/>
        <select name="status" defaultValue={status} style={{padding:"10px 12px"}}>
          <option value="all">Tüm ürünler</option><option value="pending">Maliyet bekleyen</option><option value="ready">Maliyeti hazır</option>
        </select>
        <button className="primaryButton" type="submit">Filtrele</button>
        {(q||status!=="all")&&<a className="primaryButton" href="/urunler" style={{background:"#6e6e73"}}>Temizle</a>}
      </form>

      <div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Barkod / SKU</th><th>Satılan</th><th>Satış</th><th>Komisyon</th><th>Kargo</th><th>Net Sonuç</th><th>Alış Maliyeti</th></tr></thead><tbody>
        {products.length===0?<tr><td colSpan={8} className="emptyCell">Aramana uygun ürün bulunamadı.</td></tr>:products.map((p:any)=>{
          const sales=Number(p.sales_total||0);const costTotal=Number(p.cost_total||0);const cost=Number(p.cost||0);const commission=Number(p.commission_total||0);const cargo=Number(p.cargo_total||0);const net=sales-costTotal-commission-cargo;
          return <tr key={p.id}>
            <td><a href={`/urunler/${encodeURIComponent(p.id)}`}><strong>{p.name}</strong></a>{p.last_sale_at&&<div className="metricNote">Son satış: {new Date(p.last_sale_at).toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"})}</div>}</td>
            <td>{p.barcode||p.sku||"-"}</td><td>{p.sold_qty}</td><td>{money(sales)}</td><td>{money(commission)}</td><td>{money(cargo)}</td>
            <td><strong>{cost>0?money(net):"Maliyet bekliyor"}</strong></td>
            <td><CostEditor id={p.id} initialCost={cost}/></td>
          </tr>})}
      </tbody></table></div>
    </section>
  </main>;
}
