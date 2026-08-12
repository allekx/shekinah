import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Dashboard principal do John (mobile-first).
 *  - Sem dia aberto → 🌅 INICIAR DIA.
 *  - Com dia aberto → 🟢 DIA EM ANDAMENTO: pedidos hoje, vendas hoje,
 *    em preparo, prontos e estoque baixo.
 *  Ação principal destacada: NOVO PEDIDO.
 */
export default async function HomePage() {
  const supabase = await createClient();

  // Segurança: john acessa /; cozinha vai para /cozinha.
  if ((await getRole()) === "cozinha") redirect("/cozinha");

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
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#3f6ee0] to-[#2844a8] text-3xl shadow-lg shadow-[#2e54c9]/25">
          <span>🌅</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Bom dia!</h1>
        <p className="mt-2 max-w-xs text-sm text-neutral-500">
          Nenhum dia aberto. Para registrar pedidos, vendas e caixa, inicie o dia de operação.
        </p>
        <a
          href="/abrir-dia"
          className="sk-btn-primary mt-8 w-full max-w-sm py-5 text-lg"
        >
          INICIAR DIA
        </a>
        <p className="mt-6 text-xs text-neutral-400">Acesso restrito</p>
      </div>
    );
  }

  // ---------- COM DIA ABERTO ----------
  return (
    <div className="space-y-5 pb-8">
      {/* Status do dia */}
      <section className="rounded-[1.25rem] bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-5 text-white shadow-[0_10px_30px_rgb(23_25_35_/0.18)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Em andamento
          </p>
          <span className="sk-badge sk-badge--success">Dia ativo</span>
        </div>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight">{day.day}</h1>
        <p className="text-sm text-neutral-300">
          iniciado às{" "}
          {new Date(day.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>

        {/* métricas principais */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
            <p className="sk-figure text-2xl text-white">{ordersCount}</p>
            <p className="text-[11px] font-medium text-neutral-300">Pedidos hoje</p>
          </div>
          <div className="rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
            <p className="sk-figure text-2xl text-white">{fmtBRL(salesToday)}</p>
            <p className="text-[11px] font-medium text-neutral-300">Vendas hoje</p>
          </div>
          <div className="rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
            <p className="sk-figure text-2xl text-white">{preparingCount}</p>
            <p className="text-[11px] font-medium text-neutral-300">Em preparo</p>
          </div>
          <div className="rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
            <p className="sk-figure text-2xl text-emerald-300">{readyCount}</p>
            <p className="text-[11px] font-medium text-neutral-300">Prontos</p>
          </div>
        </div>
      </section>

      {/* Ação principal: NOVO PEDIDO */}
      <a
        href="/pedidos/novo"
        className="block rounded-[1.25rem] bg-gradient-to-b from-[#2e54c9] to-[#2844a8] py-6 text-center text-lg font-extrabold tracking-tight text-white shadow-lg shadow-[#2e54c9]/25 transition hover:from-[#3163d4] hover:to-[#2844a8] active:scale-[.985]"
      >
        ＋ NOVO PEDIDO
      </a>

      {/* Estoque baixo */}
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Estoque baixo</h2>
        {lowStock.length === 0 ? (
          <p className="py-2 text-center text-sm text-neutral-400">Nenhum produto com estoque baixo 🎉</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {lowStock.map((s) => (
              <li key={s.name} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-neutral-800">{s.name}</span>
                <span
                  className={`sk-badge ${
                    s.remaining === 0 ? "sk-badge--danger" : "sk-badge--warn"
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
        <h2 className="sk-section-title mb-3">Ações</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/pedidos", label: "Pedidos", icon: "📋" },
            { href: "/caixa", label: "Caixa", icon: "💰" },
            { href: "/estoque", label: "Estoque", icon: "📦" },
            { href: "/fechamento", label: "Encerrar dia", icon: "🔒", danger: true },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className={`flex items-center justify-center gap-2 rounded-[1rem] p-5 text-center text-base font-bold shadow-sm transition active:scale-[.98] ${
                a.danger
                  ? "border border-red-100 bg-red-50 text-red-700 hover:bg-red-100"
                  : "sk-card sk-card--interactive text-neutral-800"
              }`}
            >
              <span className="text-lg">{a.icon}</span>
              {a.label}
            </a>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-neutral-400">
        Histórico e relatórios
      </p>
    </div>
  );
}