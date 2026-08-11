/**
 * Camada de impressão — tipagem da arquitetura modular.
 *
 * Separa:
 *  1) MONTAGEM do documento (ReceiptBuilder) — independente do modelo;
 *  2) TRANSPORTE (PrinterTransport) — plugável, método definido depois.
 *
 * Formato alvo: comanda de pedido e relatório de fechamento para
 * impressora térmica, compatível com ESC/POS quando aplicável.
 * NÃO acopla a um modelo específico de impressora.
 */

/** Uma linha do documento impresso. */
export interface ReceiptLine {
  /** Texto/colunas da linha. */
  text: string;
  /** Alinhamento horizontal. */
  align?: "left" | "center" | "right";
  /** Negrito (ESC/POS quando disponível). */
  bold?: boolean;
  /** Expandido (dobro de largura/altura — cabeçalhos). */
  doubleHeight?: boolean;
  /** Sublinhado. */
  underline?: boolean;
}

/** Montador do documento (agnóstico de impressora). */
export interface ReceiptBuilder {
  /** Largura em colunas (ex.: 32/42/48 dependendo do papel). */
  width: number;
  /** Define a largura. */
  setWidth(w: number): void;
  /** Adiciona linha(s). */
  addLine(line: ReceiptLine | string): this;
  /** Adiciona divisor '--------------------------------'. */
  addDivider(): this;
  /** Linha em branco. */
  addBlank(): this;
  /** Devolve o conteúdo montado (bytes ESC/POS ou texto puro). */
  build(): Uint8Array | string;
}

/** Transporte de impressão (método de conexão — plugável). */
export interface PrinterTransport {
  /** Identificador único (ex.: 'preview', 'bluetooth', 'webusb', 'network'). */
  readonly id: string;
  /** Rótulo exibível. */
  readonly label: string;
  /** Descrição/limitações. */
  readonly description: string;
  /** Conecta à impressora (no método específico). */
  connect(): Promise<void>;
  /** Desconecta. */
  disconnect(): Promise<void>;
  /** Envia os bytes do documento à impressora. */
  print(data: Uint8Array): Promise<void>;
}

/** Documentos suportados. */
export type ReceiptKind = "comanda" | "complemento" | "relatorio";

/** Resultado de uma pré-visualização. */
export interface ReceiptPreview {
  kind: ReceiptKind;
  text: string;
  width: number;
}