import TeamManager from "./TeamManager";

export const dynamic = "force-dynamic";

const roles = [
  {name:"Yönetici", desc:"Tüm ekranları, entegrasyonları, finansı ve ekip yönetimini kullanabilir."},
  {name:"Operasyon", desc:"Dashboard, siparişler ve ürünler için erişim; finans ve yönetim ekranları kapalı."},
  {name:"Finans", desc:"Dashboard, finans, kârlılık ve raporlara erişim; ekip ve entegrasyon yönetimi kapalı."},
  {name:"Görüntüleyici", desc:"Ekranları görüntüler; veri değiştiren API işlemleri kapalı."},
];

export default function TeamPage(){
 return <main className="content">
  <header className="topbar"><div><p className="eyebrow">SELLERMATE</p><h1>Ekip</h1><p className="muted">Her ekip üyesi kendi hesabıyla giriş yapar ve rolüne göre yetkilendirilir.</p></div><span className="connectionBadge">Rol bazlı erişim aktif</span></header>
  <TeamManager />
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Rol Yetkileri</h2><p className="muted">Yetkiler oturum seviyesinde uygulanır.</p></div></div><div className="tableWrap"><table><thead><tr><th>Rol</th><th>Yetki</th></tr></thead><tbody>{roles.map(r=><tr key={r.name}><td><strong>{r.name}</strong></td><td>{r.desc}</td></tr>)}</tbody></table></div></section>
 </main>
}
