import type { SupabaseClient } from "@supabase/supabase-js";
import { origenSupabase } from "@tarjetazo/core";
import { bajarImagen } from "./catalogo/imagen.js";

/**
 * Logos de comercio (#118). Varias fuentes publican el logo del comercio junto
 * al beneficio (Santander en su listado, BROU en la ficha, OCA en su API, Itaú
 * en las landings de restaurantes). Se baja una sola vez por comercio, el
 * primero que aparezca, y se guarda en el bucket público `comercios`: las URLs
 * de los bancos cambian y algunos bloquean que otro sitio las muestre.
 *
 * Un logo ya puesto (por otra fuente o a mano) no se pisa. El archivo se nombra
 * con el hash del contenido: nunca se borra uno que una página cacheada pueda
 * estar mostrando.
 */

const BUCKET = "comercios";
/** Un logo no necesita más: los de Santander son de 112 px. */
const MAX_BYTES = 1024 * 1024;

/** Comercios que ya tienen logo: esos no se tocan. */
export async function comerciosConLogo(db: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from("comercio")
      .select("key")
      .not("logo_url", "is", null)
      .order("key")
      .range(desde, desde + 999);
    if (error) throw new Error(`leyendo logos: ${error.message}`);
    for (const c of data ?? []) out.add(c.key as string);
    if ((data ?? []).length < 1000) return out;
  }
}

/**
 * Baja el logo, lo sube al bucket y lo pone en el comercio si todavía no tiene
 * uno. Devuelve si quedó guardado.
 */
export async function guardarLogo(db: SupabaseClient, comercioKey: string, url: string, pagina?: string): Promise<boolean> {
  const { bytes, tipo, ext, hash } = await bajarImagen(url, pagina, MAX_BYTES);
  const ruta = `${comercioKey}/${hash}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(ruta, bytes, { contentType: tipo, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Storage: ${error.message}`);

  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publica = `${origenSupabase(base)}/storage/v1/object/public/${BUCKET}/${ruta}`;
  const { data, error: e2 } = await db
    .from("comercio")
    .update({ logo_url: publica, logo_origen: url })
    .eq("key", comercioKey)
    .is("logo_url", null)
    .select("key");
  if (e2) throw new Error(`guardando logo: ${e2.message}`);
  return (data ?? []).length > 0;
}
