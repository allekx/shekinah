"use client";

import BrandWordmark from "@/components/brand-wordmark";
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
    <header className="sticky top-0 z-10 border-b border-neutral-200/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <BrandWordmark
          variant="dark"
          iconSize="sm"
          subtitle={role === "john" ? "John · Atendimento" : "Cozinha"}
        />

        <button
          type="button"
          onClick={() => startTransition(() => void logout())}
          disabled={pending}
          className="sk-btn-ghost text-xs"
        >
          {pending ? "Saindo…" : "Sair"}
        </button>
      </div>
      {/* faixa sutil de identidade */}
      <div className="h-0.5 w-full bg-gradient-to-r from-[#2e54c9] via-[#3f6ee0]/60 to-transparent" />
    </header>
  );
}