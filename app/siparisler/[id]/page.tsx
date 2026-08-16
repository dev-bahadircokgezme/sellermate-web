import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function money(value:number){return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value||0)}

export default async function OrderDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const sql=neon(process.env.DATABASE_URL!);

  // Different SellerMate screens historically linked to order detail using either
  // the internal order id or the Trendyol marketplace order number. Accept both so
  // old and new links remain valid and users do not land on a 404 page.
  const rows=await sql`
    SELECT id,marketplace_order_number,status,gross_amount,ordered_at,updated_at
    FROM orders
    WHERE id=${id} OR marketplace_order_number=${id}
    ORDER BY CASE WHEN id=${id} THEN 0 ELSE 1 END
    LIMIT 1`;
  const order:any=rows[0];
  if(!order) notFound();

  const orderId=String(order.id);
  const items=await sql`SELECT product_id,product_name,barcode,quantity,unit_price,cost_at_sale FROM order_items WHERE order_id=${orderId} ORDER BY id`;
  const finance=await sql`SELECT type,amount,commission_amount,seller_revenue,transaction_at FROM financial_transactions WHERE order_id=${orderId} ORDER BY transaction_at DESC`;
  const commission=finance.reduce((sum:number,r:any)=>sum+Number(r.commission_amount||0),0);
  const cargo=finance.filter((r:any)=>r.type==='Cargo').reduce((sum:number,r:any)=>sum+Number(r.amount||0),0);
  const productCost=items.reduce((sum:number,r:any)=>sum+Number(r.cost_at_sale||0)*Number(r.quantity||0),0);
  const hasCost=items.length>0 && items.every((r:any)=>Number(r.cost_at_sale||0)>0);
  const net=Number(order.gross_amount)-commission-cargo-productCost;
  const margin=Number(order.gross_amount)>0?net/Number(order.gross_amount)*100:0;

  return <main className="content">
    <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Sipariş #{order.marketplace_order_number}</h1><p className="muted">Trendyol sipariş detayları ve finans eşleşmeleri.</p></div><a className="primaryButton" href="/siparisler">Siparişlere Dön</a></header>
    <section className="metricGrid">
      <article className="card metricCard"><p className="metricLabel">Satış</p><strong className="metricValue">{money(Number(order.gross_amount))}</strong><p className="metricNote">{order.status}</p></article>
      <article className="card metricCard"><p className="metricLabel">Komisyon</p><strong className="metricValue">{money(commission)}</strong><p className="metricNote">Finans API</p></article>
      <article className="card metricCard"><p className="metricLabel">Kargo</p><strong className="metricValue">{money(cargo)}</strong><p className="metricNote">Kargo faturası</p></article>
      <article className="card metricCard"><p className="metricLabel">Net</p><strong className="metricValue">{hasCost?money(net):'Maliyet bekliyor'}</strong><p className="metricNote">{hasCost?`Marj %${margin.toFixed(1)}`:'Satış − maliyet − komisyon − kargo'}</p></article>
    </section>
    <section className="card ordersCard"><div className="cardHeader"><div><h2>Ürünler</h2><p className="muted">Siparişteki ürün satırları.</p></div></div><div className="tableWrap"><table><thead><tr><th>Ürün</th><th>Barkod</th><th>Adet</th><th>Birim Fiyat</th><th>Satış Maliyeti</th></tr></thead><tbody>{items.map((i:any,idx:number)=><tr key={idx}><td>{i.product_id?<a href={`/urunler/${encodeURIComponent(i.product_id)}`}><strong>{i.product_name}</strong></a>:i.product_name}</td><td>{i.barcode||'-'}</td><td>{i.quantity}</td><td>{money(Number(i.unit_price))}</td><td>{Number(i.cost_at_sale)>0?money(Number(i.cost_at_sale)):'Eksik'}</td></tr>)}</tbody></table></div></section>
    <section className="card ordersCard"><div className="cardHeader"><div><h2>Finans Hareketleri</h2><p className="muted">Bu siparişle eşleşen Trendyol finans kayıtları.</p></div><span className="pill">{finance.length} kayıt</span></div><div className="tableWrap"><table><thead><tr><th>Tür</th><th>Tutar</th><th>Komisyon</th><th>Hakediş</th><th>Tarih</th></tr></thead><tbody>{finance.length?finance.map((f:any,idx:number)=><tr key={idx}><td>{f.type}</td><td>{money(Number(f.amount||0))}</td><td>{money(Number(f.commission_amount||0))}</td><td>{money(Number(f.seller_revenue||0))}</td><td>{f.transaction_at?new Date(f.transaction_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'-'}</td></tr>):<tr><td colSpan={5}>Bu siparişle eşleşen finans kaydı yok.</td></tr>}</tbody></table></div></section>
  </main>
}
