import type { ReceiptBuilder, ReceiptLine } from "./types";

/**
 * Formatador de documentos para impressora térmica (largura em colunas).
 * Gera TEXTO (para pré-visualização) e BYTES ESC/POS.
 * Independente do modelo de impressora.
 */
export class TextBuilder implements ReceiptBuilder {
  width: number;
  private lines: { text: string; opts: Partial<ReceiptLine> }[] = [];

  constructor(width = 42) {
    this.width = width;
  }

  setWidth(w: number): void {
    this.width = w;
  }

  /** Adiciona uma linha à direita (sem preencher). */
  addLine(line: ReceiptLine | string): this {
    if (typeof line === "string") {
      this.lines.push({ text: line, opts: {} });
    } else {
      this.lines.push({ text: line.text, opts: line });
    }
    return this;
  }

  addDivider(): this {
    this.lines.push({ text: "─".repeat(this.width), opts: {} });
    return this;
  }

  addBlank(): this {
    this.lines.push({ text: "", opts: {} });
    return this;
  }

  /**
   * Formata uma coluna (trunca/pad) em largura.
   * Considera 'visual width' simples (ignora acentos — largo na prática).
   */
  private formatColumn(text: string, width: number, align: "left" | "center" | "right" = "left"): string {
    const visual = this.visualWidth(text);
    if (visual >= width) return text.slice(0, width);
    const pad = width - visual;
    if (align === "center") {
      const left = Math.floor(pad / 2);
      return " ".repeat(left) + text + " ".repeat(pad - left);
    }
    if (align === "right") return " ".repeat(pad) + text;
    return text + " ".repeat(pad);
  }

  private visualWidth(text: string): number {
    // aproximação: caracteres não-latin contam como 1; em térmico a maioria
    // dos caracteres ocupa 1 coluna.
    return Array.from(text).length;
  }

  /** Monta o texto puro (para preview/impressão em rede). */
  build(): string {
    const out: string[] = [];
    for (const line of this.lines) {
      const t = line.text;
      if (line.opts.align === "center") {
        out.push(this.formatColumn(t, this.width, "center").trimEnd());
      } else if (line.opts.align === "right") {
        out.push(this.formatColumn(t, this.width, "right"));
      } else {
        out.push(t.length === 0 ? "" : t);
      }
    }
    return out.join("\n");
  }

  /** Retorna as linhas brutas (para geração ESC/POS). */
  getRawLines(): { text: string; opts: Partial<ReceiptLine> }[] {
    return this.lines;
  }

  /** Linhas já formatadas em texto (com pad/centralização visual). */
  getFormattedLines(): { text: string; opts: Partial<ReceiptLine> }[] {
    return this.lines.map(({ text, opts }) => {
      let t = text;
      if (opts.align === "center") t = this.formatColumn(t, this.width, "center").trimEnd();
      else if (opts.align === "right") t = this.formatColumn(t, this.width, "right");
      return { text: t, opts };
    });
  }
}

export type { ReceiptLine };