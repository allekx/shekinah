"use client";

import PageShell from "@/components/page-shell";

interface HistoryDay {
  id: string;
  day: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  initial_cash: number;
  orders_count: number;
  total_sales: number;
  cash_difference: number | null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Lista de dias encerrados (somente leitura). */
export default function HistoryList({ days }: { days: HistoryDay[] }) {
  return (
    <PageShell title="Histórico" subtitle="Dias de operação encerrados.">
      {days.length === 0 && (
        <p className="sk-empty">Nenhum dia encerrado ainda.</p>
      )}

      <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {days.map((d) => {
          const date = new Date(d.day + "T00:00:00");
          return (
            <li key={d.id}>
              <a
                href={`/relatorio/${d.id}`}
                className="sk-card sk-card--interactive block p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-black text-neutral-900">
                    {date.toLocaleDateString("pt-BR")}
                  </p>
                  <span
                    className={`sk-badge ${
                      d.status === "aberto" ? "sk-badge--success" : "sk-badge--neutral"
                    }`}
                  >
                    {d.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm sk-text-muted">{d.orders_count} pedido(s)</p>
                <p className="sk-figure text-base text-neutral-900">{fmtBRL(d.total_sales)}</p>
                {d.status === "fechado" && (
                  <p className="mt-2 text-xs sk-text-muted">
                    {d.cash_difference !== null && Number(d.cash_difference) === 0
                      ? "Caixa conferido"
                      : `Diferença de ${fmtBRL(Math.abs(Number(d.cash_difference ?? 0)))}`}
                  </p>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      {days.length > 0 && (
        <p className="text-center text-xs sk-text-muted">
          Toque em um dia para ver o relatório detalhado.
        </p>
      )}
    </PageShell>
  );
}
