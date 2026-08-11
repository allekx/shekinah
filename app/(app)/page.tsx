import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Dashboard principal do John (mobile-first).
 *  - Sem dia aberto → 🌅 INICIAR DIA.
 *  - Com dia aberto → 🟢 DIA EM ANDAMENTO: pedidos hoje, vendas hoje,
 *    em preparo, prontos e estoque baixo.
 *  Ação principal destacada: NOVO PEDIDO.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  // Segurança: john acessa /; cozinha vai para /cozinha.
  if (profile?.role === "cozinha") redirect("/cozinha");

  // Dia aberto atual
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, opened_at, initial_cash")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Métricas do dashboard (somente com dia aberto)
  let ordersCount = 0;
  let salesToday = 0;
  let preparingCount = 0;
  let readyCount = 0;
  let lowStock: { name: string; remaining: number }[] = [];

  if (day) {
    const ordersQuery = supabase
      .from("orders")
      .select("total, status")
      .eq("business_day_id", day.id)
      .neq("status", "cancelado");

    const [ordersRes, lowStockRes] = await Promise.all([
      ordersQuery,
      // estoque baixo (saldo <= 3) — join com produtos
      supabase
        .from("daily_stock")
        .select("initial_qty, sold_qty, products(name)")
        .eq("business_day_id", day.id),
    ]);

    const orders = ordersRes.data ?? [];
    ordersCount = orders.length;
    salesToday = orders.reduce((s, o) => s + Number(o.total), 0);
    preparingCount = orders.filter((o) => o.status === "em_preparo").length;
    readyCount = orders.filter((o) => o.status === "pronto").length;

    lowStock = (lowStockRes.data ?? [])
      .map((s) => ({
        name:
          (Array.isArray(s.products)
            ? s.products[0]?.name
            : (s.products as { name: string } | null)?.name) ?? "?",
        remaining: s.initial_qty - s.sold_qty,
      }))
      .filter((s) => s.remaining <= 3)
      .sort((a, b) => a.remaining - b.remaining);
  }

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ---------- SEM DIA ABERTO ----------
  if (!day) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl">🌅</span>
        <h1 className="mt-4 text-2xl font-black text-neutral-900">Bom dia!</h1>
        <p className="mt-2 max-w-xs text-sm text-neutral-500">
          Nenhum dia aberto. Para registrar pedidos, vendas e caixa, inicie o dia de operação.
        </p>
        <a
          href="/abrir-dia"
          className="mt-8 w-full max-w-sm rounded-2xl bg-blue-600 py-5 text-center text-xl font-black text-white shadow-lg active:scale-[.99]"
        >
          🌅 INICIAR DIA
        </a>
        <p className="mt-6 text-xs text-neutral-400">Acesso restrito · SHEKINAH</p>
      </div>
    );
  }

  // ---------- COM DIA ABERTO ----------
  return (
    <div className="space-y-5 pb-8">
      {/* Status do dia */}
      <section className="rounded-2xl bg-green-600 p-5 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-90">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Dia em andamento
        </p>
        <h1 className="mt-1 text-lg font-black">{day.day}</h1>
        <p className="text-sm opacity-90">
          iniciado às{" "}
          {new Date(day.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>

        {/* métricas principais */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-black">{ordersCount}</p>
            <p className="text-[11px] opacity-90">Pedidos hoje</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-black">{fmtBRL(salesToday)}</p>
            <p className="text-[11px] opacity-90">Vendas hoje</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-black">{preparingCount}</p>
            <p className="text-[11px] opacity-90">Em preparo</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-black">{readyCount}</p>
            <p className="text-[11px] opacity-90">Prontos</p>
          </div>
        </div>
      </section>

      {/* Ação principal: NOVO PEDIDO */}
      <a
        href="/pedidos/novo"
        className="block rounded-2xl bg-neutral-900 py-6 text-center text-xl font-black text-white shadow-md active:scale-[.99]"
      >
        ＋ NOVO PEDIDO
      </a>

      {/* Estoque baixo */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Estoque baixo
        </h2>
        {lowStock.length === 0 ? (
          <p className="py-2 text-center text-sm text-neutral-400">Nenhum produto com estoque baixo 🎉</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {lowStock.map((s) => (
              <li key={s.name} className="flex items-center justify-between py-2">
                <span className="text-sm text-neutral-800">{s.name}</span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    s.remaining === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {s.remaining === 0 ? "ESGOTADO" : `${s.remaining} restante(s)`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ações principais */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">Ações</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/pedidos", label: "Pedidos" },
            { href: "/caixa", label: "Caixa" },
            { href: "/estoque", label: "Estoque" },
            { href: "/fechamento", label: "Encerrar dia", danger: true },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className={`flex items-center justify-center rounded-2xl p-5 text-center text-base font-bold shadow-sm transition active:scale-[.98] ${
                a.danger
                  ? "bg-red-50 text-red-700"
                  : "bg-white text-neutral-800"
              }`}
            >
              {a.label}
            </a>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-neutral-400">
        Histórico e relatórios em /historico · SHEKINAH
      </p>
    </div>
  );
}