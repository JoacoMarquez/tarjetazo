import "server-only";

import { createClient } from "@supabase/supabase-js";
import { origenSupabase } from "@tarjetazo/core";

/**
 * Cliente con la service role: saltea RLS y llama RPC que anon no puede.
 * Solo del lado del servidor, y nunca con datos que decida el usuario sin
 * validar antes en el código que lo llama.
 */
export function createSupabaseServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
  }
  return createClient(origenSupabase(url), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
