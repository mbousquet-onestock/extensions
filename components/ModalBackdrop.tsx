"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Fond de modale : ferme sur Échap ou clic à l'extérieur. */
export default function ModalBackdrop({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push(closeHref, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
