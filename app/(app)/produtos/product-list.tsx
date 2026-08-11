"use client";

import { useState } from "react";
import { updateProduct, toggleProductActive } from "@/lib/auth/products";

interface Product {
  id: number;
  name: string;
  unit_price: number;
  category: string | null;
  tracks_stock: boolean;
  active: boolean;
}

/** Lista de produtos com edição inline e ativar/desativar. */
export default function ProductList({ products }: { products: Product[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
        Lista de produtos
      </h2>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <ul className="divide-y divide-neutral-100">
        {products.length === 0 && (
          <li className="py-4 text-center text-sm text-neutral-400">
            Nenhum produto cadastrado.
          </li>
        )}

        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-3">
            {editingId === p.id ? (
              <form
                className="flex flex-1 flex-wrap items-center gap-2"
                action={async (formData) => {
                  const res = await updateProduct(formData);
                  setError(res?.error ?? null);
                  if (!res?.error) setEditingId(null);
                }}
              >
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="name"
                  defaultValue={p.name}
                  required
                  className="h-10 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-blue-500"
                />
                <input
                  name="category"
                  defaultValue={p.category ?? ""}
                  placeholder="Categoria"
                  className="h-10 w-28 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-blue-500"
                />
                <input
                  name="unit_price"
                  type="number"
                  step="0.01"
                  defaultValue={p.unit_price}
                  className="h-10 w-20 rounded-lg border border-neutral-300 px-2 text-sm font-bold outline-none focus:border-blue-500"
                />
                <label className="flex items-center gap-1 text-xs text-neutral-600">
                  <input type="checkbox" name="tracks_stock" defaultChecked={p.tracks_stock} /> estoque
                </label>
                <label className="flex items-center gap-1 text-xs text-neutral-600">
                  <input type="checkbox" name="active" defaultChecked={p.active} /> ativo
                </label>
                <div className="flex gap-1">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {p.name}{" "}
                    {!p.active && (
                      <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {p.category ?? "Sem categoria"} · {fmt(Number(p.unit_price))}
                    {p.tracks_stock ? " · estoque" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button
                      type="submit"
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                        p.active
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {p.active ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setEditingId(p.id)}
                    className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-bold text-neutral-700"
                  >
                    Editar
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}