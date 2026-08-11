import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProductForm from "./product-form";
import ProductList from "./product-list";

/** Gerenciamento de produtos (somente john). */
export default async function ProdutosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "john") {
    redirect("/");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, unit_price, category, tracks_stock, active")
    .order("active", { ascending: false })
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Produtos</h1>
        <p className="text-sm text-neutral-500">
          Gerencie nome, categoria, preço e disponibilidade.
        </p>
      </header>

      <ProductForm />
      <ProductList products={products ?? []} />
    </div>
  );
}