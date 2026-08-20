"use client";

import { useActionState, useState } from "react";
import { openDay, type OpenDayResult } from "@/lib/auth/open-day";
import BackButton from "@/components/back-button";
import OpenDayAddProduct from "./open-day-add-product";

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit_price: number;
}

/** Formulário de abertura do dia: grade de estoque inicial + caixa inicial.
 *  Controles simples [-] qty [+] para digitação rápida no celular.
 */
export default function OpenDayForm({
  products,
  categories,
}: {
  products: Product[];
  categories: string[];
}) {
  const [state, formAction, pending] = useActionState<OpenDayResult, FormData>(
    openDay,
    {}
  );
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cash, setCash] = useState("");

  // Quantidade de um produto (default 0)
  const qty = (id: number) => quantities[id] ?? 0;

  const setQty = (id: number, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Agrupa por categoria
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    const key = p.category ?? "Outros";
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const categoryRank = (category: string) => {
    const name = category.toLowerCase();
    if (name === "pratos") return 0;
    if (name === "bebidas") return 1;
    return 2;
  };

  const sortedCategories = Object.entries(byCategory).sort(([a], [b]) => {
    const diff = categoryRank(a) - categoryRank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "pt-BR");
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Iniciar dia</h1>
          <p className="text-sm text-neutral-500">
            Informe o estoque inicial e o caixa inicial.
          </p>
        </div>
      </header>

      <form action={formAction} className="space-y-6">
        {/* Grade de estoque por categoria */}
        {sortedCategories.map(([category, list]) => (
          <section key={category} className="sk-card p-4">
            <h2 className="mb-3 sk-section-title">
              {category}
            </h2>
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatCurrency(Number(p.unit_price))}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty(p.id) - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700 active:bg-neutral-200"
                      aria-label={`Diminuir ${p.name}`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      name="quantity"
                      value={qty(p.id)}
                      onChange={(e) =>
                        setQty(p.id, Number(e.target.value) || 0)
                      }
                      className="h-9 w-14 rounded-lg border border-neutral-300 text-center text-base font-bold text-neutral-900 outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty(p.id) + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700 active:bg-neutral-200"
                      aria-label={`Aumentar ${p.name}`}
                    >
                      +
                    </button>
                    {/* campos ocultos para enviar produto+quantidade */}
                    <input type="hidden" name="product_id" value={p.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <OpenDayAddProduct categories={categories} />

        {/* Caixa inicial */}
        <section className="sk-card p-4">
          <h2 className="mb-3 sk-section-title">
            Caixa inicial
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-neutral-500">R$</span>
            <input
              type="number"
              inputMode="decimal"
              name="initial_cash"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0,00"
              className="h-12 w-full rounded-xl border border-neutral-300 px-4 text-2xl font-bold text-neutral-900 outline-none focus:border-blue-500"
            />
          </div>
        </section>

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
          className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white transition active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Abrindo…" : "CONFIRMAR ABERTURA"}
        </button>

        <p className="text-center text-xs text-neutral-400">
          Não é possível abrir outro dia enquanto houver um dia aberto.
        </p>
      </form>
    </div>
  );
}