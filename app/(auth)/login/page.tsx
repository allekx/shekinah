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

const HIGHLIGHTS = [
  "Pedidos e atendimento",
  "Cozinha em tempo real",
  "Caixa e fechamento do dia",
];

/** Tela de LOGIN — mobile empilhado; notebook em duas colunas. */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Hero — esquerda no notebook, topo no celular */}
        <section className="relative shrink-0 overflow-hidden px-6 pt-12 pb-28 lg:flex lg:w-[min(52%,640px)] lg:shrink-0 lg:flex-col lg:justify-center lg:px-12 lg:py-16 xl:px-16">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-500 to-primary-300 lg:rounded-none"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl lg:-right-20 lg:h-72 lg:w-72"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-24 -left-8 h-40 w-40 rounded-full bg-primary-300/35 blur-2xl lg:bottom-12 lg:top-auto lg:left-1/4 lg:h-56 lg:w-56"
            aria-hidden
          />

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="mb-8 lg:mb-12">
              <BrandWordmark variant="light" iconSize="md" />
            </div>

            <h1 className="max-w-md text-[2rem] leading-tight font-bold tracking-tight text-white lg:text-[2.75rem] xl:text-[3rem]">
              Gestão do seu dia
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 lg:mt-4 lg:text-base lg:leading-relaxed">
              Pedidos, cozinha e caixa em um só lugar
            </p>

            <ul className="mt-8 hidden gap-3 lg:grid lg:grid-cols-1 xl:grid-cols-3 xl:gap-4">
              {HIGHLIGHTS.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90"
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-white/95">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Formulário — direita no notebook */}
        <section className="relative -mt-16 flex flex-1 flex-col rounded-t-[2.5rem] bg-white px-6 pt-8 pb-10 shadow-[0_-12px_40px_rgb(23_25_35_/_0.08)] lg:mt-0 lg:min-w-0 lg:flex-1 lg:justify-center lg:rounded-none lg:bg-neutral-50/80 lg:px-10 lg:py-12 lg:shadow-none xl:px-16">
          <div className="mx-auto w-full max-w-md lg:rounded-[1.75rem] lg:border lg:border-neutral-200/80 lg:bg-white lg:p-8 lg:shadow-[var(--shadow-pop)] xl:max-w-lg xl:p-10">
            <h2 className="mb-2 text-xl font-bold tracking-tight text-neutral-900 lg:text-2xl">
              Entrar no sistema
            </h2>
            <p className="mb-7 text-sm text-neutral-500">
              Use seu e-mail e senha de acesso
            </p>

            <form action={formAction} className="space-y-5">
              <div>
                <label htmlFor="email" className="sr-only">
                  E-mail
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary-500">
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
                    className="sk-input-soft sk-input-soft--icon-start h-14"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Senha
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary-500">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="sk-input-soft sk-input-soft--icon-start sk-input-soft--icon-end h-14"
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
                <p role="alert" className="sk-alert-error">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-primary-500/30 transition hover:from-primary-600 hover:to-primary-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-300 disabled:shadow-none"
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
          </div>
        </section>
      </div>
    </main>
  );
}
