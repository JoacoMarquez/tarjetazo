import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { esAdmin } from "./admin-emails";
import { createSupabaseServidor } from "./supabase-auth";
import { createSupabaseServicio } from "./supabase-servicio";

/**
 * Guarda del backoffice. El middleware ya corta `/admin`, pero las server
 * actions se pueden invocar por POST desde cualquier lado: cada página y cada
 * action de `/admin` tiene que llamar a esto antes de tocar la base.
 *
 * Responde 404 y no 403: quien no es admin no tiene por qué saber que existe.
 */
export async function exigirAdmin() {
  const supabase = createSupabaseServidor(await cookies());
  // `getUser` valida el token contra Supabase; `getSession` confía en la cookie.
  const { data } = await supabase.auth.getUser();
  if (!esAdmin(data.user)) notFound();
  return data.user!;
}

/**
 * Cliente con la service role: saltea RLS. Solo del lado del servidor y solo
 * después de `exigirAdmin()`.
 */
export function createSupabaseAdmin() {
  return createSupabaseServicio();
}
