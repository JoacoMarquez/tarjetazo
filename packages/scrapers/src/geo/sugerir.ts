import type { SupabaseClient } from "@supabase/supabase-js";
import { slugDepartamento } from "./departamentos.js";
import { reversaIde } from "./ide.js";
import { dentroDeUruguay } from "./tipos.js";

/**
 * Sugerencias de ubicación desde OpenStreetMap para los comercios que no tienen
 * ninguna sucursal en el mapa. Nominatim por nombre acierta más o menos un
 * tercio y a veces devuelve otra cosa con el mismo nombre (una inmobiliaria
 * "Obra", una calle "Tres"), así que nada entra al mapa: todo queda como
 * sugerencia para el backoffice. Los filtros de acá solo sacan lo evidente.
 */

const UA = "Tarjetazo/0.1 (+https://tarjetazo.uy; contacto@tarjetazo.uy)";
/** Un comercio que no apareció se vuelve a buscar recién después de esto. */
const REBUSCAR_DIAS = 30;

let ultima = 0;
async function turno() {
  // Política de Nominatim: como mucho 1 req/s.
  const falta = 1100 - (Date.now() - ultima);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultima = Date.now();
}

interface ResultadoOsm {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  name?: string;
  display_name: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
}

const GASTRONOMIA = new Set(["restaurantes", "cafeterias", "delivery"]);
const OSM_GASTRONOMIA: Record<string, Set<string>> = {
  amenity: new Set(["restaurant", "cafe", "fast_food", "ice_cream", "bar", "pub", "food_court", "biergarten"]),
  shop: new Set(["bakery", "confectionery", "pastry", "ice_cream", "deli", "coffee", "chocolate"]),
};
/** Lo que nunca es un local: calles, barrios, límites, edificios sin uso. */
const NO_ES_LOCAL = new Set(["highway", "place", "boundary", "landuse", "building", "railway", "natural", "waterway", "route"]);

/** ¿El tipo de OSM puede ser un comercio de este rubro? */
export function tipoPlausible(rubro: string, r: Pick<ResultadoOsm, "category" | "type">): boolean {
  if (NO_ES_LOCAL.has(r.category)) return false;
  if (GASTRONOMIA.has(rubro)) return OSM_GASTRONOMIA[r.category]?.has(r.type) ?? false;
  return ["amenity", "shop", "leisure", "tourism", "craft", "office", "healthcare"].includes(r.category);
}

const GENERICAS = new Set([
  "restaurante", "restaurant", "resto", "cafe", "cafeteria", "bar", "heladeria", "parrilla", "parrillada",
  "la", "el", "los", "las", "de", "del", "y", "the", "and", "food", "drink", "uy", "uruguay",
]);
const palabras = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !GENERICAS.has(t));

/**
 * ¿Es el mismo nombre? Todas las palabras propias de uno están en el otro:
 * "Tertulia" ≈ "Tertulia - Food & Drink", "Sushi Wok Perú" ≈ "Sushi Wok Peru".
 */
export function mismoNombre(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = new Set(palabras(b));
  if (pa.length === 0 || pb.size === 0) return false;
  const pa2 = new Set(pa);
  return pa.every((t) => pb.has(t)) || [...pb].every((t) => pa2.has(t));
}

async function buscar(q: string): Promise<ResultadoOsm[]> {
  await turno();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "uy");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    return res.ok ? ((await res.json()) as ResultadoOsm[]) : [];
  } catch {
    return [];
  }
}

export interface ReporteSugerencias {
  buscados: number;
  con_resultado: number;
  sugerencias: number;
}

interface Pendiente {
  key: string;
  nombre: string;
  categoria: string;
  con_pin: number;
  beneficios: number;
  buscado_en: string | null;
}

export async function sugerirUbicacionesOsm(db: SupabaseClient, limite = 500): Promise<ReporteSugerencias> {
  // PostgREST corta en 1.000 filas, también en una función: de a páginas.
  const data: Pendiente[] = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await db.rpc("admin_comercios").order("key").range(desde, desde + 999);
    if (r.error) throw new Error(`leyendo comercios: ${r.error.message}`);
    data.push(...((r.data ?? []) as Pendiente[]));
    if ((r.data ?? []).length < 1000) break;
  }
  const corte = Date.now() - REBUSCAR_DIAS * 86_400_000;
  const pendientes = data
    .filter((c) => c.con_pin === 0 && (!c.buscado_en || Date.parse(c.buscado_en) < corte))
    .sort((a, b) => b.beneficios - a.beneficios)
    .slice(0, limite);

  const r: ReporteSugerencias = { buscados: 0, con_resultado: 0, sugerencias: 0 };
  for (const c of pendientes) {
    r.buscados++;
    // El departamento que dicen los beneficios, si lo dicen: acota la búsqueda
    // y descarta homónimos de otra punta del país.
    const { data: bs } = await db
      .from("beneficio")
      .select("departamentos")
      .eq("comercio_key", c.key)
      .eq("estado_revision", "ok");
    const deptos = new Set((bs ?? []).flatMap((b) => (b.departamentos as string[] | null) ?? []));
    const consulta = deptos.size === 1 ? `${c.nombre}, ${[...deptos][0]!.replace(/-/g, " ")}, Uruguay` : `${c.nombre}, Uruguay`;

    const filas = [];
    for (const o of await buscar(consulta)) {
      const lat = Number(o.lat);
      const lng = Number(o.lon);
      if (!dentroDeUruguay(lat, lng)) continue;
      const nombreOsm = o.namedetails?.name ?? o.name ?? "";
      if (!nombreOsm || !mismoNombre(c.nombre, nombreOsm)) continue;
      if (!tipoPlausible(c.categoria, o)) continue;
      const a = o.address ?? {};
      let departamento = slugDepartamento(a.state ?? null);
      let localidad = a.city ?? a.town ?? a.village ?? a.suburb ?? null;
      let direccion = [a.road, a.house_number].filter(Boolean).join(" ");
      if (!departamento || !direccion) {
        const rev = await reversaIde(lat, lng);
        departamento ??= slugDepartamento(rev?.departamento ?? null);
        direccion ||= rev?.direccion_normalizada ?? "";
        localidad ??= rev?.localidad ?? null;
      }
      if (deptos.size > 0 && departamento && !deptos.has(departamento)) continue;
      filas.push({
        comercio_key: c.key,
        fuente: "osm",
        osm_id: `${o.osm_type}/${o.osm_id}`,
        nombre: nombreOsm,
        direccion: direccion || o.display_name.split(",").slice(0, 2).join(",").trim(),
        localidad,
        departamento,
        lat,
        lng,
        tipo: `${o.category}/${o.type}`,
        consulta,
      });
    }

    if (filas.length > 0) {
      const { error: e } = await db
        .from("sucursal_sugerencia")
        .upsert(filas, { onConflict: "comercio_key,osm_id", ignoreDuplicates: true });
      if (e) throw new Error(`guardando sugerencias: ${e.message}`);
      r.con_resultado++;
      r.sugerencias += filas.length;
    }
    const { error: e2 } = await db
      .from("ubicacion_busqueda")
      .upsert({ comercio_key: c.key, fuente: "osm", buscado_en: new Date().toISOString(), encontrados: filas.length });
    if (e2) throw new Error(`guardando búsqueda: ${e2.message}`);
    if (r.buscados % 50 === 0) console.error(`  ${r.buscados}/${pendientes.length} buscados, ${r.sugerencias} sugerencias`);
  }
  return r;
}
