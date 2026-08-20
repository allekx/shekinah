"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/page-shell";
import { createOrderAction, type CreateOrderResult } from "@/lib/auth/orders";
import { printOrderReceipt, type PrintOrderData } from "@/lib/printing/print";
import {
  buildProductMap,
  groupProductsByCategory,
  parseQtyInput,
  type CatalogProduct,
} from "@/lib/catalog";
import type { PrinterConfig } from "@/lib/printing/settings";
import { toPrintSettings } from "@/lib/printing/settings";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

/** Tela de NOVO PEDIDO (atendimento) — mobile-first. */
export default function NewOrderForm({
  dayId,
  products,
  printerSettings,
}: {
  dayId: string;
  products: CatalogProduct[];
  printerSettings: PrinterConfig;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const printSettings = useMemo(() => toPrintSettings(printerSettings), [printerSettings]);
  const productMap = useMemo(() => buildProductMap(products), [products]);
  const sortedCategories = useMemo(() => groupProductsByCategory(products), [products]);

  const [customer, setCustomer] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [activeCategory, setActiveCategory] = useState(
    () => sortedCategories[0]?.[0] ?? "Outros"
  );
  const [submitted, setSubmitted] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<
    import("@/lib/printing/types").ReceiptPreview | null
  >(null);

  const qty = (id: number) => quantities[id] ?? 0;
  const setQty = (id: number, v: number) =>
    setQuantities((prev) => ({ ...prev, [id]: v }));

  const activeProducts = useMemo(() => {
    const found = sortedCategories.find(([cat]) => cat === activeCategory);
    return found?.[1] ?? [];
  }, [sortedCategories, activeCategory]);

  const { selectedItems, total } = useMemo(() => {
    const items: {
      product_id: number;
      quantity: number;
      unit_price: number;
      available: number | null;
    }[] = [];
    let sum = 0;
    for (const p of products) {
      const n = qty(p.id);
      if (n > 0) {
        items.push({
          product_id: p.id,
          quantity: n,
          unit_price: p.unit_price,
          available: p.available,
        });
        sum += n * p.unit_price;
      }
    }
    return { selectedItems: items, total: sum };
  }, [products, quantities]);

  const stockError = selectedItems.find(
    (it) => it.available !== null && it.quantity > (it.available ?? 0)
  );
  const canSubmit = selectedItems.length > 0 && !stockError;

  const [state, formAction, pending] = useActionState<CreateOrderResult, FormData>(
    async (_prev, fd) => {
      setSubmitted(true);
      setPrintError(null);
      setPrintPreview(null);
      const res = await createOrderAction(fd);
      if (res.orderId) {
        const receipt: PrintOrderData = {
          number: res.orderNumber ?? 0,
          customer_name: customer,
          created_at: new Date().toISOString(),
          items: (res.items ?? []).map((it) => ({
            product_name: it.product_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          total: total,
        };
        const result = await printOrderReceipt(receipt, printSettings);
        setPrintPreview(result.preview);
        if (!result.ok) setPrintError(result.error ?? "Falha de impressão.");
      } else if (res.error) {
        setSubmitted(false);
      }
      return res;
    },
    {}
  );

  const handleSubmit = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <PageShell title="Novo pedido" className="sk-page-with-sticky-footer">
      <form ref={formRef} action={formAction} className="space-y-5">
        <section className="sk-card p-4">
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Nome do cliente
          </label>
          <input
            name="customer_name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Ex.: João"
            className="sk-input"
          />
        </section>

        {sortedCategories.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {sortedCategories.map(([category]) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`sk-category-tab ${
                  activeCategory === category ? "sk-category-tab--active" : ""
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        <section className="sk-card p-4">
          <h2 className="sk-section-title mb-3">{activeCategory}</h2>
          <ul className="space-y-2">
            {activeProducts.map((p) => {
              const n = qty(p.id);
              const soldOut = p.available === 0;
              return (
                <li
                  key={p.id}
                  className={`sk-list-row px-3 py-2 ${soldOut ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-neutral-900">
                        {p.name}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {fmtBRL(p.unit_price)}
                        {p.available !== null && (
                          <span className="ml-2 text-xs">
                            {soldOut ? (
                              <span className="sk-badge sk-badge--danger ml-1">ESGOTADO</span>
                            ) : (
                              <>Disponível: {p.available}</>
                            )}
                          </span>
                        )}
                      </p>
                    </div>

                    {!soldOut && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQty(p.id, Math.max(0, n - 1))}
                          className="sk-qty-btn"
                          aria-label={`Diminuir ${p.name}`}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={n === 0 ? "" : String(n)}
                          placeholder="0"
                          onChange={(e) =>
                            setQty(p.id, parseQtyInput(e.target.value, p.available))
                          }
                          className="sk-qty-input w-14"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQty(
                              p.id,
                              p.available !== null ? Math.min(p.available, n + 1) : n + 1
                            )
                          }
                          className="sk-qty-btn"
                          aria-label={`Aumentar ${p.name}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {selectedItems.length > 0 && (
          <section className="sk-summary-dark">
            <div className="space-y-1">
              {selectedItems.map((it) => {
                const p = productMap.get(it.product_id);
                return (
                  <div key={it.product_id} className="flex justify-between text-sm">
                    <span>
                      {it.quantity}x {p?.name}
                    </span>
                    <span>{fmtBRL(it.quantity * it.unit_price)}</span>
                  </div>
                );
              })}
            </div>
            {stockError && (
              <p className="mt-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-bold">
                Estoque insuficiente para {productMap.get(stockError.product_id)?.name}.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-2xl font-black">{fmtBRL(total)}</span>
            </div>
          </section>
        )}

        <input type="hidden" name="day_id" value={dayId} />

        {/* Itens selecionados (todas as categorias) para o submit */}
        {selectedItems.map((it) => {
          const p = productMap.get(it.product_id);
          return (
            <div key={it.product_id} hidden aria-hidden>
              <input name="product_id" readOnly value={it.product_id} />
              <input name="quantity" readOnly value={it.quantity} />
              <input name="unit_price" readOnly value={it.unit_price} />
              <input name="product_name" readOnly value={p?.name ?? ""} />
            </div>
          );
        })}

        {state?.error && !pending && (
          <p role="alert" className="sk-alert-error">
            {state.error}
          </p>
        )}
      </form>

      <div className="sk-sticky-footer">
        <div className="sk-sticky-footer__inner">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || pending || submitted}
            className="sk-btn-success w-full py-5 text-lg"
          >
            {pending ? "Enviando…" : submitted ? "Processando…" : "FINALIZAR PEDIDO"}
          </button>
          <p className="mt-2 text-center text-xs sk-text-muted">
            {canSubmit
              ? "Ao finalizar, a comanda vai para a cozinha. Pagamento no caixa."
              : "Selecione itens para finalizar"}
          </p>
        </div>
      </div>

      {state?.orderId && printPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm">
          <div className="sk-card sk-card--elevated w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <p className="text-sm font-bold text-neutral-800">
                {printError ? "⚠️ Pedido salvo, impressão falhou" : "✅ Pedido salvo · comanda"}
              </p>
              <span className="sk-badge sk-badge--neutral px-2 py-1 text-xs">#{state.orderNumber}</span>
            </div>

            <div className="max-h-[50vh] overflow-auto p-4">
              <pre className="rounded-xl bg-neutral-50 p-3 font-mono text-[11px] leading-4 whitespace-pre-wrap break-words">
                {printPreview.text}
              </pre>
            </div>

            {printError && (
              <p className="px-4 pb-2 text-xs font-medium text-red-700">{printError}</p>
            )}

            <div className="space-y-2 border-t border-neutral-200 px-4 py-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="sk-btn-success w-full py-3 text-base"
              >
                Concluir e voltar ao início
              </button>
              <button
                type="button"
                onClick={async () => {
                  const receipt: PrintOrderData = {
                    number: state.orderNumber ?? 0,
                    customer_name: customer,
                    created_at: new Date().toISOString(),
                    items: (state.items ?? []).map((it) => ({
                      product_name: it.product_name,
                      quantity: it.quantity,
                      unit_price: it.unit_price,
                    })),
                    total: total,
                  };
                  const result = await printOrderReceipt(receipt, printSettings);
                  if (result.ok) setPrintError(null);
                  else setPrintError(result.error ?? "Falha de impressão.");
                }}
                className="sk-btn-secondary w-full py-3"
              >
                ♻ Reimprimir comanda
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
