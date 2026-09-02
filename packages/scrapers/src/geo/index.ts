import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodificarIde } from "./ide.js";
import { geocodificarNominatim } from "./nominatim.js";
import type { Punto } from "./tipos.js";

/**
 * Geocodifica con caché persistente: los servicios tienen rate limit y las
 * direcciones no cambian. Se cachean también los fallos (fila con lat nula),
 * para no reintentar cada corrida lo que ya sabemos que no resuelve.
 */
export async function geocodificar(
  db: SupabaseClient,
  texto: string,
): Promise<Punto | null> {
  const consulta = texto.trim().replace(/\s+/g, " ").toUpperCase();
  if (consulta.length < 4) return null;

  const { data: cacheado } = await db
    .from("geocode_cache")
    .select("*")
    .eq("consulta", consulta)
    .maybeSingle();

  if (cacheado) {
    if (cacheado.lat == null) return null;
    return {
      lat: cacheado.lat as number,
      lng: cacheado.lng as number,
      precision: cacheado.precision as Punto["precision"],
      fuente: cacheado.fuente as Punto["fuente"],
      direccion_normalizada: cacheado.direccion_normalizada as string | null,
      departamento: null,
      localidad: null,
    };
  }

  // El oficial primero: conoce la nomenclatura uruguaya ("parada 4", padrones)
  // mejor que Nominatim.
  const punto = (await geocodificarIde(texto)) ?? (await geocodificarNominatim(texto));

  await db.from("geocode_cache").upsert(
    {
      consulta,
      lat: punto?.lat ?? null,
      lng: punto?.lng ?? null,
      precision: punto?.precision ?? null,
      fuente: punto?.fuente ?? "ninguna",
      direccion_normalizada: punto?.direccion_normalizada ?? null,
      consultado_en: new Date().toISOString(),
    },
    { onConflict: "consulta" },
  );

  return punto;
}

export { geocodificarIde, localidadesDe } from "./ide.js";
export { geocodificarNominatim } from "./nominatim.js";
export type { Punto, PrecisionGeo } from "./tipos.js";
