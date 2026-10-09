import { leerJson } from "@tarjetazo/core/red";
import { fetchPublicoNode } from "@tarjetazo/core/red-node";
import { CADENAS, type Cadena } from "./cadenas.js";
import { dentroDeUruguay } from "./tipos.js";

/**
 * Las instancias públicas de Overpass devuelven 504 seguido cuando están
 * cargadas, así que rotamos entre mirrors antes de darnos por vencidos.
 * Solo mirrors con el planeta entero: overpass.osm.ch tiene nada más Suiza y
 * para Uruguay contesta 200 vacío.
 */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
/** Todo Uruguay entra holgado; más que esto no es una respuesta de Overpass. */
const MAX_RESPUESTA = 50 * 1024 * 1024;
const UA = "Tarjetazo/0.1 (+https://tarjetazo.uy; contacto@tarjetazo.uy)";

/** id de la relación de Uruguay en OSM; como área, se le suma 3600000000. */
const AREA_UY = 3600287072;

export interface LocalOsm {
  comercio_key: string;
  osm_id: string;
  lat: number;
  lng: number;
  nombre: string | null;
  calle: string | null;
  numero: string | null;
  ciudad: string | null;
  estado: string | null;
}

export interface Elemento {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function consulta(cadenas: readonly Cadena[]): string {
  const lineas: string[] = [];
  for (const c of cadenas) {
    for (const n of c.nombres ?? []) lineas.push(`  nwr["name"="${n}"](area.uy);`);
    for (const m of c.marcas ?? []) lineas.push(`  nwr["brand"="${m}"](area.uy);`);
  }
  return `[out:json][timeout:120];\narea(${AREA_UY})->.uy;\n(\n${lineas.join("\n")}\n);\nout tags center;`;
}

/** A qué cadena pertenece un elemento, según sus tags `name` / `brand`. */
function cadenaDe(tags: Record<string, string>): string | null {
  for (const c of CADENAS) {
    if (c.nombres?.includes(tags.name ?? "")) return c.comercio_key;
    if (c.marcas?.includes(tags.brand ?? "")) return c.comercio_key;
  }
  return null;
}

export async function preguntar(query: string): Promise<Elemento[]> {
  let ultimoError = "";
  let vacios = 0;
  for (let intento = 0; intento < OVERPASS.length * 2; intento++) {
    const url = OVERPASS[intento % OVERPASS.length]!;
    try {
      // Los mirrors son de terceros: sus redirecciones pasan por el mismo
      // chequeo que cualquier URL de afuera (nada de red interna).
      const res = await fetchPublicoNode(url, {
        method: "POST",
        headers: { "user-agent": UA, "content-type": "text/plain" },
        body: query,
        signal: AbortSignal.timeout(180_000),
      }, 2);
      if (!res.ok) {
        ultimoError = `${new URL(url).host} devolvió ${res.status}`;
        await new Promise((r) => setTimeout(r, 5000 * (intento + 1)));
        continue;
      }
      const datos = await leerJson<{ elements?: Elemento[]; remark?: string }>(res, MAX_RESPUESTA);
      if (datos.remark) {
        ultimoError = `${new URL(url).host}: ${String(datos.remark).slice(0, 200)}`;
        continue;
      }
      // Un mirror puede responder 200 con cero elementos aunque el dato exista
      // (bases desincronizadas). Aceptamos el primer resultado con contenido y
      // solo damos la consulta por vacía si todos coinciden en eso.
      const elementos = datos.elements ?? [];
      if (elementos.length > 0) return elementos;
      vacios++;
    } catch (e) {
      // El corte por tiempo llega como un AbortError genérico de node:http.
      const motivo = e instanceof Error && e.name === "AbortError" ? "no contestó en 180 s" : String(e);
      ultimoError = `${new URL(url).host}: ${motivo}`;
      await new Promise((r) => setTimeout(r, 5000 * (intento + 1)));
    }
  }
  if (vacios >= OVERPASS.length) return [];
  throw new Error(`Overpass no respondió: ${ultimoError}`);
}

export async function localesDeCadenas(
  cadenas: readonly Cadena[] = CADENAS,
): Promise<LocalOsm[]> {
  // De a pocas cadenas por consulta: las grandes son las que disparan el 504.
  const elementos: Elemento[] = [];
  for (let i = 0; i < cadenas.length; i += 3) {
    elementos.push(...(await preguntar(consulta(cadenas.slice(i, i + 3)))));
  }

  const locales: LocalOsm[] = [];
  const vistos = new Set<string>();
  for (const e of elementos) {
    const tags = e.tags ?? {};
    const comercio_key = cadenaDe(tags);
    if (!comercio_key) continue;

    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number" || !dentroDeUruguay(lat, lng)) continue;

    const osm_id = `${e.type}/${e.id}`;
    if (vistos.has(osm_id)) continue;
    vistos.add(osm_id);

    locales.push({
      comercio_key,
      osm_id,
      lat,
      lng,
      nombre: tags.name ?? null,
      calle: tags["addr:street"] ?? null,
      numero: tags["addr:housenumber"] ?? null,
      ciudad: tags["addr:city"] ?? tags["addr:suburb"] ?? null,
      estado: tags["addr:state"] ?? null,
    });
  }
  return locales;
}
