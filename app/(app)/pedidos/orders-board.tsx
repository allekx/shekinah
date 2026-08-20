"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelOrderAction } from "@/lib/auth/orders";
import PageShell from "@/components/page-shell";
import AddItemsModal from "./add-items-modal";

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

interface Product {
  id: number;
  name: string;
  unit_price: number;
  category: string | null;
  tracks_stock: boolean;
  available: number | null;
}

interface ColumnDef {
  key: string;
  label: string;
  dot: string;
  badge: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "novo", label: "NOVOS", dot: "bg-red-500", badge: "sk-badge--danger" },
  { key: "em_preparo", label: "EM PREPARO", dot: "bg-amber-500", badge: "sk-badge--warn" },
  { key: "pronto", label: "PRONTOS", dot: "bg-green-500", badge: "sk-badge--success" },
  { key: "entregue", label: "FINALIZADOS", dot: "bg-neutral-400", badge: "sk-badge--neutral" },
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
const statusBadge: Record<string, string> = {
  novo: "sk-badge--danger",
  em_preparo: "sk-badge--warn",
  pronto: "sk-badge--success",
  entregue: "sk-badge--neutral",
  cancelado: "sk-badge--neutral",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Quadro de pedidos do dia com atualização em tempo real (Realtime em orders). */
export default function OrdersBoard({
  dayId,
  orders: initial,
  products,
}: {
  dayId: string;
  orders: Order[];
  products: Product[];
}) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<Order | null>(null);
  const supabase = createClient();

  // Um pedido pode receber itens enquanto não estiver pago/cancelado/entregue
  // (regra da RPC add_items_to_order: novo/em_preparo/pronto com dia aberto).
  const canAddItems = (o: Order) => !o.paid && o.status !== "cancelado" && o.status !== "entregue";

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
          const row =
            (payload.new as Partial<Order> | null) ??
            (payload.old as Partial<Order> | null);
          if (!row?.id) return;
          const orderId: string = row.id;

          if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            return;
          }

          // Atualização rápida de status (cozinha → em preparo / pronto)
          if (payload.eventType === "UPDATE" && payload.new && "status" in payload.new) {
            const updated = payload.new as Partial<Order>;
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === orderId);
              if (!exists && updated.status) {
                return prev;
              }
              return prev
                .map((o) =>
                  o.id === orderId
                    ? {
                        ...o,
                        status: updated.status ?? o.status,
                        total: updated.total != null ? Number(updated.total) : o.total,
                        paid: updated.paid ?? o.paid,
                        updated_at: updated.updated_at ?? o.updated_at,
                      }
                    : o
                )
                .sort((a, b) => a.number - b.number);
            });
          }

          // refresh completo do pedido + itens
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
    <PageShell
      title="Pedidos do dia"
      subtitle={`${orders.filter((o) => o.status !== "cancelado").length} pedido(s) ativo(s)`}
    >
      {actionError && (
        <p role="alert" className="sk-alert-error">{actionError}</p>
      )}
      {/* Modal de adicionar itens (complemento) */}
      {addFor && (
        <AddItemsModal
          order={addFor}
          products={products}
          onClose={() => setAddFor(null)}
          onAdded={({ id, total }) => {
            // atualiza o total local (o Realtime também vai refetchar itens)
            setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, total } : o)));
          }}
        />
      )}

      <div className="sk-kanban sk-kanban--4">
        {COLUMNS.map((col) => {
          const list = byStatus(col.key);
          return (
            <div key={col.key} className="sk-card p-3">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                {col.label}
                <span className={`sk-badge ${col.badge}`}>{list.length}</span>
              </h2>

              {list.length === 0 ? (
                <p className="sk-empty py-6 text-xs">—</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((o) => (
                    <li
                      key={o.id}
                      className={`sk-card sk-card--interactive p-3 ${
                        o.status === "pronto"
                          ? "border-green-200 bg-green-50/50"
                          : ""
                      }`}
                    >
                      {/* Número + horário */}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-black text-neutral-900">
                          #{o.number}
                        </span>
                        <span className={`sk-badge ${statusBadge[o.status]}`}>
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
                        <span className="text-xs sk-text-muted">
                          {o.paid ? "Pago" : "A pagar"}
                        </span>
                        <span className="text-base font-black text-neutral-900 tabular-nums">
                          {fmtBRL(o.total)}
                        </span>
                      </div>

                      {/* Ações: Adicionar itens (adicionável) + Cancelar (não pago) */}
                      {(canAddItems(o) || (!o.paid && o.status !== "cancelado")) && (
                        <div className="mt-2 flex gap-2">
                          {canAddItems(o) && (
                            <button
                              type="button"
                              onClick={() => setAddFor(o)}
                              className="sk-btn-ghost flex-1 text-xs"
                            >
                              ＋ Adicionar itens
                            </button>
                          )}
                          {!o.paid && o.status !== "cancelado" && o.status !== "entregue" && (
                            <form
                              action={async (formData) => {
                                const res = await cancelOrderAction(formData);
                                if (res?.error) setActionError(res.error);
                              }}
                              className="flex-1"
                            >
                              <input type="hidden" name="order_id" value={o.id} />
                              <button
                                type="submit"
                                onClick={(e) => {
                                  if (!confirm("Cancelar este pedido? O estoque será devolvido.")) e.preventDefault();
                                }}
                                className="sk-btn-danger w-full text-xs"
                              >
                                Cancelar
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}