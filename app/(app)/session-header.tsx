"use client";

import { logout } from "@/lib/auth/actions";
import { useTransition } from "react";

/** Cabeçalho de sessão (mobile): marca, perfil e botão sair. */
export default function SessionHeader({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
            S
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-neutral-900">Shekinah</p>
            <p className="text-[11px] text-neutral-500">
              {role === "john" ? "John · Atendimento" : "Cozinha"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="hidden sm:inline">{email}</span>
          <button
            type="button"
            onClick={() => startTransition(() => void logout())}
            disabled={pending}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition active:bg-neutral-100 disabled:opacity-60"
          >
            {pending ? "Saindo…" : "Sair"}
          </button>
        </div>
      </div>
    </header>
  );
}