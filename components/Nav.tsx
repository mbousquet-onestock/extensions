"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withContext } from "@/lib/context";
import { getT, type MessageKey } from "@/lib/i18n";

const LINKS: { href: string; label: MessageKey; match: (p: string) => boolean }[] = [
  { href: "/", label: "nav.extensions", match: (p) => p === "/" || p.startsWith("/extensions") },
  { href: "/settings", label: "nav.settings", match: (p) => p === "/settings" },
  { href: "/logs", label: "nav.logs", match: (p) => p === "/logs" },
];

export default function Nav() {
  const params = useSearchParams();
  const pathname = usePathname();
  const t = getT(params.get("lang"));
  return (
    <nav className="tabs" style={{ marginBottom: 24 }}>
      {LINKS.map((l) => (
        <Link key={l.href} href={withContext(l.href, params)} className={`tab${l.match(pathname) ? " active" : ""}`}>
          {t(l.label)}
        </Link>
      ))}
    </nav>
  );
}
