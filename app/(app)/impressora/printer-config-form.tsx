"use client";

import { useActionState } from "react";
import PageShell from "@/components/page-shell";
import { updatePrinterSettings, type PrinterSettingsResult } from "@/lib/auth/printer-settings";
import type { PrinterConfig } from "@/lib/printing/settings";

export default function PrinterConfigForm({ config }: { config: PrinterConfig }) {
  const [state, formAction, pending] = useActionState<PrinterSettingsResult, FormData>(
    updatePrinterSettings,
    {}
  );

  return (
    <PageShell title="Impressora" subtitle="Configuração da térmica na rede">
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Modo atual</h2>
        <p className="text-sm text-neutral-700">
          {config.transport === "network"
            ? "Rede Wi-Fi — tentará imprimir na URL configurada."
            : "Pré-visualização — só mostra o cupom na tela (até conectar a impressora)."}
        </p>
      </section>

      <form action={formAction} className="sk-card space-y-4 p-4">
        <div>
          <label className="sk-label">Modo</label>
          <select
            name="transport"
            defaultValue={config.transport === "network" ? "network" : "preview"}
            className="sk-input"
          >
            <option value="preview">Pré-visualização (sem impressora)</option>
            <option value="network">Rede Wi-Fi (impressora real)</option>
          </select>
        </div>

        <div>
          <label className="sk-label">URL da impressora na rede</label>
          <input
            name="network_url"
            type="url"
            inputMode="url"
            defaultValue={config.networkUrl ?? ""}
            placeholder="http://192.168.0.100:8080/print"
            className="sk-input font-mono text-sm"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Celular e impressora na mesma rede Wi-Fi. A URL depende do modelo — consulte o
            manual (endpoint HTTP que aceita bytes ESC/POS).
          </p>
        </div>

        <div>
          <label className="sk-label">Largura do papel (colunas)</label>
          <input
            name="width"
            type="number"
            min={32}
            max={48}
            defaultValue={config.width}
            className="sk-input w-28"
          />
        </div>

        {state?.error && (
          <p role="alert" className="sk-alert-error">
            {state.error}
          </p>
        )}
        {state?.saved && !state?.error && (
          <p className="sk-alert-success">Configuração salva.</p>
        )}

        <button type="submit" disabled={pending} className="sk-btn-primary w-full">
          {pending ? "Salvando…" : "Salvar configuração"}
        </button>
      </form>

      <section className="sk-card space-y-2 p-4 text-sm text-neutral-600">
        <h2 className="sk-section-title">Ao comprar a impressora</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Prefira térmica ESC/POS com Wi-Fi/Ethernet.</li>
          <li>Confirme se aceita impressão por **HTTP** (navegador não acessa porta TCP 9100 direto).</li>
          <li>Conecte impressora e celular na **mesma rede** do sítio.</li>
          <li>Salve aqui a URL e mude o modo para &quot;Rede Wi-Fi&quot;.</li>
          <li>Comandas, complementos e relatório já usam o mesmo formato de cupom.</li>
        </ul>
      </section>
    </PageShell>
  );
}
