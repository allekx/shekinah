import { getUser, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SessionHeader from "./session-header";

/** Layout do app autenticado. Protege a área e monta o shell mobile.
 *  O middleware já redireciona não-autenticados; aqui reforçamos e
 *  montamos o cabeçalho de sessão (nome/perfil + sair).
 *
 *  Usa getUser()/getRole() MEMOIZADOS (React cache) — o papel é buscado
 *  UMA vez por request e compartilhado com as páginas (ver server.ts).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const role = (await getRole()) ?? "cozinha";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <SessionHeader
        email={user.email ?? ""}
        role={role}
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-4">
        {children}
      </main>
    </div>
  );
}