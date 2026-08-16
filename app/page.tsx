const metrics = [
  { label: "Bugünkü Ciro", value: "₺0,00", note: "Trendyol bağlantısı bekleniyor" },
  { label: "Tahmini Net Kâr", value: "₺0,00", note: "Maliyet ve kesintilerle hesaplanacak" },
  { label: "Sipariş", value: "0", note: "Bugün" },
  { label: "Net Kâr Marjı", value: "%0,0", note: "Kesinleşen finans verileriyle" },
];

const menu = [
  "Dashboard",
  "Siparişler",
  "Ürünler",
  "Kârlılık",
  "Finans",
  "Raporlar",
  "Entegrasyonlar",
  "Ekip",
  "Ayarlar",
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">SellerMate</div>
          <div className="brandSub">Marketplace Control Center</div>
        </div>

        <nav className="nav">
          {menu.map((item, index) => (
            <a className={index === 0 ? "navItem active" : "navItem"} href="#" key={item}>
              {item}
            </a>
          ))}
        </nav>

        <div className="sidebarFooter">
          <span className="statusDot" />
          Sistem kurulumu devam ediyor
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SELLERMATE</p>
            <h1>Satış ve Kârlılık Dashboard</h1>
            <p className="muted">Tüm pazaryeri performansını tek merkezden yönetin.</p>
          </div>
          <button className="primaryButton">Trendyol&apos;u Bağla</button>
        </header>

        <section className="metricGrid">
          {metrics.map((metric) => (
            <article className="card metricCard" key={metric.label}>
              <p className="metricLabel">{metric.label}</p>
              <strong className="metricValue">{metric.value}</strong>
              <p className="metricNote">{metric.note}</p>
            </article>
          ))}
        </section>

        <section className="dashboardGrid">
          <article className="card chartCard">
            <div className="cardHeader">
              <div>
                <h2>Satış Özeti</h2>
                <p className="muted">Gerçek siparişler bağlandığında günlük ciro burada görünecek.</p>
              </div>
              <span className="pill">Son 30 gün</span>
            </div>
            <div className="emptyChart">
              <div className="bars" aria-hidden="true">
                {[30, 48, 36, 62, 55, 77, 68, 86, 72, 92, 80, 100].map((height, index) => (
                  <span style={{ height: `${height}%` }} key={index} />
                ))}
              </div>
              <p>Trendyol entegrasyonu sonrası gerçek veriler otomatik işlenecek.</p>
            </div>
          </article>

          <article className="card integrationCard">
            <div className="cardHeader">
              <div>
                <h2>Entegrasyon Durumu</h2>
                <p className="muted">İlk kanal</p>
              </div>
            </div>
            <div className="integrationRow">
              <div className="marketLogo">TY</div>
              <div className="integrationInfo">
                <strong>Trendyol</strong>
                <span>Henüz bağlı değil</span>
              </div>
              <span className="connectionBadge">Bağlantı bekliyor</span>
            </div>
            <div className="integrationChecklist">
              <p>✓ Sipariş senkronizasyon altyapısı</p>
              <p>✓ Ürün ve maliyet eşleştirme planı</p>
              <p>✓ Finans/kesinti hesaplama yapısı</p>
              <p className="pending">○ API kimlik bilgileri ve ilk gerçek veri testi</p>
            </div>
          </article>
        </section>

        <section className="card ordersCard">
          <div className="cardHeader">
            <div>
              <h2>Son Siparişler</h2>
              <p className="muted">Trendyol siparişleri bu tabloya aktarılacak.</p>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Ürün</th>
                  <th>Satış</th>
                  <th>Maliyet</th>
                  <th>Kesintiler</th>
                  <th>Net Kâr</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="emptyCell">Henüz senkronize edilmiş sipariş yok.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
