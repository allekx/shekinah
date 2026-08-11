"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">
            S
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Shekinah</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acesso restrito · equipe
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-neutral-700"
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
              placeholder="user@shekinah.com"
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-neutral-700"
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
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {state?.error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white transition active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Cadastro restrito — usuários são criados pelo administrador.
        </p>
      </div>
    </main>
  );
}