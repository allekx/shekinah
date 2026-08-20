/** Variantes de skeleton exibidas imediatamente ao iniciar navegação. */
export type NavSkeletonVariant =
  | "home"
  | "open-day"
  | "new-order"
  | "kanban-4"
  | "kanban-3"
  | "cashier"
  | "product-list"
  | "generic-list"
  | "report";

/** Mapeia rota de destino → skeleton mais próximo da tela final. */
export function skeletonVariantForPath(path: string): NavSkeletonVariant {
  const base = path.split("?")[0]?.split("#")[0] ?? path;

  if (base === "/") return "home";
  if (base === "/abrir-dia") return "open-day";
  if (base.startsWith("/pedidos/novo")) return "new-order";
  if (base === "/pedidos") return "kanban-4";
  if (base === "/cozinha") return "kanban-3";
  if (base === "/caixa") return "cashier";
  if (base === "/estoque") return "product-list";
  if (base === "/relatorio" || base.startsWith("/relatorio/")) return "report";

  return "generic-list";
}
