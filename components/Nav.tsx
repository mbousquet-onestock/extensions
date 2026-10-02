"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withContext } from "@/lib/context";
import { getT, type MessageKey } from "@/lib/i18n";

const LINKS: { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.extensions" },
  { href: "/settings", label: "nav.settings" },
  { href: "/logs", label: "nav.logs" },
];

export default function Nav() {
  const params = useSearchParams();
  const pathname = usePathname();
  const t = getT(params.get("lang"));
  return (
    <nav>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={withContext(l.href, params)}
          className={pathname === l.href ? "active" : undefined}
        >
          {t(l.label)}
        </Link>
      ))}
    </nav>
  );
}
