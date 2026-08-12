"use client";

import { logout } from "@/lib/auth/actions";
import { useTransition } from "react";

/** Cabeçalho de sessão (mobile): marca, perfil e botão sair.
 *  Redesign visual — mesmas funcionalidades.
 */
export default function SessionHeader({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#3f6ee0] to-[#2844a8] text-sm font-black text-white shadow-sm shadow-[#2e54c9]/25">
            S
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-neutral-900">
              Shekinah
            </p>
            <p className="text-[11px] font-medium text-neutral-500">
              {role === "john" ? "John · Atendimento" : "Cozinha"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => startTransition(() => void logout())}
          disabled={pending}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-800 active:translate-y-px active:bg-neutral-50 disabled:opacity-60"
        >
          {pending ? "Saindo…" : "Sair"}
        </button>
      </div>
      {/* faixa sutil de identidade */}
      <div className="h-0.5 w-full bg-gradient-to-r from-[#2e54c9] via-[#3f6ee0]/60 to-transparent" />
    </header>
  );
}