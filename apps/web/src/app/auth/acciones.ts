"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServidor } from "@/lib/supabase-auth";

/**
 * Cierra la sesión en este navegador y revoca el refresh token en Supabase,
 * así que copiar las cookies viejas a otro lado tampoco sirve.
 */
export async function cerrarSesion() {
  const supabase = createSupabaseServidor(await cookies());
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
