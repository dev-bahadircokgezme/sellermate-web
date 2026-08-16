export const dynamic = "force-dynamic";

const roles = [
  {name:"Yönetici", desc:"Tüm ekranları, finans verilerini, entegrasyonları ve ekip ayarlarını yönetebilir."},
  {name:"Operasyon", desc:"Siparişler ve ürünleri görüntüleyebilir; operasyon süreçlerini takip edebilir."},
  {name:"Finans", desc:"Finans, raporlar ve kârlılık ekranlarını görüntüleyebilir."},
  {name:"Görüntüleyici", desc:"Verileri görüntüleyebilir ancak değişiklik yapamaz."},
];

export default function TeamPage(){
 return <main className="content">
  <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Ekip</h1><p className="muted">SellerMate'e erişecek ekip üyeleri ve yetki seviyeleri.</p></div><span className="connectionBadge">Ekip altyapısı hazırlanıyor</span></header>
  <section className="metricGrid">
   <article className="card metricCard"><p className="metricLabel">Çalışma Alanı</p><strong className="metricValue">SellerMate</strong><p className="metricNote">Tek şirket çalışma alanı</p></article>
   <article className="card metricCard"><p className="metricLabel">Yönetici</p><strong className="metricValue">1</strong><p className="metricNote">İlk hesap sahibi</p></article>
   <article className="card metricCard"><p className="metricLabel">Davet Sistemi</p><strong className="metricValue">Sırada</strong><p className="metricNote">E-posta ile ekip daveti</p></article>
   <article className="card metricCard"><p className="metricLabel">Yetkilendirme</p><strong className="metricValue">4 Rol</strong><p className="metricNote">Rol bazlı erişim planı</p></article>
  </section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Planlanan Roller</h2><p className="muted">Ekip arkadaşlarına ihtiyacı kadar erişim vereceğiz.</p></div></div><div className="tableWrap"><table><thead><tr><th>Rol</th><th>Yetki</th><th>Durum</th></tr></thead><tbody>{roles.map(r=><tr key={r.name}><td><strong>{r.name}</strong></td><td>{r.desc}</td><td>Hazırlanıyor</td></tr>)}</tbody></table></div></section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Güvenli Ekip Erişimi</h2><p className="muted">Bir sonraki aşamada giriş sistemi eklendiğinde uygulama herkese açık olmayacak. Her ekip üyesi kendi hesabıyla giriş yapacak ve rolüne göre ekranlara erişecek.</p></div></div></section>
 </main>
}
