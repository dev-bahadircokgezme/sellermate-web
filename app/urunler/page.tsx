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

  const pending = products.filter((p:any) => Number(p.cost) <= 0);
  const completed = products.filter((p:any) => Number(p.cost) > 0);

  const ProductTable = ({ rows }: { rows: any[] }) => (
    <div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Barkod</th><th>Satılan Adet</th><th>Alış Maliyeti (₺)</th><th>Durum</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan={5} className="emptyCell">Bu bölümde ürün yok.</td></tr> : rows.map((p:any)=><tr key={p.id}><td>{p.name}</td><td>{p.barcode || "-"}</td><td>{p.sold_qty}</td><td><CostEditor id={p.id} initialCost={Number(p.cost)} /></td><td>{Number(p.cost) > 0 ? "Kaydedildi" : "Sonra girilecek"}</td></tr>)}
    </tbody></table></div>
  );

  return <main className="content">
    <header className="topbar">
      <div><p className="eyebrow">SELLERMATE</p><h1>Ürün Maliyetleri</h1><p className="muted">Alış maliyetlerini şimdi girmek zorunda değilsin. Boş bıraktığın ürünler otomatik olarak “Sonra Girilecek” bölümünde tutulur.</p></div>
      <a className="primaryButton" href="/">Dashboard</a>
    </header>

    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Toplam Ürün</p><strong className="metricValue">{products.length}</strong><p className="metricNote">Trendyol siparişlerinden oluşturuldu</p></article>
      <article className="card metricCard"><p className="metricLabel">Maliyeti Girilen</p><strong className="metricValue">{completed.length}</strong><p className="metricNote">Kâr hesabına hazır</p></article>
      <article className="card metricCard"><p className="metricLabel">Sonra Girilecek</p><strong className="metricValue">{pending.length}</strong><p className="metricNote">İstediğin zaman tamamlayabilirsin</p></article>
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Sonra Girilecek Maliyetler</h2><p className="muted">Maliyeti henüz girilmeyen ürünler burada kalır. Daha sonra gelip tek tek kaydedebilirsin.</p></div><span className="pill">{pending.length} bekliyor</span></div>
      <ProductTable rows={pending} />
    </section>

    <section className="card ordersCard">
      <div className="cardHeader"><div><h2>Kaydedilmiş Maliyetler</h2><p className="muted">Daha önce maliyet bilgisi girilmiş ürünler.</p></div><span className="pill">{completed.length} kayıtlı</span></div>
      <ProductTable rows={completed} />
    </section>
  </main>;
}
