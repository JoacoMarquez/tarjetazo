import { createClient } from "@supabase/supabase-js";
import { origenSupabase } from "@tarjetazo/core";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cliente de lectura del catálogo. Todo el contenido es público (RLS con policy
 * de select), así que alcanza con la anon key y no hace falta sesión.
 */
export function createSupabaseClient() {
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)");
  }
  return createClient(origenSupabase(url), anonKey, { auth: { persistSession: false } });
}
