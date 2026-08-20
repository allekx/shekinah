import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import ProductForm from "./product-form";
import ProductList from "./product-list";

/** Gerenciamento de produtos (somente john). */
export default async function ProdutosPage() {
  const supabase = await createClient();

  // Papel memoizado (mesma consulta do layout — uma única vez por request).
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, unit_price, category, tracks_stock, active")
    .order("active", { ascending: false })
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return (
    <PageShell
      title="Produtos"
      subtitle="Gerencie nome, categoria, preço e disponibilidade."
    >
      <ProductForm />
      <ProductList products={products ?? []} />
    </PageShell>
  );
}