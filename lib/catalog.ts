/** Utilitários compartilhados de catálogo (ordenar categorias, montar produtos). */

export interface CatalogProduct {
  id: number;
  name: string;
  unit_price: number;
  category: string | null;
  tracks_stock: boolean;
  available: number | null;
}

export function categoryRank(category: string) {
  const name = category.toLowerCase();
  if (name === "pratos") return 0;
  if (name === "porções" || name === "porcoes") return 1;
  if (name === "bebidas") return 2;
  if (name === "sobremesas") return 3;
  return 4;
}

/** Agrupa produtos por categoria e ordena (Pratos → Porções → Bebidas → …). */
export function groupProductsByCategory(products: CatalogProduct[]) {
  const map: Record<string, CatalogProduct[]> = {};
  for (const p of products) {
    const key = p.category ?? "Outros";
    (map[key] ??= []).push(p);
  }
  return Object.entries(map).sort(([a], [b]) => {
    const diff = categoryRank(a) - categoryRank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "pt-BR");
  });
}

export function buildProductMap(products: CatalogProduct[]) {
  return new Map(products.map((p) => [p.id, p]));
}

export const parseQtyInput = (raw: string, max: number | null) => {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  const num = Number(digits);
  if (max !== null) return Math.min(num, max);
  return num;
};
