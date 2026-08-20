"use client";

import { useState } from "react";
import { createProduct, updateProduct } from "@/lib/auth/products";

/** Formulário de criação/edição de produto. */
export default function ProductForm() {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  return (
    <div className="sk-card p-4">
      <h2 className="mb-3 sk-section-title">Novo produto</h2>

      <form
        action={async (formData) => {
          const res = await createProduct(formData);
          setError(res?.error ?? null);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="sk-label">Nome</label>
            <input
              id="name"
              name="name"
              required
              placeholder="Nome do produto"
              className="sk-input"
            />
          </div>
          <div>
            <label htmlFor="category" className="sk-label">Categoria</label>
            <input
              id="category"
              name="category"
              placeholder="Categoria (ex.: Bebidas)"
              className="sk-input"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="unit_price" className="sk-label">Preço (R$)</label>
            <div className="flex items-center gap-2">
              <span className="text-base text-neutral-500">R$</span>
              <input
                id="unit_price"
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                placeholder="0,00"
                className="sk-input h-11 flex-1 text-lg font-bold tabular-nums"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 whitespace-nowrap">
            <input type="checkbox" name="tracks_stock" defaultChecked className="h-4 w-4 accent-primary-600" />
            Controla estoque
          </label>
        </div>

        {error && (
          <p role="alert" className="sk-alert-error">{error}</p>
        )}

        <button
          type="submit"
          className="sk-btn-primary w-full"
        >
          Adicionar produto
        </button>
      </form>
    </div>
  );
}