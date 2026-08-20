import Image from "next/image";
import { createClient, getRole } from "@/lib/supabase/server";
import { getTimeGreeting } from "@/lib/greeting";
import { redirect } from "next/navigation";
import HomeDashboard from "./home-dashboard";
import StartDayLink from "@/components/start-day-link";

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

  const openedAtLabel = day
    ? new Date(day.opened_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const greeting = getTimeGreeting();

  // ---------- SEM DIA ABERTO ----------
  if (!day) {
    return (
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
        <section className="relative min-h-[14rem] shrink-0 overflow-hidden rounded-[1.75rem] px-6 pt-6 pb-20 lg:min-h-[18rem]">
          <Image
            src="/home-hero.png"
            alt="Pratos servidos no restaurante"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 56rem"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/20"
            aria-hidden
          />

          <div className="relative">
            <h1 className="max-w-xs text-[2rem] leading-tight font-bold tracking-tight text-white drop-shadow-sm lg:max-w-md lg:text-[2.25rem]">
              {greeting}!
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/90 drop-shadow-sm lg:max-w-md">
              Nenhum dia aberto. Para registrar pedidos, vendas e caixa, inicie
              o dia de operação.
            </p>
          </div>
        </section>

        <section className="relative mt-4 flex flex-1 flex-col rounded-[1.75rem] bg-white px-6 pt-8 pb-8 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 text-xl font-bold tracking-tight text-neutral-900">
            Pronto para começar?
          </h2>
          <p className="mb-7 text-sm leading-relaxed text-neutral-500">
            Informe o estoque inicial e o caixa para abrir o dia de operação.
          </p>

          <StartDayLink />

          <p className="mt-auto pt-10 text-center text-xs text-neutral-400">
            Acesso restrito
          </p>
        </section>
      </div>
    );
  }

  // ---------- COM DIA ABERTO ----------
  return (
    <HomeDashboard
      dayId={day.id}
      day={day.day}
      openedAtLabel={openedAtLabel}
      initialOrdersCount={ordersCount}
      initialSalesToday={salesToday}
      initialPreparingCount={preparingCount}
      initialReadyCount={readyCount}
      initialLowStock={lowStock}
    />
  );
}