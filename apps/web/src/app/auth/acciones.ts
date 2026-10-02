"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createSupabaseServidor, destinoSeguro } from "@/lib/supabase-auth";
import { tipoValido } from "./confirm/tipos";

/**
 * Cierra la sesión en este navegador y revoca el refresh token en Supabase,
 * así que copiar las cookies viejas a otro lado tampoco sirve.
 */
export async function cerrarSesion() {
  const supabase = createSupabaseServidor(await cookies());
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

/**
 * Canjea el token de un link de mail (/auth/confirm). Va por POST, desde el
 * botón de la página, para que abrir el link no alcance para gastarlo. Se
 * valida en el servidor: anda aunque el link se abra en otro navegador.
 */
export async function confirmarLink(datos: FormData) {
  const tokenHash = datos.get("token_hash");
  const tipo = datos.get("type");
  const next = datos.get("next");
  if (typeof tokenHash !== "string" || !tokenHash || typeof tipo !== "string" || !tipoValido(tipo)) {
    redirect("/login?error=link_invalido");
  }

  const supabase = createSupabaseServidor(await cookies());
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) redirect("/login?error=link_invalido");

  redirect(destinoSeguro(typeof next === "string" ? next : null) as Route);
}
