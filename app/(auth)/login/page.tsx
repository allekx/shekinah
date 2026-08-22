"use client";

import Image from "next/image";
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

/** Tela de LOGIN — mobile empilhado; notebook em duas colunas. */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Hero — esquerda no notebook (imagem full-bleed); topo no celular */}
        <section className="relative shrink-0 overflow-hidden px-6 pt-12 pb-28 lg:min-h-screen lg:min-w-0 lg:flex-1 lg:p-0">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-500 to-primary-300 lg:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl lg:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-24 -left-8 h-40 w-40 rounded-full bg-primary-300/35 blur-2xl lg:hidden"
            aria-hidden
          />

          {/* Notebook: imagem ocupa todo o painel esquerdo */}
          <Image
            src="/img/sistema-shekinah-tela-de-login.png"
            alt="Sistema Shekinah — pedidos, cozinha e caixa"
            fill
            priority
            className="hidden object-cover object-[32%_center] lg:block"
            sizes="(min-width: 1024px) 68vw, 0px"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-28 bg-gradient-to-l from-[#f7f6f4] via-[#f7f6f4]/70 to-transparent lg:block xl:w-36"
            aria-hidden
          />

          {/* Celular: marca + texto */}
          <div className="relative mx-auto w-full max-w-lg lg:hidden">
            <div className="mb-8">
              <BrandWordmark variant="light" iconSize="md" />
            </div>
            <h1 className="max-w-md text-[2rem] leading-tight font-bold tracking-tight text-white">
              Gestão do seu dia
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
              Pedidos, cozinha e caixa em um só lugar
            </p>
          </div>
        </section>

        {/* Formulário — coluna estreita à direita no notebook */}
        <section className="relative -mt-16 flex flex-1 flex-col rounded-t-[2.5rem] bg-white px-6 pt-8 pb-10 shadow-[0_-12px_40px_rgb(23_25_35_/_0.08)] lg:mt-0 lg:w-[min(100%,24rem)] lg:max-w-[34vw] lg:shrink-0 lg:justify-center lg:overflow-hidden lg:rounded-none lg:bg-[#f7f6f4] lg:px-8 lg:py-12 lg:shadow-none xl:w-[26rem] xl:px-10">
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            aria-hidden
          >
            <div className="absolute -top-20 -right-12 h-56 w-56 rounded-full bg-primary-300/25 blur-3xl" />
            <div className="absolute bottom-8 -left-16 h-48 w-48 rounded-full bg-primary-200/20 blur-3xl" />
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none lg:rounded-[1.625rem] lg:border lg:border-white/80 lg:bg-white/90 lg:p-8 lg:shadow-[0_24px_64px_-20px_rgb(23_25_35_/_0.14),0_0_0_1px_rgb(255_255_255_/_0.6)] lg:backdrop-blur-md xl:p-9">
            <div className="hidden lg:block">
              <BrandWordmark variant="dark" iconSize="md" subtitle="Operação do dia" />
              <div
                className="mt-6 h-px bg-gradient-to-r from-transparent via-neutral-200/90 to-transparent"
                aria-hidden
              />
            </div>

            <p className="mt-7 text-[11px] font-semibold tracking-[0.16em] text-primary-600 uppercase lg:mt-7">
              Acesso interno
            </p>

            <form action={formAction} className="mt-4 space-y-5 lg:mt-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold tracking-wide text-neutral-600 lg:text-[0.8125rem]"
                >
                  E-mail
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary-500/90">
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
                    className="sk-input-soft sk-input-soft--icon-start h-12 border-neutral-200/80 bg-neutral-50/80 lg:h-[3.25rem] lg:bg-white lg:shadow-[inset_0_1px_2px_rgb(23_25_35_/_0.04)] lg:focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold tracking-wide text-neutral-600 lg:text-[0.8125rem]"
                >
                  Senha
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary-500/90">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="sk-input-soft sk-input-soft--icon-start sk-input-soft--icon-end h-12 border-neutral-200/80 bg-neutral-50/80 lg:h-[3.25rem] lg:bg-white lg:shadow-[inset_0_1px_2px_rgb(23_25_35_/_0.04)] lg:focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100/80 hover:text-neutral-600"
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
                className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 text-sm font-bold tracking-[0.14em] text-white uppercase shadow-[0_12px_28px_-8px_rgb(255_138_79_/_0.55)] transition hover:from-primary-700 hover:via-primary-600 hover:to-primary-700 hover:shadow-[0_16px_32px_-8px_rgb(255_138_79_/_0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:from-neutral-300 disabled:via-neutral-300 disabled:to-neutral-300 disabled:shadow-none lg:h-[3.25rem]"
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

            <p className="mt-7 hidden items-center justify-center gap-2 text-center text-[11px] font-medium tracking-wide text-neutral-400 lg:flex">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 [&_svg]:h-3 [&_svg]:w-3">
                <LockIcon />
              </span>
              Ambiente seguro · uso exclusivo da equipe
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
