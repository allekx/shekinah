"use client";

import { useState } from "react";
import { createProduct, updateProduct } from "@/lib/auth/products";

/** Formulário de criação/edição de produto. */
export default function ProductForm() {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
        {editing ? "Novo produto" : "Novo produto"}
      </h2>

      <form
        action={async (formData) => {
          const res = await createProduct(formData);
          setError(res?.error ?? null);
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Nome do produto"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-blue-500"
          />
          <input
            name="category"
            placeholder="Categoria (ex.: Bebidas)"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base text-neutral-500">R$</span>
            <input
              name="unit_price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              placeholder="0,00"
              className="h-11 w-32 rounded-xl border border-neutral-300 px-4 text-lg font-bold outline-none focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="tracks_stock" defaultChecked className="h-5 w-5" />
            Controla estoque
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 py-3 text-base font-bold text-white active:bg-blue-700"
        >
          Adicionar produto
        </button>
      </form>
    </div>
  );
}