import type { SupabaseClient } from "@supabase/supabase-js";
import { preguntar, type Elemento } from "./osm.js";

/**
 * Información de comercios desde OpenStreetMap (#118). Los locales vinculados
 * por `osm_id` (los importados de cadenas y las sugerencias aceptadas) traen en
 * sus tags el teléfono y el horario del local, y a veces el sitio web y el
 * Instagram del comercio. Solo se completa lo vacío: lo que ya está (de una
 * fuente o cargado a mano) no se pisa.
 */

interface LocalVinculado {
  id: string;
  comercio_key: string;
  osm_id: string;
  telefono: string | null;
  horario: string | null;
}

/** De a cuántos ids por consulta: más largas, Overpass empieza a dar 504. */
const LOTE = 250;

/** El primero de una lista de OSM ("099 123 456;2400 1234"). */
const primero = (v: string | undefined) => v?.split(";")[0]?.trim() || null;

/** "https://instagram.com/tata.uy/", "@tata.uy" o "tata.uy" → "tata.uy". Exportada para los tests. */
export function usuarioInstagram(v: string | undefined): string | null {
  const t = primero(v);
  if (!t) return null;
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i) ?? t.match(/^@?([A-Za-z0-9._]{2,30})$/);
  return m ? m[1]!.toLowerCase() : null;
}

/** Un sitio web con protocolo; lo que no parece una URL, afuera. Exportada para los tests. */
export function sitioWeb(v: string | undefined): string | null {
  const t = primero(v);
  if (!t) return null;
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(url);
    // Un "sitio" que es la red social va a Instagram, no acá.
    if (!u.hostname.includes(".") || /instagram\.com|facebook\.com/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** El valor que más se repite entre los locales de un comercio. */
function masComun(valores: (string | null)[]): string | null {
  const cuenta = new Map<string, number>();
  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  return [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function localesVinculados(db: SupabaseClient): Promise<LocalVinculado[]> {
  const out: LocalVinculado[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from("sucursal")
      .select("id, comercio_key, osm_id, telefono, horario")
      .not("osm_id", "is", null)
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`leyendo sucursales: ${error.message}`);
    out.push(...((data ?? []) as LocalVinculado[]));
    if ((data ?? []).length < 1000) return out;
  }
}

export async function completarInfoDeOsm(
  db: SupabaseClient,
): Promise<{ locales: number; telefonos: number; horarios: number; sitios: number; instagrams: number }> {
  const locales = await localesVinculados(db);
  const porId = new Map<string, Elemento>();
  for (let i = 0; i < locales.length; i += LOTE) {
    const lote = locales.slice(i, i + LOTE);
    const porTipo = new Map<string, string[]>();
    for (const l of lote) {
      const [tipo, id] = l.osm_id.split("/");
      if (!tipo || !id || !/^\d+$/.test(id)) continue;
      porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), id]);
    }
    const partes = [...porTipo].map(([tipo, ids]) => `${tipo}(id:${ids.join(",")});`).join("");
    for (const e of await preguntar(`[out:json][timeout:120];(${partes});out tags;`)) porId.set(`${e.type}/${e.id}`, e);
  }

  let telefonos = 0;
  let horarios = 0;
  const porComercio = new Map<string, { sitios: (string | null)[]; instagrams: (string | null)[] }>();
  for (const l of locales) {
    const tags = porId.get(l.osm_id)?.tags ?? {};
    const telefono = primero(tags.phone ?? tags["contact:phone"]);
    const horario = tags.opening_hours?.trim() || null;
    const cambios: Record<string, string> = {};
    if (!l.telefono && telefono) cambios.telefono = telefono;
    if (!l.horario && horario) cambios.horario = horario;
    if (Object.keys(cambios).length > 0) {
      const { error } = await db.from("sucursal").update(cambios).eq("id", l.id);
      if (error) throw new Error(`guardando la sucursal ${l.id}: ${error.message}`);
      if (cambios.telefono) telefonos++;
      if (cambios.horario) horarios++;
    }
    const c = porComercio.get(l.comercio_key) ?? { sitios: [], instagrams: [] };
    c.sitios.push(sitioWeb(tags.website ?? tags["contact:website"] ?? tags.url));
    c.instagrams.push(usuarioInstagram(tags["contact:instagram"] ?? tags.instagram));
    porComercio.set(l.comercio_key, c);
  }

  let sitios = 0;
  let instagrams = 0;
  for (const [key, c] of porComercio) {
    const sitio = masComun(c.sitios);
    const instagram = masComun(c.instagrams);
    if (sitio) {
      const { data } = await db.from("comercio").update({ sitio_web: sitio }).eq("key", key).is("sitio_web", null).select("key");
      sitios += (data ?? []).length;
    }
    if (instagram) {
      const { data } = await db.from("comercio").update({ instagram }).eq("key", key).is("instagram", null).select("key");
      instagrams += (data ?? []).length;
    }
  }
  return { locales: locales.length, telefonos, horarios, sitios, instagrams };
}
