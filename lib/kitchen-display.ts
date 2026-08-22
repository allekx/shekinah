/** Itens visíveis na cozinha — complemento reaberto não repete pratos já prontos. */

export interface KitchenComplementRow {
  id: string;
  kitchen_status: string;
}

export interface KitchenItemRow {
  product_name: string;
  quantity: number;
  complement_id: string | null;
}

export interface KitchenDisplayItem {
  name: string;
  qty: number;
  complement: boolean;
}

export function pendingComplementIds(complements: KitchenComplementRow[]): Set<string> {
  return new Set(
    complements.filter((c) => c.kitchen_status !== "pronto").map((c) => c.id)
  );
}

/** Filtra itens: só complemento pendente após reabertura; pedido novo = itens originais. */
export function kitchenItemsForDisplay(
  status: string,
  items: KitchenItemRow[],
  complements: KitchenComplementRow[]
): KitchenDisplayItem[] {
  const pending = pendingComplementIds(complements);

  if (pending.size === 0) {
    return items
      .filter((it) => it.complement_id === null)
      .map((it) => ({
        name: it.product_name,
        qty: it.quantity,
        complement: false,
      }));
  }

  if (status === "novo") {
    return items
      .filter((it) => it.complement_id !== null && pending.has(it.complement_id))
      .map((it) => ({
        name: it.product_name,
        qty: it.quantity,
        complement: true,
      }));
  }

  return items
    .filter(
      (it) =>
        it.complement_id === null ||
        (it.complement_id !== null && pending.has(it.complement_id))
    )
    .map((it) => ({
      name: it.product_name,
      qty: it.quantity,
      complement: it.complement_id !== null,
    }));
}

export function isComplementReopen(
  status: string,
  complements: KitchenComplementRow[]
): boolean {
  return status === "novo" && pendingComplementIds(complements).size > 0;
}
