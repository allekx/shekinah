import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SessionHeader from "./session-header";

/** Layout do app autenticado. Protege a área e monta o shell mobile.
 *  O middleware já redireciona não-autenticados; aqui reforçamos e
 *  montamos o cabeçalho de sessão (nome/perfil + sair).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <SessionHeader
        email={profile?.email ?? user.email ?? ""}
        role={profile?.role ?? "cozinha"}
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-4">
        {children}
      </main>
    </div>
  );
}