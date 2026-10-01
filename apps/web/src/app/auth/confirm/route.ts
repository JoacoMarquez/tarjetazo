import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServidor, destinoSeguro } from "@/lib/supabase-auth";

/**
 * Links de los mails de Auth (confirmar la cuenta, recuperar la contraseña).
 * El mail trae un `token_hash` de un solo uso que se valida acá, en el
 * servidor: funciona aunque el link se abra en otro navegador o dispositivo.
 * Con el `code` de PKCE (`/auth/callback`) eso fallaba, porque la clave para
 * canjearlo queda en el navegador que pidió el mail.
 */
const TIPOS: EmailOtpType[] = ["recovery", "email", "signup", "email_change"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = destinoSeguro(searchParams.get("next"));

  if (!tokenHash || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.redirect(new URL("/login?error=link_invalido", origin));
  }

  const supabase = createSupabaseServidor(await cookies());
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_invalido", origin));
  }

  return NextResponse.redirect(new URL(destino, origin));
}
