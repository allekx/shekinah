"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LowStockItem {
  name: string;
  remaining: number;
}

interface HomeDashboardProps {
  dayId: string;
  day: string;
  openedAtLabel: string;
  initialOrdersCount: number;
  initialSalesToday: number;
  initialPreparingCount: number;
  initialReadyCount: number;
  initialLowStock: LowStockItem[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDayShort = (dayStr: string) => {
  const [year, month, dayNum] = dayStr.split("-");
  if (!year || !month || !dayNum) return dayStr;
  return `${dayNum.padStart(2, "0")}/${month.padStart(2, "0")}/${year.slice(-2)}`;
};

/** Dashboard do John com métricas ao vivo (Realtime em orders). */
export default function HomeDashboard({
  dayId,
  day,
  openedAtLabel,
  initialOrdersCount,
  initialSalesToday,
  initialPreparingCount,
  initialReadyCount,
  initialLowStock,
}: HomeDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [ordersCount, setOrdersCount] = useState(initialOrdersCount);
  const [salesToday, setSalesToday] = useState(initialSalesToday);
  const [preparingCount, setPreparingCount] = useState(initialPreparingCount);
  const [readyCount, setReadyCount] = useState(initialReadyCount);
  const [lowStock, setLowStock] = useState(initialLowStock);

  useEffect(() => {
    const refreshMetrics = async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total, status")
        .eq("business_day_id", dayId)
        .neq("status", "cancelado");

      const list = orders ?? [];
      setOrdersCount(list.length);
      setSalesToday(list.reduce((s, o) => s + Number(o.total), 0));
      setPreparingCount(list.filter((o) => o.status === "em_preparo").length);
      setReadyCount(list.filter((o) => o.status === "pronto").length);
    };

    const refreshLowStock = async () => {
      const { data } = await supabase
        .from("daily_stock")
        .select("initial_qty, sold_qty, products(name)")
        .eq("business_day_id", dayId);

      const next = (data ?? [])
        .map((s) => ({
          name:
            (Array.isArray(s.products)
              ? s.products[0]?.name
              : (s.products as { name: string } | null)?.name) ?? "?",
          remaining: s.initial_qty - s.sold_qty,
        }))
        .filter((s) => s.remaining <= 3)
        .sort((a, b) => a.remaining - b.remaining);

      setLowStock(next);
    };

    const channel = supabase
      .channel(`home-day-${dayId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `business_day_id=eq.${dayId}` },
        () => {
          void Promise.all([refreshMetrics(), refreshLowStock()]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dayId, supabase]);

  return (
    <div className="space-y-5 pb-8 pt-4">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-700 via-primary-500 to-primary-300 p-6 text-white shadow-[0_10px_40px_rgb(255_138_79_/_0.22)]">
        <div
          className="pointer-events-none absolute -top-10 -right-6 h-36 w-36 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 -left-8 h-28 w-28 rounded-full bg-primary-300/30 blur-2xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgb(110_231_183_/_0.65)]" />
                Em andamento
              </p>
              <h1 className="mt-2.5 text-[1.75rem] font-bold tracking-tight tabular-nums">
                {fmtDayShort(day)}
              </h1>
              <p className="mt-1 text-sm text-white/70">Iniciado às {openedAtLabel}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              Dia ativo
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { value: String(ordersCount), label: "Pedidos hoje", accent: false },
              { value: fmtBRL(salesToday), label: "Vendas hoje", accent: false, small: true },
              { value: String(preparingCount), label: "Em preparo", accent: false },
              { value: String(readyCount), label: "Prontos", accent: true },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
              >
                <p
                  className={`sk-figure tabular-nums leading-none ${
                    m.small ? "text-lg" : "text-2xl"
                  } ${m.accent ? "text-emerald-200" : "text-white"}`}
                >
                  {m.value}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-white/65">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <a
        href="/pedidos/novo"
        className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-primary-500/25 transition hover:from-primary-600 hover:to-primary-700 active:scale-[0.99]"
      >
        ＋ Novo pedido
      </a>

      <section className="sk-card overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="sk-section-title">Estoque baixo</h2>
        </div>
        <div className="px-4 py-2">
          {lowStock.length === 0 ? (
            <p className="py-4 text-center text-sm sk-text-muted">
              Nenhum produto com estoque baixo
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {lowStock.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-neutral-800">
                    {s.name}
                  </span>
                  <span
                    className={`shrink-0 sk-badge ${
                      s.remaining === 0 ? "sk-badge--danger" : "sk-badge--warn"
                    }`}
                  >
                    {s.remaining === 0 ? "ESGOTADO" : `${s.remaining} restante(s)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="sk-section-title mb-3">Ações</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/pedidos", label: "Pedidos", icon: "📋" },
            { href: "/caixa", label: "Caixa", icon: "💰" },
            { href: "/estoque", label: "Estoque", icon: "📦" },
            { href: "/usuarios", label: "Usuários", icon: "👤" },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition active:scale-[.98] sk-card sk-card--interactive border-neutral-200/80 text-neutral-800"
            >
              <span className="text-xl leading-none">{a.icon}</span>
              <span className="text-sm font-bold">{a.label}</span>
            </a>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-neutral-400">
        <a href="/relatorio" className="font-semibold text-primary-600">
          Histórico e relatórios
        </a>
        {" · "}
        <a href="/impressora" className="font-semibold text-primary-600">
          Impressora
        </a>
      </p>
    </div>
  );
}
