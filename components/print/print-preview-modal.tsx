"use client";

import { useState } from "react";
import type { ReceiptPreview } from "@/lib/printing/types";

/** Modal de PRÉ-VISUALIZAÇÃO do documento térmico (comanda/relatório).
 *  Exibe o texto formatado em fonte monoespaçada (como seria impresso),
 *  independente do modelo de impressora.
 */
export default function PrintPreviewModal({
  preview,
  onClose,
}: {
  preview: ReceiptPreview;
  onClose: () => void;
}) {
  const label =
    preview.kind === "comanda"
      ? "Comanda"
      : preview.kind === "complemento"
        ? "Comanda complementar"
        : "Relatório de fechamento";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-bold text-neutral-800">🖨 {label} · pré-visualização</p>
          <button onClick={onClose} className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">
            Fechar
          </button>
        </div>

        {/* Conteúdo monoespaçado */}
        <div className="max-h-[60vh] overflow-auto p-4">
          <pre className="rounded-xl bg-neutral-50 p-4 font-mono text-[11px] leading-4 whitespace-pre-wrap break-words">
            {preview.text}
          </pre>
        </div>

        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-center text-[11px] text-neutral-400">
            Visualização da comanda em formato de impressão.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Botão que abre a pré-visualização. */
export function PrintPreviewButton({
  preview,
  label = "Ver impressão",
}: {
  preview: ReceiptPreview;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white"
      >
        🖨 {label}
      </button>
      {open && <PrintPreviewModal preview={preview} onClose={() => setOpen(false)} />}
    </>
  );
}