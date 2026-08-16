export const dynamic = "force-dynamic";

export default function SettingsPage(){
 return <main className="content">
  <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Ayarlar</h1><p className="muted">Çalışma alanı, para birimi, zaman dilimi ve güvenlik ayarları.</p></div><a className="primaryButton" href="/">Dashboard</a></header>
  <section className="metricGrid">
   <article className="card metricCard"><p className="metricLabel">Çalışma Alanı</p><strong className="metricValue">SellerMate</strong><p className="metricNote">Tek şirket çalışma alanı</p></article>
   <article className="card metricCard"><p className="metricLabel">Para Birimi</p><strong className="metricValue">TRY</strong><p className="metricNote">Türk Lirası</p></article>
   <article className="card metricCard"><p className="metricLabel">Zaman Dilimi</p><strong className="metricValue">İstanbul</strong><p className="metricNote">Europe/Istanbul</p></article>
   <article className="card metricCard"><p className="metricLabel">Güvenlik</p><strong className="metricValue">Sırada</strong><p className="metricNote">Giriş ve kullanıcı yetkilendirme</p></article>
  </section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Genel Ayarlar</h2><p className="muted">Bu değerler SaaS sürümünde şirket bazında özelleştirilebilir olacak.</p></div></div><div className="tableWrap"><table><thead><tr><th>Ayar</th><th>Değer</th><th>Durum</th></tr></thead><tbody>
   <tr><td>Şirket / Çalışma Alanı Adı</td><td>SellerMate</td><td>Aktif</td></tr>
   <tr><td>Varsayılan Para Birimi</td><td>TRY</td><td>Aktif</td></tr>
   <tr><td>Zaman Dilimi</td><td>Europe/Istanbul</td><td>Aktif</td></tr>
   <tr><td>Otomatik Senkronizasyon</td><td>Planlanacak</td><td>Hazırlanıyor</td></tr>
   <tr><td>Kullanıcı Girişi</td><td>E-posta + güvenli oturum</td><td>Sonraki aşama</td></tr>
  </tbody></table></div></section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Güvenlik Notu</h2><p className="muted">Trendyol API anahtarları kullanıcı ekranında gösterilmeyecek. Sunucu tarafındaki ortam değişkenlerinde tutulmaya devam edecek.</p></div></div></section>
 </main>
}
