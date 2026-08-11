"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ProductActionResult {
  error?: string;
}

/** Cria um novo produto (somente john via RLS). */
export async function createProduct(formData: FormData): Promise<ProductActionResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const priceRaw = String(formData.get("unit_price") ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const unitPrice = Number(priceRaw);
  const tracksStock = formData.get("tracks_stock") === "on";

  if (!name) return { error: "Informe o nome do produto." };
  if (Number.isNaN(unitPrice) || unitPrice < 0) return { error: "Preço inválido." };

  const { error } = await supabase.from("products").insert({
    name,
    category,
    unit_price: unitPrice,
    tracks_stock: tracksStock,
    active: true,
  });

  if (error) {
    const msg = error.message.includes("PERMISSAO_NEGADA")
      ? "Você não tem permissão para criar produtos."
      : "Não foi possível criar o produto.";
    return { error: msg };
  }

  revalidatePath("/produtos", "layout");
  return {};
}

/** Atualiza um produto existente (somente john via RLS). */
export async function updateProduct(formData: FormData): Promise<ProductActionResult> {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const priceRaw = String(formData.get("unit_price") ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const unitPrice = Number(priceRaw);
  const tracksStock = formData.get("tracks_stock") === "on";
  const active = formData.get("active") === "on";

  if (!name) return { error: "Informe o nome do produto." };
  if (Number.isNaN(unitPrice) || unitPrice < 0) return { error: "Preço inválido." };

  const { error } = await supabase
    .from("products")
    .update({ name, category, unit_price: unitPrice, tracks_stock: tracksStock, active })
    .eq("id", id);

  if (error) {
    return {
      error: error.message.includes("PERMISSAO_NEGADA")
        ? "Você não tem permissão para editar produtos."
        : "Não foi possível atualizar o produto.",
    };
  }

  revalidatePath("/produtos", "layout");
  return {};
}

/** Remove (ou desativa) um produto. Usa soft delete (active=false). */
export async function toggleProductActive(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "false"; // se veio false, vira true (reverso)

  await supabase.from("products").update({ active }).eq("id", id);
  revalidatePath("/produtos", "layout");
}