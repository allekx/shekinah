"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

/** Tela de LOGIN — redesign visual (100% visual, mesma autenticação).
 *  Primeira impressão profissional: marca em destaque, campos com
 *  acabamento, botão como ação principal clara.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] p-5">
      <div className="w-full max-w-sm">
        {/* Marca / identidade */}
        <div className="mb-9 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#2e54c9] to-[#2844a8] text-2xl font-black text-white shadow-lg shadow-[#2e54c9]/30">
            S
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Shekinah
          </h1>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Gestão de pedidos e cozinha
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_10px_30px_rgb(23_25_35_/0.08)]">
          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-neutral-700"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                placeholder="usuario@shekinah.com"
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#2e54c9] focus:ring-4 focus:ring-[#2e54c9]/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-neutral-700"
              >
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#2e54c9] focus:ring-4 focus:ring-[#2e54c9]/10"
              />
            </div>

            {state?.error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-gradient-to-b from-[#3f6ee0] to-[#2e54c9] py-3.5 text-base font-bold text-white shadow-sm transition hover:from-[#3163d4] hover:to-[#2844a8] active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Acesso restrito · usuários são criados pelo administrador
        </p>
      </div>
    </main>
  );
}