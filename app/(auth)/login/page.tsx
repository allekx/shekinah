"use client";

import { useActionState, useState } from "react";
import BrandWordmark from "@/components/brand-wordmark";
import { login } from "@/lib/auth/actions";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M5.5 7.5L12 12.25l6.5-4.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 10V8a4 4 0 118 0v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M3 12s3.5-6 9-6c2.1 0 3.85.9 5.15 2.1M21 12s-3.5 6-9 6c-2.1 0-3.85-.9-5.15-2.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Tela de LOGIN — visual moderno (mesma autenticação). */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-screen flex-col bg-white">
      {/* Hero com gradiente laranja */}
      <section className="relative shrink-0 overflow-hidden px-6 pt-12 pb-28">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#FF8A4F] via-[#FF9F60] to-[#FFC176]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-24 -left-8 h-40 w-40 rounded-full bg-[#FFC176]/35 blur-2xl"
          aria-hidden
        />

        <div className="relative">
          <div className="mb-10">
            <BrandWordmark variant="light" iconSize="md" />
          </div>

          <h1 className="max-w-xs text-[2rem] leading-tight font-bold tracking-tight text-white">
            Gestão do seu dia
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/80">
            Pedidos, cozinha e caixa em um só lugar
          </p>
        </div>
      </section>

      {/* Card do formulário */}
      <section className="relative -mt-16 flex flex-1 flex-col rounded-t-[2.5rem] bg-white px-6 pt-8 pb-8 shadow-[0_-12px_40px_rgb(23_25_35_/_0.08)]">
        <h2 className="mb-7 text-xl font-bold tracking-tight text-neutral-900">
          Entrar no sistema
        </h2>

        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="email" className="sr-only">
              E-mail
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#FF8A4F]">
                <MailIcon />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                placeholder="usuario@shekinah.com"
                className="h-14 w-full rounded-2xl border-0 bg-neutral-100 pr-4 pl-12 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:shadow-[0_0_0_3px_rgb(255_138_79_/_0.22)] focus:ring-2 focus:ring-[#FF8A4F]/35"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Senha
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#FF8A4F]">
                <LockIcon />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="h-14 w-full rounded-2xl border-0 bg-neutral-100 pr-12 pl-12 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:shadow-[0_0_0_3px_rgb(255_138_79_/_0.22)] focus:ring-2 focus:ring-[#FF8A4F]/35"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:text-neutral-600 active:bg-neutral-100"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {state?.error && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF8A4F] to-[#E87245] text-sm font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-[#FF8A4F]/30 transition hover:from-[#F07A42] hover:to-[#D96A38] active:scale-[0.99] disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-300 disabled:shadow-none"
          >
            {pending ? (
              <>
                <span className="sk-spinner" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center text-xs leading-relaxed text-neutral-400">
          Acesso restrito · usuários são criados pelo administrador
        </p>
      </section>
    </main>
  );
}
