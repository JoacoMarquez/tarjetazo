import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServidor, destinoSeguro } from "@/lib/supabase-auth";

/**
 * Vuelta del OAuth de Google (y del link de recuperación de contraseña):
 * cambia el `code` por una sesión y manda al destino pedido.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destino = destinoSeguro(searchParams.get("next"));

  if (!code) {
    const motivo =
      searchParams.get("error_description") ?? searchParams.get("error");
    const url = new URL("/login", origin);
    if (motivo) url.searchParams.set("error", motivo);
    return NextResponse.redirect(url);
  }

  const supabase = createSupabaseServidor(await cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(destino, origin));
}
