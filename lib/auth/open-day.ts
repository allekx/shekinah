"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OpenDayResult {
  error?: string;
}

/** Abre o dia de operação.
 *  Valida que o usuário é john, chama a RPC open_business_day
 *  (transacional no banco: cria business_day + daily_stock, bloqueia
 *  dois dias abertos). Redireciona ao dashboard em caso de sucesso.
 */
export async function openDay(
  _prev: OpenDayResult,
  formData: FormData
): Promise<OpenDayResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  // Caixa inicial do formulário (formato brasileiro -> número)
  const cashRaw = String(formData.get("initial_cash") ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const initialCash = Number(cashRaw);
  if (Number.isNaN(initialCash) || initialCash < 0) {
    return { error: "Caixa inicial inválido." };
  }

  // Itens (product_id + quantity) enviados via campos ocultos
  const items: { product_id: number; quantity: number }[] = [];
  const ids = formData.getAll("product_id");
  const quantities = formData.getAll("quantity");

  if (ids.length === 0) {
    return { error: "Informe o estoque inicial dos produtos." };
  }

  for (let i = 0; i < ids.length; i++) {
    const productId = Number(String(ids[i]));
    const quantity = Number(String(quantities[i] ?? 0));
    if (productId > 0 && quantity >= 0) {
      items.push({ product_id: productId, quantity });
    }
  }

  if (items.length === 0) {
    return { error: "Estoque inicial inválido." };
  }

  const { data, error } = await supabase.rpc("open_business_day", {
    p_initial_cash: initialCash,
    p_stock: items,
  });

  if (error) {
    const message = mapOpenDayError(error.message);
    return { error: message };
  }

  if (!data) {
    return { error: "Não foi possível abrir o dia." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

function mapOpenDayError(message: string): string {
  if (message.includes("DIA_JA_ABERTO")) {
    return "Já existe um dia aberto. Feche-o antes de abrir um novo.";
  }
  if (message.includes("PERMISSAO_NEGADA")) {
    return "Você não tem permissão para abrir o dia.";
  }
  if (message.includes("ESTOQUE_INICIAL_INVALIDO")) {
    return "Estoque inicial inválido.";
  }
  if (message.includes("PRODUTO_NAO_ENCONTRADO")) {
    return "Um dos produtos não foi encontrado.";
  }
  if (
    message.includes("business_days_day_key") ||
    message.includes("duplicate key value violates unique constraint")
  ) {
    // Constraint business_days_day_key (UNIQUE day): já existe registro para a
    // data de hoje (ex.: dia encerrado). A migration 0020 remove essa trava
    // (permite reabrir no mesmo dia após fechamento); até ela ser aplicada,
    // a mensagem mostra a causa real em vez de um erro genérico.
    return "Já existe um registro para a data de hoje. Nesta versão não é possível abrir outro dia na mesma data — aguarde a data virar.";
  }
  return "Não foi possível abrir o dia. Tente novamente.";
}