import { getTrendyolOrders } from "../../src/lib/trendyol";

export const dynamic = "force-dynamic";

type OrderLine = { productName?: string; merchantSku?: string; barcode?: string; quantity?: number; price?: number; amount?: number };
type Order = { id?: number; orderNumber?: string; status?: string; orderDate?: number; grossAmount?: number; totalPrice?: number; lines?: OrderLine[] };

function money(value: number | undefined) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value ?? 0);
}

export default async function OrdersPage() {
  let orders: Order[] = [];
  let error = "";
  try {
    const data = await getTrendyolOrders(50);
    orders = Array.isArray(data?.content) ? data.content : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Siparişler alınamadı";
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#6b7280" }}>SellerMate / Trendyol</p>
        <h1 style={{ marginTop: 8 }}>Gerçek Siparişler</h1>
        <p style={{ color: "#6b7280" }}>Trendyol hesabından alınan son {orders.length} sipariş paketi.</p>
        {error && <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>Bağlantı hatası: {error}</div>}
        {!error && orders.length === 0 && <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>Gösterilecek sipariş bulunamadı.</div>}
        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((order, index) => {
            const firstLine = order.lines?.[0];
            const amount = order.grossAmount ?? order.totalPrice ?? order.lines?.reduce((sum, line) => sum + (line.amount ?? line.price ?? 0) * (line.quantity ?? 1), 0) ?? 0;
            return (
              <article key={String(order.id ?? order.orderNumber ?? index)} style={{ background: "white", padding: 20, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                  <div><strong>#{order.orderNumber ?? order.id ?? "-"}</strong><div style={{ color: "#6b7280", marginTop: 6 }}>{firstLine?.productName ?? "Sipariş"}{(order.lines?.length ?? 0) > 1 ? ` +${(order.lines?.length ?? 1) - 1} ürün` : ""}</div></div>
                  <div><strong>{money(amount)}</strong><div style={{ color: "#6b7280", marginTop: 6 }}>{order.status ?? "-"}</div></div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
