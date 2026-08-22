"use client";

import { useState } from "react";
import type { ReceiptPreview } from "@/lib/printing/types";

/** Modal de PRÉ-VISUALIZAÇÃO do documento térmico (comanda/relatório). */
export default function PrintPreviewModal({
  preview,
  onClose,
  statusMessage,
}: {
  preview: ReceiptPreview;
  onClose: () => void;
  statusMessage?: string | null;
}) {
  const label =
    preview.kind === "comanda"
      ? "Comanda"
      : preview.kind === "complemento"
        ? "Comanda complementar"
        : "Relatório de fechamento";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sk-card sk-card--elevated w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-bold text-neutral-800">{label}</p>
          <button type="button" onClick={onClose} className="sk-btn-ghost sk-btn-sm">
            Fechar
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto p-4">
          <pre className="rounded-xl bg-neutral-50 p-4 font-mono text-[11px] leading-4 whitespace-pre-wrap break-words">
            {preview.text}
          </pre>
        </div>

        {statusMessage && !statusMessage.startsWith("Pré-visualização") && (
          <div className="border-t border-neutral-200 px-4 py-3">
            <p
              className={`text-center text-xs font-semibold ${
                statusMessage.startsWith("Enviado") ? "text-success-600" : "text-danger-600"
              }`}
            >
              {statusMessage}
            </p>
          </div>
        )}
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
      <button type="button" onClick={() => setOpen(true)} className="sk-btn-dark w-full">
        🖨 {label}
      </button>
      {open && <PrintPreviewModal preview={preview} onClose={() => setOpen(false)} />}
    </>
  );
}
