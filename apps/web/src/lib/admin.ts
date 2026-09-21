import "server-only";

import { createClient } from "@supabase/supabase-js";
import { origenSupabase } from "@tarjetazo/core";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { esAdmin } from "./admin-emails";
import { createSupabaseServidor } from "./supabase-auth";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
  }
  return createClient(origenSupabase(url), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
