/** Interpreta valor monetário digitado (pt-BR ou ponto decimal). */
export function parseMoney(raw: string): number {
  const s = raw.replace(/R\$\s?/g, "").trim();
  if (!s) return 0;
  if (s.includes(",")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(s) || 0;
}

/** Formata número para campo de entrada (ex.: 349.5 → "349,50"). */
export function formatMoneyInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
