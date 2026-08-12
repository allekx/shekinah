"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateStatusAction } from "@/lib/auth/kitchen";
import BackButton from "@/components/back-button";

interface KitchenItem {
  name: string;
  qty: number;
  complement: boolean;
}

interface KitchenOrder {
  id: string;
  number: number;
  customer_name: string | null;
  status: string;
  created_at: string;
  items: KitchenItem[];
}

const COLUMNS = [
  { key: "novo", label: "NOVOS", dot: "bg-red-500", ring: "border-red-300", btn: "COMEÇAR PREPARO", btnClass: "bg-yellow-500", next: "em_preparo" },
  { key: "em_preparo", label: "EM PREPARO", dot: "bg-yellow-500", ring: "border-yellow-300", btn: "MARCAR COMO PRONTO", btnClass: "bg-green-600", next: "pronto" },
  { key: "pronto", label: "PRONTOS", dot: "bg-green-500", ring: "border-green-300" },
];

/** Interface da COZINHA: 3 colunas, botões grandes, Realtime.
 *  Destaque visual para pedidos novos + feedback sonoro discreto (AudioContext,
 *  sem depender do som para indicar).
 */
export default function KitchenBoard({
  dayId,
  dayLabel,
  orders: initial,
}: {
  dayId: string;
  dayLabel: string;
  orders: KitchenOrder[];
}) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const supabase = createClient();

  // Feedback sonoro discreto (sem depender dele)
  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* sem áudio, segue normalmente */ }
  };

  // Realtime: ao receber novo pedido (INSERT), destaca e toca beep
  useEffect(() => {
    const fetchItems = async (orderIds: string[]) => {
      const { data } = await supabase
        .from("order_items")
        .select("order_id, product_name, quantity, complement_id")
        .in("order_id", orderIds);
      const map: Record<string, KitchenItem[]> = {};
      for (const it of data ?? []) {
        (map[it.order_id] ??= []).push({
          name: it.product_name,
          qty: it.quantity,
          complement: it.complement_id !== null,
        });
      }
      return map;
    };

    const channel = supabase
      .channel(`kitchen-${dayId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `business_day_id=eq.${dayId}` },
        async (payload) => {
          const row = payload.new as Partial<KitchenOrder> | null;
          if (!row?.id) return;
          const orderId = row.id;
          if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            return;
          }

          // Só mostra colunas da cozinha (novo/em_preparo/pronto)
          if (["cancelado", "entregue"].includes(String(row.status))) {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            return;
          }

          const { data: fresh } = await supabase
            .from("orders")
            .select("id, number, customer_name, status, created_at")
            .eq("id", orderId)
            .single();
          if (!fresh) return;
          const itemsMap = await fetchItems([orderId]);

          setOrders((prev) => {
            const exists = prev.some((o) => o.id === orderId);
            const next: KitchenOrder = {
              id: fresh.id,
              number: fresh.number,
              customer_name: fresh.customer_name,
              status: fresh.status,
              created_at: fresh.created_at,
              items: itemsMap[orderId] ?? [],
            };
            const list = exists
              ? prev.map((o) => (o.id === orderId ? next : o))
              : [...prev, next];
            return list.sort((a, b) => a.number - b.number);
          });

          // Novo pedido: destaque visual + beep
          if (payload.eventType === "INSERT") {
            playBeep();
            setNewIds((prev) => [orderId, ...prev.filter((id) => id !== orderId)]);
            window.setTimeout(() => {
              setNewIds((prev) => prev.filter((id) => id !== orderId));
            }, 10000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  const byStatus = (status: string) =>
    orders.filter((o) => o.status === status).sort((a, b) => a.number - b.number);

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const onTransition = async (orderId: string, toStatus: string) => {
    setActionError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("to_status", toStatus);
    const res = await updateStatusAction(fd);
    if (res?.error) setActionError(res.error);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#eef0f3]">
      {/* Header enxuto */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <BackButton />
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-neutral-800">Cozinha</p>
            <p className="text-xs font-medium text-neutral-500">{dayLabel}</p>
          </div>
        </div>
        <span className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
          {orders.filter((o) => o.status !== "pronto").length} a fazer
        </span>
      </header>

      {actionError && (
        <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {/* 3 colunas */}
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = byStatus(col.key);
          return (
            <section key={col.key} className={`rounded-2xl bg-white p-3 shadow-[0_2px_10px_rgb(23_25_35_/0.05)] ${col.ring} border-l-4`}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-black uppercase tracking-wide text-neutral-800">
                <span className={`h-3 w-3 rounded-full ${col.dot}`} />
                {col.label} ({list.length})
              </h2>

              {list.length === 0 ? (
                <p className="rounded-xl bg-neutral-50 py-8 text-center text-sm text-neutral-400">—</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-2xl border transition ${
                        newIds.includes(o.id)
                          ? "border-red-500 bg-red-100 animate-pulse"
                          : col.key === "novo"
                            ? "border-red-200 bg-red-50/60"
                            : "border-neutral-200 bg-white"
                      } shadow-[0_1px_3px_rgb(23_25_35_/0.06)]`}
                    >
                      {/* Número + cliente */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-2xl font-black text-neutral-900">
                            #{o.number}
                            {newIds.includes(o.id) && (
                              <span className="ml-2 rounded bg-red-600 px-2 py-0.5 align-middle text-xs font-black text-white">
                                NOVO!
                              </span>
                            )}
                          </p>
                          <p className="text-sm font-bold uppercase text-neutral-700">
                            {o.customer_name ?? "Cliente"}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-400">{time(o.created_at)}</span>
                      </div>

                      {/* Itens + quantidades (sem preço) */}
                      <ul className="mt-3 space-y-1">
                        {o.items.map((it, i) => (
                          <li key={i} className="flex gap-2 text-base text-neutral-800">
                            <span className="font-black">{it.qty}x</span>
                            <span>
                              {it.complement && <span className="mr-1">🔔</span>}
                              {it.name}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Botão de transição */}
                      {col.btn && (
                        <button
                          type="button"
                          onClick={() => onTransition(o.id, col.next!)}
                          className={`mt-4 w-full rounded-xl ${col.btnClass} py-4 text-lg font-black text-white transition active:scale-[.98]`}
                        >
                          {col.btn}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}