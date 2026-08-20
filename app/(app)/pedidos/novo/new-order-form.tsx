"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/page-shell";
import { createOrderAction, type CreateOrderResult } from "@/lib/auth/orders";
import { getPrinterSettings } from "@/lib/auth/printer-settings";
import { printOrderReceipt, type PrintOrderData } from "@/lib/printing/print";
import { toPrintSettings } from "@/lib/printing/settings";

interface Product {
  id: number;
  name: string;
  unit_price: number;
  category: string | null;
  tracks_stock: boolean;
  available: number | null; // null = sem controle de estoque
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

/** Tela de NOVO PEDIDO (atendimento) — mobile-first.
 *  Produtos por categoria, botões grandes, total em tempo real.
 *  Pedido fica aberto em comanda; recebimento só no caixa.
 */
export default function NewOrderForm({
  dayId,
  products,
}: {
  dayId: string;
  products: Product[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [customer, setCustomer] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<import("@/lib/printing/types").ReceiptPreview | null>(null);

  const qty = (id: number) => quantities[id] ?? 0;
  const setQty = (id: number, v: number) =>
    setQuantities((prev) => ({ ...prev, [id]: v }));

  // Produtos organizados por categoria
  const byCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      const key = p.category ?? "Outros";
      (map[key] ??= []).push(p);
    }
    return map;
  }, [products]);

  const sortedCategories = useMemo(() => {
    const categoryRank = (category: string) => {
      const name = category.toLowerCase();
      if (name === "pratos") return 0;
      if (name === "porções" || name === "porcoes") return 1;
      if (name === "bebidas") return 2;
      if (name === "sobremesas") return 3;
      return 4;
    };
    return Object.entries(byCategory).sort(([a], [b]) => {
      const diff = categoryRank(a) - categoryRank(b);
      if (diff !== 0) return diff;
      return a.localeCompare(b, "pt-BR");
    });
  }, [byCategory]);

  const parseQtyInput = (raw: string, max: number | null) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") return 0;
    const num = Number(digits);
    if (max !== null) return Math.min(num, max);
    return num;
  };

  // Total e itens selecionados
  const { selectedItems, total } = useMemo(() => {
    const items: { product_id: number; quantity: number; unit_price: number; available: number | null }[] = [];
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

  // Valida estoque antes de enviar
  const stockError = selectedItems.find(
    (it) => it.available !== null && it.quantity > (it.available ?? 0)
  );
  const canSubmit = selectedItems.length > 0 && !stockError;

  const [state, formAction, pending] = useActionState<CreateOrderResult, FormData>(async (_prev, fd) => {
    setSubmitted(true);
    setPrintError(null);
    setPrintPreview(null);
    const res = await createOrderAction(fd);
    if (res.orderId) {
      // PEDIDO SALVO ✅ — agora a impressão (desacoplada). Se falhar, o pedido
      // NÃO é perdido: mostra a comanda na tela e permite REIMPRIMIR.
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
      const printSettings = toPrintSettings(await getPrinterSettings());
      const result = await printOrderReceipt(receipt, printSettings);
      setPrintPreview(result.preview);
      if (!result.ok) setPrintError(result.error ?? "Falha de impressão.");
      // aguarda o usuário confirmar (modal) antes de voltar
    } else if (res.error) {
      setSubmitted(false); // permite corrigir e tentar de novo
    }
    return res;
  }, {});

  const handleSubmit = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <PageShell title="Novo pedido" className="sk-page-with-sticky-footer">
      <form ref={formRef} action={formAction} className="space-y-5">
        {/* Nome do cliente */}
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

        {/* Produtos por categoria */}
        {sortedCategories.map(([category, list]) => (
          <section key={category} className="sk-card p-4">
            <h2 className="sk-section-title mb-3">
              {category}
            </h2>
            <ul className="space-y-2">
              {list.map((p) => {
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
                            name="quantity"
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
                                p.available !== null
                                  ? Math.min(p.available, n + 1)
                                  : n + 1
                              )
                            }
                            className="sk-qty-btn"
                            aria-label={`Aumentar ${p.name}`}
                          >
                            +
                          </button>
                          <input type="hidden" name="product_id" value={p.id} />
                          <input type="hidden" name="unit_price" value={p.unit_price} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/* Resumo do pedido */}
        {selectedItems.length > 0 && (
          <section className="sk-summary-dark">
            <div className="space-y-1">
              {selectedItems.map((it) => {
                const p = products.find((x) => x.id === it.product_id);
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
                Estoque insuficiente para {products.find((x) => x.id === stockError.product_id)?.name}.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-2xl font-black">{fmtBRL(total)}</span>
            </div>
          </section>
        )}

        <input type="hidden" name="day_id" value={dayId} />

        {/* Estado de erro da action */}
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

      {/* Confirmação do pedido + comanda (impressão DESACOPLADA) */}
      {state?.orderId && printPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm">
          <div className="sk-card sk-card--elevated w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <p className="text-sm font-bold text-neutral-800">
                {printError ? "⚠️ Pedido salvo, impressão falhou" : "✅ Pedido salvo · comanda"}
              </p>
              <span className="sk-badge sk-badge--neutral px-2 py-1 text-xs">#{state.orderNumber}</span>
            </div>

            {/* Comanda (pré-visualização) */}
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
                  const printSettings = toPrintSettings(await getPrinterSettings());
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