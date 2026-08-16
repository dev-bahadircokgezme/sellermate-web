import type { Metadata } from "next";
import "./globals.css";
import AppFrame from "./AppFrame";

export const metadata: Metadata = {
  title: "SellerMate",
  description: "Pazaryeri satış, sipariş ve kârlılık yönetim paneli",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body><AppFrame>{children}</AppFrame></body>
    </html>
  );
}
