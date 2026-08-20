"use client";

import { SkNavLink } from "@/components/navigation-pending";

/** CTA da home sem dia aberto — skeleton imediato ao tocar. */
export default function StartDayLink() {
  return (
    <SkNavLink
      href="/abrir-dia"
      skeleton="open-day"
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary-500 to-primary-700 text-sm font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-primary-600/25 transition hover:from-primary-600 hover:to-primary-800 active:scale-[0.99]"
    >
      Iniciar dia
    </SkNavLink>
  );
}
