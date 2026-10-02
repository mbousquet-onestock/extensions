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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <Suspense>
          <OneStockContext />
          <div className="page">
            <Nav />
            {children}
          </div>
        </Suspense>
      </body>
    </html>
  );
}
