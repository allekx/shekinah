"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  { key: "novo", label: "NOVOS", dot: "bg-red-500", badge: "sk-badge--danger", btn: "COMEÇAR PREPARO", btnClass: "sk-btn bg-amber-500 hover:bg-amber-600", next: "em_preparo" },
  { key: "em_preparo", label: "EM PREPARO", dot: "bg-amber-500", badge: "sk-badge--warn", btn: "MARCAR COMO PRONTO", btnClass: "sk-btn-primary", next: "pronto" },
  { key: "pronto", label: "PRONTOS", dot: "bg-green-500", badge: "sk-badge--success" },
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ordersByStatus = useMemo(() => {
    const map: Record<string, KitchenOrder[]> = {};
    for (const col of COLUMNS) {
      map[col.key] = orders
        .filter((o) => o.status === col.key)
        .sort((a, b) => a.number - b.number);
    }
    return map;
  }, [orders]);

  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* sem áudio */
    }
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

          const updated = row as Partial<KitchenOrder>;

          if (["cancelado", "entregue"].includes(String(updated.status))) {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            return;
          }

          if (payload.eventType === "UPDATE") {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === orderId);
              const patched: KitchenOrder = {
                id: orderId,
                number: updated.number ?? prev.find((o) => o.id === orderId)?.number ?? 0,
                customer_name:
                  updated.customer_name ??
                  prev.find((o) => o.id === orderId)?.customer_name ??
                  null,
                status: updated.status ?? prev.find((o) => o.id === orderId)?.status ?? "novo",
                created_at:
                  updated.created_at ??
                  prev.find((o) => o.id === orderId)?.created_at ??
                  new Date().toISOString(),
                items: prev.find((o) => o.id === orderId)?.items ?? [],
              };
              const list = exists
                ? prev.map((o) => (o.id === orderId ? { ...o, ...patched, items: o.items } : o))
                : [...prev, patched];
              return list.sort((a, b) => a.number - b.number);
            });

            const itemsMap = await fetchItems([orderId]);
            setOrders((prev) =>
              prev.map((o) =>
                o.id === orderId ? { ...o, items: itemsMap[orderId] ?? o.items } : o
              )
            );
            return;
          }

          // INSERT
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
  }, [dayId, supabase]);

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const onTransition = async (orderId: string, toStatus: string) => {
    setActionError(null);
    setPendingId(orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o))
    );
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("to_status", toStatus);
    const res = await updateStatusAction(fd);
    setPendingId(null);
    if (res?.error) setActionError(res.error);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header enxuto */}
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-neutral-800">Cozinha</p>
              <p className="text-xs font-medium text-neutral-500">{dayLabel}</p>
            </div>
          </div>
          <span className="sk-badge sk-badge--info">
            {orders.filter((o) => o.status !== "pronto").length} a fazer
          </span>
        </div>
        <div className="h-0.5 w-full bg-gradient-to-r from-primary-600 via-primary-500/60 to-transparent" />
      </header>

      {actionError && (
        <div className="mt-3 w-full">
          <p role="alert" className="sk-alert-error">{actionError}</p>
        </div>
      )}

      <main className="sk-kanban sk-kanban--3 w-full flex-1 py-4">
        {COLUMNS.map((col) => {
          const list = ordersByStatus[col.key] ?? [];
          return (
            <section key={col.key} className="sk-card p-3">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
                <span className={`h-3 w-3 rounded-full ${col.dot}`} />
                {col.label}
                <span className={`sk-badge ${col.badge}`}>{list.length}</span>
              </h2>

              {list.length === 0 ? (
                <p className="sk-empty">—</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((o) => (
                    <li
                      key={o.id}
                      className={`sk-card sk-card--interactive p-3 ${
                        newIds.includes(o.id)
                          ? "border-red-500 bg-red-50 animate-pulse"
                          : col.key === "novo"
                            ? "border-red-200 bg-red-50/50"
                            : ""
                      }`}
                    >
                      {/* Número + cliente */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-2xl font-black text-neutral-900">
                            #{o.number}
                            {newIds.includes(o.id) && (
                              <span className="ml-2 sk-badge sk-badge--danger">NOVO!</span>
                            )}
                          </p>
                          <p className="text-sm font-bold uppercase text-neutral-700">
                            {o.customer_name ?? "Cliente"}
                          </p>
                        </div>
                        <span className="text-xs sk-text-muted">{time(o.created_at)}</span>
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
                          disabled={pendingId === o.id}
                          onClick={() => onTransition(o.id, col.next!)}
                          className={`mt-4 w-full rounded-xl ${col.btnClass} py-4 text-lg font-black text-white transition active:scale-[.98] disabled:opacity-60`}
                        >
                          {pendingId === o.id ? "…" : col.btn}
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