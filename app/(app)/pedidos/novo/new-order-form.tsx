"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction, type CreateOrderResult } from "@/lib/auth/orders";
import { printOrderReceipt, type PrintOrderData } from "@/lib/printing/print";
import BackButton from "@/components/back-button";

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
 *  Produtos por categoria, botões grandes, total em tempo real,
 *  forma de pagamento e FINALIZAR (atômico no banco).
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
  const [paymentMethod, setPaymentMethod] = useState<"" | "dinheiro" | "pix" | "cartao">("");
  const [paymentAmount, setPaymentAmount] = useState("");
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
      const result = await printOrderReceipt(receipt);
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
    <div className="space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Novo pedido</h1>
          <p className="text-sm text-neutral-500">Dia de operação · {dayId.slice(0, 8)}</p>
        </div>
      </header>

      <form ref={formRef} action={formAction} className="space-y-5">
        {/* Nome do cliente */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Nome do cliente
          </label>
          <input
            name="customer_name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Ex.: João"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-blue-500"
          />
        </section>

        {/* Produtos por categoria */}
        {Object.entries(byCategory).map(([category, list]) => (
          <section key={category} className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
              {category}
            </h2>
            <ul className="space-y-2">
              {list.map((p) => {
                const n = qty(p.id);
                const soldOut = p.available === 0;
                return (
                  <li
                    key={p.id}
                    className={`rounded-xl border px-3 py-2 ${
                      soldOut
                        ? "border-neutral-200 bg-neutral-50 opacity-60"
                        : "border-neutral-200"
                    }`}
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
                                <span className="font-bold text-red-500">ESGOTADO</span>
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
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700 active:bg-neutral-200"
                            aria-label={`Diminuir ${p.name}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            name="quantity"
                            value={n}
                            onChange={(e) => setQty(p.id, Number(e.target.value) || 0)}
                            className="h-10 w-14 rounded-lg border border-neutral-300 text-center text-lg font-bold"
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
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700 active:bg-neutral-200"
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
          <section className="rounded-2xl bg-neutral-900 p-4 text-white">
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

        {/* Forma de pagamento */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
            Pagamento
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["dinheiro", "Dinheiro"],
                ["pix", "Pix"],
                ["cartao", "Cartão"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPaymentMethod(value);
                  // pré-preenche o valor com o total
                  setPaymentAmount(String(total));
                }}
                className={`rounded-xl border px-3 py-3 text-base font-bold ${
                  paymentMethod === value
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-neutral-200 text-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {paymentMethod && (
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-semibold text-neutral-700">
                Valor recebido do cliente (R$)
              </label>
              <input
                name="payment_amount"
                type="number"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-2xl font-bold outline-none focus:border-blue-500"
              />

              {paymentMethod === "dinheiro" && (() => {
                const received = Number(paymentAmount) || 0;
                const change = Math.max(0, received - total);
                return (
                  <>
                    <input type="hidden" name="change_given" value={change} />
                    {received > total ? (
                      <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                        Troco a devolver: {fmtBRL(change)}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">
                        Se o cliente entregar mais que {fmtBRL(total)}, informe o valor e o troco é calculado.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </section>

        <input type="hidden" name="day_id" value={dayId} />

        {/* Estado de erro da action */}
        {state?.error && !pending && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        {/* Botão FINALIZAR (protegido contra duplo toque) */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white p-4">
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || pending || submitted}
              className="w-full rounded-2xl bg-green-600 py-5 text-center text-lg font-black text-white transition active:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Enviando…" : submitted ? "Processando…" : "FINALIZAR PEDIDO"}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              {canSubmit
                ? "Pedido é criado de uma só vez (atômico no banco)"
                : "Selecione itens para finalizar"}
            </p>
          </div>
        </div>
      </form>

      {/* Confirmação do pedido + comanda (impressão DESACOPLADA) */}
      {state?.orderId && printPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <p className="text-sm font-bold text-neutral-800">
                {printError ? "⚠️ Pedido salvo, impressão falhou" : "✅ Pedido salvo · comanda"}
              </p>
              <span className="rounded-lg bg-neutral-900 px-2 py-1 text-xs font-bold text-white">#{state.orderNumber}</span>
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
                className="w-full rounded-xl bg-green-600 py-3 text-center text-base font-black text-white active:bg-green-700"
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
                  const result = await printOrderReceipt(receipt);
                  if (result.ok) setPrintError(null);
                  else setPrintError(result.error ?? "Falha de impressão.");
                }}
                className="w-full rounded-xl border border-neutral-300 py-3 text-center text-sm font-bold text-neutral-700 active:bg-neutral-100"
              >
                ♻ Reimprimir comanda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}