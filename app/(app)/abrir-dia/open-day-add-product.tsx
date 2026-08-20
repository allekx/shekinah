"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createProduct } from "@/lib/auth/products";

/** Seletor de categoria: lista existentes ou permite digitar uma nova. */
function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const query = value.trim();
  const filtered = query
    ? categories.filter((c) =>
        c.toLowerCase().includes(query.toLowerCase())
      )
    : categories;

  const isNew =
    query.length > 0 &&
    !categories.some((c) => c.toLowerCase() === query.toLowerCase());

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id="open-day-product-category"
          name="category"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Escolha ou digite uma categoria"
          className="sk-input pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 active:bg-neutral-100"
          aria-label={open ? "Fechar categorias" : "Mostrar categorias"}
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          role="listbox"
          aria-label="Categorias"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-[var(--shadow-pop)]"
        >
          {filtered.map((category) => (
            <li key={category} role="option" aria-selected={value === category}>
              <button
                type="button"
                className={`w-full px-3 py-2.5 text-left text-sm transition active:bg-neutral-100 ${
                  value === category
                    ? "bg-primary-50 font-semibold text-primary-700"
                    : "text-neutral-800 hover:bg-neutral-50"
                }`}
                onClick={() => {
                  onChange(category);
                  setOpen(false);
                }}
              >
                {category}
              </button>
            </li>
          ))}

          {isNew && (
            <li className="border-t border-neutral-100">
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm font-medium text-primary-600 active:bg-primary-50"
                onClick={() => setOpen(false)}
              >
                Nova categoria: {query}
              </button>
            </li>
          )}

          {filtered.length === 0 && !isNew && (
            <li className="px-3 py-2.5 text-sm text-neutral-500">
              Nenhuma categoria encontrada
            </li>
          )}

          <li className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500">
            {query
              ? "Toque em uma opção ou continue digitando para criar"
              : "Digite para criar uma nova categoria"}
          </li>
        </ul>
      )}
    </div>
  );
}

/** Formulário compacto para cadastrar produto antes de abrir o dia. */
export default function OpenDayAddProduct({
  categories,
}: {
  categories: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resetFields = () => {
    setName("");
    setCategory("");
    setUnitPrice("");
  };

  const close = () => {
    setOpen(false);
    setError(null);
    resetFields();
  };

  const saveProduct = async () => {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName) {
      setError("Informe o nome do produto.");
      return;
    }

    const formData = new FormData();
    formData.set("name", trimmedName);
    if (trimmedCategory) formData.set("category", trimmedCategory);
    formData.set("unit_price", unitPrice);
    formData.set("tracks_stock", "on");

    setPending(true);
    setError(null);
    setSuccess(null);

    const res = await createProduct(formData);

    setPending(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    setSuccess("Produto cadastrado. Informe o estoque inicial acima.");
    close();
    router.refresh();
  };

  return (
    <section className="sk-card p-4">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setSuccess(null);
            setOpen(true);
          }}
          className="sk-btn-secondary w-full"
        >
          ＋ Cadastrar novo produto
        </button>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="sk-section-title">Novo produto</h2>
            <button
              type="button"
              onClick={close}
              className="sk-btn-ghost shrink-0 px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="open-day-product-name" className="sk-label">
                Nome
              </label>
              <input
                id="open-day-product-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Ex.: Suco de laranja"
                className="sk-input"
              />
            </div>

            <div>
              <label htmlFor="open-day-product-category" className="sk-label">
                Categoria
              </label>
              <CategoryPicker
                categories={categories}
                value={category}
                onChange={setCategory}
              />
            </div>

            <div>
              <label htmlFor="open-day-product-price" className="sk-label">
                Preço (R$)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base text-neutral-500">R$</span>
                <input
                  id="open-day-product-price"
                  name="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="sk-input h-11 flex-1 text-lg font-bold tabular-nums"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="sk-alert-error">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={saveProduct}
              className="sk-btn-primary w-full"
            >
              {pending ? "Salvando…" : "Salvar produto"}
            </button>
          </div>
        </>
      )}

      {success && !open && (
        <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {success}
        </p>
      )}
    </section>
  );
}
