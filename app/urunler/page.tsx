import { neon } from "@neondatabase/serverless";
import CostEditor from "./CostEditor";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const sql = neon(process.env.DATABASE_URL!);
  const products = await sql`
    SELECT p.id, p.barcode, p.name, p.cost,
      COUNT(oi.id)::int AS sold_lines,
      COALESCE(SUM(oi.quantity),0)::int AS sold_qty
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id=p.id
    GROUP BY p.id
    ORDER BY sold_qty DESC, p.name ASC
  `;

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Ürün Maliyetleri</h1><p className="muted">Trendyol siparişlerinden oluşan ürün kataloğu. Net kâr hesabı için alış maliyetlerini gir.</p></div>
      <a className="primaryButton" href="/">Dashboard</a>
    </header>
    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Ürünler</h2><p className="muted">Maliyet, ürünün bir adet alış maliyetidir.</p></div><span className="pill">{products.length} ürün</span></div>
      <div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Barkod</th><th>Satılan Adet</th><th>Alış Maliyeti (₺)</th></tr></thead><tbody>
        {products.map((p:any)=><tr key={p.id}><td>{p.name}</td><td>{p.barcode || "-"}</td><td>{p.sold_qty}</td><td><CostEditor id={p.id} initialCost={Number(p.cost)} /></td></tr>)}
      </tbody></table></div>
    </section>
  </main>;
}
