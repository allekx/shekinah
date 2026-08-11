import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Middleware de sessão:
 *  - faz refresh do token (mantém sessão viva)
 *  - protege rotas: não autenticado → /login
 *  - guarda por perfil: cozinha → sempre /cozinha; john bloqueado de rotas exclusivas cozinha
 *
 * Usa cookie httpOnly de sessão do Supabase (anon key, nunca service_role).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: NÃO executar request para /login-/logout nem rotas estáticas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas públicas
  if (pathname === "/login") {
    if (user) {
      // redireciona por perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = profile?.role;
      return NextResponse.redirect(
        new URL(role === "cozinha" ? "/cozinha" : "/", request.url)
      );
    }
    return supabaseResponse;
  }

  // Rotas protegidas
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // preserva o destino original
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Guarda por perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;

  // cozinha só acessa /cozinha; john acessa as demais, mas não /cozinha
  if (role === "cozinha" && pathname !== "/cozinha") {
    return NextResponse.redirect(new URL("/cozinha", request.url));
  }
  if (role !== "cozinha" && pathname === "/cozinha") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas exceto:
     * - _next/static, _next/image, favicon.ico, arquivos (public)
     * - assets PWA (manifest, sw.js, ícones) — devem ser públicos
     * - API routes (se existirem)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon-.*\\.png|apple-touch-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};