import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { origenSupabase } from "@tarjetazo/core";

/**
 * El pipeline escribe con la service role key, que saltea RLS. Solo corre en
 * GitHub Actions y en local; nunca en el browser.
 */
export function crearCliente(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(origenSupabase(url), key, { auth: { persistSession: false } });
}


export async function hashesGuardados(
  db: SupabaseClient,
  fuenteId: string,
): Promise<Map<string, string>> {
  const { data, error } = await db
    .from("pagina_cruda")
    .select("external_id, hash")
    .eq("fuente_id", fuenteId);
  if (error) throw new Error(`leyendo pagina_cruda: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.external_id as string, r.hash as string]));
}

export async function guardarPagina(
  db: SupabaseClient,
  pagina: {
    fuente_id: string;
    external_id: string;
    url_fuente: string;
    contenido: string;
    hash: string;
    fetched_at: string;
    normalizada_en: string | null;
  },
): Promise<void> {
  const { error } = await db
    .from("pagina_cruda")
    .upsert(pagina, { onConflict: "fuente_id,external_id" });
  if (error) throw new Error(`guardando pagina_cruda: ${error.message}`);
}

export async function asegurarComercio(
  db: SupabaseClient,
  comercio: { key: string; nombre: string; categoria: string },
): Promise<void> {
  // `ignoreDuplicates` para no pisar un nombre o una categoría ya corregidos a
  // mano por una corrida posterior del scraper.
  const { error } = await db
    .from("comercio")
    .upsert(comercio, { onConflict: "key", ignoreDuplicates: true });
  if (error) throw new Error(`guardando comercio ${comercio.key}: ${error.message}`);
}

export async function upsertBeneficios(
  db: SupabaseClient,
  filas: Record<string, unknown>[],
): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await db.from("beneficio").upsert(filas, { onConflict: "id" });
  if (error) throw new Error(`guardando beneficios: ${error.message}`);
}

export async function idsDeBeneficios(
  db: SupabaseClient,
  fuenteId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from("beneficio")
    .select("id")
    .eq("fuente_id", fuenteId)
    .neq("estado_revision", "descartado");
  if (error) throw new Error(`leyendo beneficios: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id as string));
}

/**
 * Lo que la fuente dejó de publicar no se borra: se marca `descartado`, que la
 * policy de RLS ya excluye de la web y el trigger de derivados no cuenta. Así
 * queda el rastro si vuelve.
 */
export async function marcarVencidos(
  db: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db
    .from("beneficio")
    .update({ estado_revision: "descartado", updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(`marcando vencidos: ${error.message}`);
}

export async function encolarRevision(
  db: SupabaseClient,
  fila: { fuente_id: string; raw: unknown; motivo: string; url_fuente: string },
): Promise<void> {
  const { error } = await db.from("beneficio_revision").insert(fila);
  if (error) throw new Error(`encolando revisión: ${error.message}`);
}

export async function abrirCorrida(db: SupabaseClient, fuenteId: string): Promise<string> {
  const { data, error } = await db
    .from("corrida")
    .insert({ fuente_id: fuenteId })
    .select("id")
    .single();
  if (error) throw new Error(`abriendo corrida: ${error.message}`);
  return data!.id as string;
}

export async function cerrarCorrida(
  db: SupabaseClient,
  id: string,
  resumen: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from("corrida")
    .update({ ...resumen, termino_en: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`cerrando corrida: ${error.message}`);
}

/**
 * Sucursales que la propia fuente publica con coordenadas (Itaú las trae en su
 * feed). No pasan por el geocodificador: ya vienen ubicadas.
 */
export async function guardarSucursalesDeFuente(
  db: SupabaseClient,
  filas: Record<string, unknown>[],
): Promise<number> {
  if (filas.length === 0) return 0;
  const { error } = await db
    .from("sucursal")
    .upsert(filas, { onConflict: "comercio_key,direccion,departamento" });
  if (error) throw new Error(`guardando sucursales de la fuente: ${error.message}`);
  return filas.length;
}
