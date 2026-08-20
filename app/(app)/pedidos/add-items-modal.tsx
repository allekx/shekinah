"use client";

import { useMemo, useState } from "react";
import { addItemsAction } from "@/lib/auth/orders";
import { printComplementReceipt } from "@/lib/printing/print";

interface Product {
  id: number;
  name: string;
  unit_price: number;
  category: string | null;
  tracks_stock: boolean;
  available: number | null; // null = sem controle de estoque
}

interface ExistingItem {
  product_name: string;
  quantity: number;
  complementary: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

/** Modal de ADICIONAR ITENS a um pedido existente (complemento).
 *  - mostra cliente/itens atuais/total atual;
 *  - seleciona novos produtos com quantidade (mesmo padrão do novo pedido);
 *  - confirma via addItemsAction (RPC add_items_to_order — ADIÇÃO, sem duplicar);
 *  - ao confirmar, imprime a COMANDA COMPLEMENTAR (somente os novos itens).
 */
export default function AddItemsModal({
  order,
  products,
  onClose,
  onAdded,
}: {
  order: {
    id: string;
    number: number;
    customer_name: string | null;
    total: number;
    status: string;
    items: ExistingItem[];
  };
  products: Product[];
  onClose: () => void;
  onAdded: (updated: { id: string; total: number }) => void;
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const qty = (id: number) => quantities[id] ?? 0;
  const setQty = (id: number, v: number) =>
    setQuantities((prev) => ({ ...prev, [id]: v }));

  // Novos itens selecionados + total adicional
  const { newItems, addTotal } = useMemo(() => {
    const items: {
      product_id: number;
      quantity: number;
      unit_price: number;
      available: number | null;
      name: string;
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
          name: p.name,
        });
        sum += n * p.unit_price;
      }
    }
    return { newItems: items, addTotal: sum };
  }, [products, quantities]);

  // Bloqueio de produto esgotado
  const canAdd = newItems.length > 0 && !newItems.find((it) => it.available !== null && it.quantity > it.available);

  const byCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      const key = p.category ?? "Outros";
      (map[key] ??= []).push(p);
    }
    return map;
  }, [products]);

  const confirm = async () => {
    if (!canAdd) return;
    setPending(true);
    setError(null);
    const payload = newItems.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
    }));

    const res = await addItemsAction(order.id, payload);
    if (res.error) {
      setError(res.error);
      setPending(false);
      return;
    }

    // Sucesso: imprime a comanda complementar (somente novos itens) + atualiza UI
    setSuccess(true);
    onAdded({ id: order.id, total: res.total ?? order.total });
    setPending(false);

    try {
      await printComplementReceipt({
        orderNumber: order.number,
        customerName: order.customer_name,
        createdAt: new Date().toISOString(),
        items: res.complementItems ?? newItems.map((it) => ({
          product_name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
        total: addTotal,
      });
    } catch {
      // impressão nunca bloqueia a adição
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-neutral-800">Adicionar itens</p>
            <p className="text-xs sk-text-muted">
              Pedido #{order.number} · {order.customer_name ?? "Cliente"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sk-btn-ghost text-xs"
          >
            ✕
          </button>
        </div>

        {/* Itens atuais (resumo) */}
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide sk-text-muted">
            Itens atuais · total {fmtBRL(order.total)}
          </p>
          <ul className="space-y-0.5">
            {order.items.length === 0 && <li className="text-xs sk-text-muted">Sem itens</li>}
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between text-sm text-neutral-700">
                <span>
                  {it.complementary && <span className="mr-0.5 text-xs">🔔</span>}
                  {it.quantity}x {it.product_name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Seleção de novos produtos */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {Object.entries(byCategory).map(([category, list]) => (
            <section key={category} className="mb-4">
              <h3 className="mb-2 sk-section-title">
                {category}
              </h3>
              <ul className="space-y-2">
                {list.map((p) => {
                  const n = qty(p.id);
                  const soldOut = p.available === 0;
                  return (
                    <li
                      key={p.id}
                      className={`sk-card p-3 ${
                        soldOut ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">{p.name}</p>
                          <p className="text-xs sk-text-muted">
                            {fmtBRL(p.unit_price)}
                            {p.available !== null && (
                              <span className="ml-1">
                                {soldOut ? (
                                  <span className="sk-badge sk-badge--danger">ESGOTADO</span>
                                ) : (
                                  <>· disp. {p.available}</>
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
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-lg font-bold text-neutral-700"
                              aria-label={`Diminuir ${p.name}`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={n}
                              onChange={(e) => setQty(p.id, Number(e.target.value) || 0)}
                              className="h-8 w-12 rounded-lg border border-neutral-300 text-center text-base font-bold"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQty(p.id, p.available !== null ? Math.min(p.available, n + 1) : n + 1)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-lg font-bold text-neutral-700"
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
          ))}
        </div>

        {/* Rodapé: total adicional + ações */}
        <div className="border-t border-neutral-200 px-4 py-3">
          {error && (
            <p role="alert" className="mb-2 sk-alert-error">{error}</p>
          )}
          {success && (
            <p className="mb-2 sk-alert-success">Itens adicionados ao pedido.</p>
          )}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm sk-text-muted">Total adicional</span>
            <span className="text-lg font-black text-neutral-900 tabular-nums">{fmtBRL(addTotal)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="sk-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!canAdd || pending}
              className="sk-btn-primary"
            >
              {pending ? "Adicionando…" : "Adicionar ao pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}