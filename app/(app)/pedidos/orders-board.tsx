"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelOrderAction } from "@/lib/auth/orders";

interface OrderItemLite {
  product_name: string;
  quantity: number;
  complementary: boolean;
}

interface Order {
  id: string;
  number: number;
  customer_name: string | null;
  status: string;
  total: number;
  paid: boolean;
  created_at: string;
  updated_at: string;
  items: OrderItemLite[];
}

interface ColumnDef {
  key: string;
  label: string;
  dot: string;
  ring: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "novo", label: "NOVOS", dot: "bg-red-500", ring: "border-red-200" },
  { key: "em_preparo", label: "EM PREPARO", dot: "bg-yellow-500", ring: "border-yellow-300" },
  { key: "pronto", label: "PRONTOS", dot: "bg-green-500", ring: "border-green-300" },
  { key: "entregue", label: "FINALIZADOS", dot: "bg-neutral-400", ring: "border-neutral-200" },
];

const statusLabel: Record<string, string> = {
  novo: "NOVO",
  em_preparo: "EM PREPARO",
  pronto: "PRONTO",
  entregue: "ENTREGUE",
  cancelado: "CANCELADO",
};
const statusDot: Record<string, string> = {
  novo: "bg-red-500",
  em_preparo: "bg-yellow-500",
  pronto: "bg-green-500",
  entregue: "bg-neutral-400",
  cancelado: "bg-neutral-300",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Quadro de pedidos do dia com atualização em tempo real (Realtime em orders). */
export default function OrdersBoard({ dayId, orders: initial }: { dayId: string; orders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const supabase = createClient();

  // Assina Realtime: INSERT/UPDATE em orders do dia
  useEffect(() => {
    // Precisamos buscar os itens quando um pedido é inserido/atualizado.
    const fetchItems = async (orderIds: string[]) => {
      const { data } = await supabase
        .from("order_items")
        .select("order_id, product_name, quantity, complement_id")
        .in("order_id", orderIds);
      const map: Record<string, OrderItemLite[]> = {};
      for (const it of data ?? []) {
        (map[it.order_id] ??= []).push({
          product_name: it.product_name,
          quantity: it.quantity,
          complementary: it.complement_id !== null,
        });
      }
      return map;
    };

    const channel = supabase
      .channel(`orders-day-${dayId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `business_day_id=eq.${dayId}` },
        async (payload) => {
          const row = payload.new as Partial<Order> | null;
          if (!row?.id) return;
          const orderId: string = row.id;

          if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            return;
          }

          // refresh do pedido + itens
          const { data: fresh } = await supabase
            .from("orders")
            .select("id, number, customer_name, status, total, paid, created_at, updated_at")
            .eq("id", orderId)
            .single();

          if (!fresh) return;
          const itemsMap = await fetchItems([orderId]);

          setOrders((prev) => {
            const exists = prev.some((o) => o.id === orderId);
            const next: Order = {
              id: fresh.id,
              number: fresh.number,
              customer_name: fresh.customer_name,
              status: fresh.status,
              total: Number(fresh.total),
              paid: fresh.paid,
              created_at: fresh.created_at,
              updated_at: fresh.updated_at,
              items: itemsMap[orderId] ?? [],
            };
            const list = exists
              ? prev.map((o) => (o.id === orderId ? next : o))
              : [...prev, next];
            return list.sort((a, b) => a.number - b.number);
          });
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

  return (
    <div className="space-y-5">
      {actionError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Pedidos do dia</h1>
        <p className="text-sm text-neutral-500">
          Atualização automática · {orders.filter((o) => o.status !== "cancelado").length} pedido(s) ativo(s)
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = byStatus(col.key);
          const prontoTotal = list.filter((o) => o.status === "pronto").length;
          return (
            <div key={col.key} className={`rounded-2xl bg-white p-3 shadow-sm ${col.ring} border-l-4`}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                {col.label} ({list.length})
              </h2>

              {list.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-400">—</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-xl border p-3 ${
                        o.status === "pronto"
                          ? "border-green-300 bg-green-50"
                          : "border-neutral-200"
                      }`}
                    >
                      {/* Número + horário */}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-black text-neutral-900">
                          #{o.number}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${statusDot[o.status]}`}>
                          {statusLabel[o.status]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-800">
                        {o.customer_name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-neutral-500">{time(o.created_at)}</p>

                      {/* Itens + quantidades */}
                      <ul className="mt-2 space-y-0.5">
                        {o.items.length === 0 && (
                          <li className="text-xs text-neutral-400">Sem itens</li>
                        )}
                        {o.items.map((it, i) => (
                          <li key={i} className="flex justify-between text-sm text-neutral-700">
                            <span>
                              {it.complementary && <span className="mr-0.5 text-xs">🔔</span>}
                              {it.quantity}x {it.product_name}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Total */}
                      <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
                        <span className="text-xs text-neutral-500">
                          {o.paid ? "Pago" : "A pagar"}
                        </span>
                        <span className="text-base font-black text-neutral-900">
                          {fmtBRL(o.total)}
                        </span>
                      </div>

                      {/* Cancelar (john, pedido não pago) */}
                      {!o.paid && o.status !== "cancelado" && o.status !== "entregue" && (
                        <form
                          action={async (formData) => {
                            const res = await cancelOrderAction(formData);
                            if (res?.error) setActionError(res.error);
                          }}
                          className="mt-1"
                        >
                          <input type="hidden" name="order_id" value={o.id} />
                          <button
                            type="submit"
                            onClick={(e) => {
                              if (!confirm("Cancelar este pedido? O estoque será devolvido.")) e.preventDefault();
                            }}
                            className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
                          >
                            Cancelar
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}