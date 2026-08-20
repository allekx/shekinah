"use client";

import { useState } from "react";
import type { PrintResult } from "@/lib/printing/print";
import type { ReceiptPreview } from "@/lib/printing/types";
import PrintPreviewModal from "./print-preview-modal";

/** Botão que envia à impressora (se configurada) e mostra pré-visualização. */
export default function PrintReceiptButton({
  label,
  onPrint,
}: {
  label: string;
  onPrint: () => Promise<PrintResult>;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    setStatus(null);
    try {
      const result = await onPrint();
      setPreview(result.preview);
      setOpen(true);
      if (result.ok) {
        setStatus(
          result.sentToPrinter
            ? "Enviado para a impressora."
            : "Pré-visualização na tela (modo teste)."
        );
      } else {
        setStatus(result.error ?? "Falha ao imprimir. Confira a pré-visualização.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="sk-btn-dark w-full"
      >
        {pending ? "Enviando…" : `🖨 ${label}`}
      </button>
      {open && preview && (
        <PrintPreviewModal
          preview={preview}
          onClose={() => setOpen(false)}
          statusMessage={status}
        />
      )}
    </>
  );
}
