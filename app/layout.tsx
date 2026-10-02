import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import OneStockContext from "@/components/OneStockContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extensions",
  description: "Extensions OneStock du site, settings et journal des appels API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Suspense>
          <header className="topbar">
            <strong>Extensions</strong>
            <Nav />
          </header>
          <main>
            <OneStockContext />
            {children}
          </main>
        </Suspense>
      </body>
    </html>
  );
}
