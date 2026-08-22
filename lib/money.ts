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

/** Exibe valor no campo estilo banco; `null` = vazio. */
export function reaisToMoneyDisplay(value: number | null): string {
  if (value === null) return "";
  return formatMoneyInput(value);
}

/** Converte dígitos digitados (centavos) em reais — ex.: "3500" → 35. */
export function moneyDigitsToReais(digits: string): number | null {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return null;
  return parseInt(clean, 10) / 100;
}

/** Handler para input monetário estilo app bancário. */
export function parseMoneyFieldInput(raw: string): number | null {
  return moneyDigitsToReais(raw);
}
