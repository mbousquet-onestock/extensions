import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extensions",
  description: "Extensions du site et journal des appels API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="topbar">
          <strong>Extensions</strong>
          <nav>
            <Link href="/">Extensions</Link>
            <Link href="/logs">Logs API</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
