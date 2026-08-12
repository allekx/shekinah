"use client";

import BackButton from "@/components/back-button";

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
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Histórico</h1>
          <p className="text-sm text-neutral-500">Dias de operação encerrados.</p>
        </div>
      </header>

      {days.length === 0 && (
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-neutral-500 shadow-sm">
          Nenhum dia encerrado ainda.
        </p>
      )}

      <ul className="space-y-3">
        {days.map((d) => {
          const date = new Date(d.day + "T00:00:00");
          return (
            <li key={d.id}>
              <a
                href={`/relatorio/${d.id}`}
                className="block rounded-2xl bg-white p-4 shadow-sm transition active:scale-[.99]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-neutral-900">
                    {date.toLocaleDateString("pt-BR")}
                  </p>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      d.status === "aberto" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {d.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  {d.orders_count} pedido(s)
                </p>
                <p className="text-base font-bold text-neutral-900">{fmtBRL(d.total_sales)}</p>
                {d.status === "fechado" && (
                  <p className="mt-1 text-xs text-neutral-400">
                    {d.cash_difference !== null && Number(d.cash_difference) === 0
                      ? "🟢 caixa conferido"
                      : `🔴 diferença de ${fmtBRL(Math.abs(Number(d.cash_difference ?? 0)))}`}
                  </p>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-xs text-neutral-400">
        Toque em um dia para ver o relatório detalhado.
      </p>
    </div>
  );
}