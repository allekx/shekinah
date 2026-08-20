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
    <section className="sk-card p-4">
      <h2 className="mb-3 sk-section-title">Lista de produtos</h2>

      {error && (
        <p role="alert" className="mb-3 sk-alert-error">{error}</p>
      )}

      <ul className="divide-y divide-neutral-200">
        {products.length === 0 && (
          <li className="py-4 text-center text-sm sk-text-muted">
            Nenhum produto cadastrado.
          </li>
        )}

        {products.map((p) => (
          <li key={p.id} className="py-3">
            {editingId === p.id ? (
              <form
                className="space-y-3"
                action={async (formData) => {
                  const res = await updateProduct(formData);
                  setError(res?.error ?? null);
                  if (!res?.error) setEditingId(null);
                }}
              >
                <input type="hidden" name="id" value={p.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`name-${p.id}`} className="sk-label">Nome</label>
                    <input
                      id={`name-${p.id}`}
                      name="name"
                      defaultValue={p.name}
                      required
                      className="sk-input"
                    />
                  </div>
                  <div>
                    <label htmlFor={`category-${p.id}`} className="sk-label">Categoria</label>
                    <input
                      id={`category-${p.id}`}
                      name="category"
                      defaultValue={p.category ?? ""}
                      placeholder="Categoria"
                      className="sk-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`price-${p.id}`} className="sk-label">Preço (R$)</label>
                    <input
                      id={`price-${p.id}`}
                      name="unit_price"
                      type="number"
                      step="0.01"
                      defaultValue={p.unit_price}
                      className="sk-input font-bold tabular-nums"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" name="tracks_stock" defaultChecked={p.tracks_stock} className="h-4 w-4 accent-primary-600" />
                      Controla estoque
                    </label>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-primary-600" />
                      Ativo
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="sk-btn-primary">
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="sk-btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {p.name}{" "}
                      {!p.active && (
                        <span className="sk-badge sk-badge--neutral">inativo</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {p.category ?? "Sem categoria"} · {fmt(Number(p.unit_price))}
                      {p.tracks_stock ? " · estoque" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={toggleProductActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.active)} />
                      <button
                        type="submit"
                        className={`sk-btn ${p.active ? "sk-btn-ghost text-red-600 hover:bg-red-50" : "sk-btn-ghost text-green-600 hover:bg-green-50"}`}
                      >
                        {p.active ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      className="sk-btn-ghost"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}