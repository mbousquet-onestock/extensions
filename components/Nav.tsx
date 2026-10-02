"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withContext } from "@/lib/context";

const LINKS = [
  { href: "/", label: "Extensions" },
  { href: "/settings", label: "Settings généraux" },
  { href: "/logs", label: "Logs API" },
];

export default function Nav() {
  const params = useSearchParams();
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={withContext(l.href, params)}
          className={pathname === l.href ? "active" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
