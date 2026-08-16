"use client";

import { usePathname } from "next/navigation";

const items = [
  ["Dashboard", "/", "⌂"],
  ["Siparişler", "/siparisler", "▤"],
  ["Ürünler", "/urunler", "◫"],
  ["Kârlılık", "/karlilik", "↗"],
  ["Finans", "/finans", "₺"],
  ["Raporlar", "/raporlar", "◒"],
  ["Entegrasyonlar", "/entegrasyonlar", "⌁"],
];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/giris")) return <>{children}</>;

  return (
    <div className="appFrame">
      <header className="mainNavShell">
        <div className="mainNavBar">
          <a className="navBrand" href="/" aria-label="SellerMate ana sayfa">
            <span className="navBrandMark">S</span>
            <strong>SellerMate</strong>
          </a>

          <nav className="topCenteredNav" aria-label="Ana navigasyon">
            {items.map(([label, href, icon]) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <a key={href} className={active ? "topNavItem active" : "topNavItem"} href={href}>
                  <span className="topNavIcon">{icon}</span>
                  <span>{label}</span>
                </a>
              );
            })}
          </nav>

          <div className="navUtilities">
            <a className="navUtilityButton" href="/siparisler" title="Ara">⌕</a>
            <a className={pathname.startsWith("/uyarilar")?"navUtilityButton active":"navUtilityButton"} href="/uyarilar" title="Uyarılar">♢</a>
            <a className="profileChip" href="/ayarlar"><span className="profileAvatar">SM</span><span className="profileText"><strong>SellerMate</strong><small>Yönetici</small></span><span className="chevron">⌄</span></a>
          </div>
        </div>
      </header>
      <div className="appPage">{children}</div>
    </div>
  );
}
