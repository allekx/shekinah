/**
 * Kit ESC/POS — comandos básicos para impressoras térmicas.
 * Compatível com a maioria das impressoras ESC/POS (medidas),
 * sem acoplar a um modelo específico.
 */

/** Sequências de controle ESC/POS mais comuns. */
export const ESC = 0x1b;
export const GS = 0x1d;

export const ESCPOS = {
  /** Reset / inicializa. */
  INIT: [ESC, 0x40],
  /** Linha em branco (LF). */
  LF: [0x0a],
  /** Alinha à esquerda. */
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  /** Centraliza. */
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  /** Alinha à direita. */
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  /** Negrito on/off. */
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  /** Sublinhado on/off (2pt). */
  UNDERLINE_ON: [ESC, 0x2d, 0x02],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  /** Dobro de altura via GS ! (tamanho de caractere). 0x10 = altura dupla (fonte A). */
  DOUBLE_H_ON: [GS, 0x21, 0x01 | 0x10],
  DOUBLE_H_OFF: [GS, 0x21, 0x00],
  /** Assume ascii + latin (pt-BR). */
  CHARSET_LATIN1: [ESC, 0x74, 0x03],
} as const;

/** Codifica texto em bytes (assume Latin-1/cp850 para compatibilidade). */
export function encodeText(text: string): number[] {
  // codifica como UTF-8 e depois converge caracteres acentuados simples
  // para a tabela latin1 (0x80-0xff) quando possível.
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) {
      out.push(code);
    } else {
      // tenta mapear para cp437/cp850 — fallback para '?'
      const mapped = latin1Map.get(ch);
      out.push(mapped ?? 0x3f);
    }
  }
  return out;
}

/** Mapa mínimo de acentuação pt-BR para latin-1 (cp850 compatível). */
const latin1Map = new Map<string, number>([
  ["á", 0xe1], ["à", 0xe0], ["ã", 0xe3], ["â", 0xe2], ["ä", 0xe4],
  ["é", 0xe9], ["è", 0xe8], ["ê", 0xea], ["í", 0xed], ["ì", 0xec],
  ["ó", 0xf3], ["ò", 0xf2], ["õ", 0xf5], ["ô", 0xf4], ["ö", 0xf6],
  ["ú", 0xfa], ["ù", 0xf9], ["û", 0xfb], ["ü", 0xfc],
  ["ç", 0xe7], ["ñ", 0xf1],
  ["Á", 0xc1], ["À", 0xc0], ["Ã", 0xc3], ["Â", 0xc2], ["Ä", 0xc4],
  ["É", 0xc9], ["È", 0xc8], ["Ê", 0xca], ["Í", 0xcd], ["Ì", 0xcc],
  ["Ó", 0xd3], ["Ò", 0xd2], ["Õ", 0xd5], ["Ô", 0xd4], ["Ö", 0xd6],
  ["Ú", 0xda], ["Ù", 0xd9], ["Û", 0xdb], ["Ü", 0xdc],
  ["Ç", 0xc7], ["Ñ", 0xd1],
  ["—", 0x2d], ["–", 0x2d],
  ["”", 0x22], ["“", 0x22], [">", 0x3e], ["<", 0x3c], ["&", 0x26],
]);

/**
 * Monta uma linha ESC/POS completa (alinhamento + estilos + texto + LF).
 * Recebe o texto já formatado em colunas do TextBuilder.
 */
export function buildLine(
  text: string,
  opts: {
    align?: "left" | "center" | "right";
    bold?: boolean;
    underline?: boolean;
    doubleHeight?: boolean;
  } = {}
): number[] {
  const bytes: number[] = [...ESCPOS.CHARSET_LATIN1];

  if (opts.align === "center") bytes.push(...ESCPOS.ALIGN_CENTER);
  else if (opts.align === "right") bytes.push(...ESCPOS.ALIGN_RIGHT);
  else bytes.push(...ESCPOS.ALIGN_LEFT);

  if (opts.bold) bytes.push(...ESCPOS.BOLD_ON);
  if (opts.underline) bytes.push(...ESCPOS.UNDERLINE_ON);
  if (opts.doubleHeight) bytes.push(...ESCPOS.DOUBLE_H_ON);

  bytes.push(...encodeText(text));

  if (opts.doubleHeight) bytes.push(...ESCPOS.DOUBLE_H_OFF);
  if (opts.underline) bytes.push(...ESCPOS.UNDERLINE_OFF);
  if (opts.bold) bytes.push(...ESCPOS.BOLD_OFF);

  bytes.push(...ESCPOS.LF);
  return bytes;
}

/** Gera um documento ESC/POS completo a partir do texto pré-formatado. */
export function buildEscposDocument(lines: { text: string; opts?: import("./types").ReceiptLine }[]): number[] {
  const out: number[] = [...ESCPOS.INIT, ...ESCPOS.CHARSET_LATIN1];
  for (const line of lines) {
    out.push(
      ...buildLine(line.text, {
        align: line.opts?.align,
        bold: line.opts?.bold,
        underline: line.opts?.underline,
        doubleHeight: line.opts?.doubleHeight,
      })
    );
  }
  return out;
}