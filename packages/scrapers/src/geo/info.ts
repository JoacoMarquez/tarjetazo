import type { SupabaseClient } from "@supabase/supabase-js";
import { preguntar, type Elemento } from "./osm.js";

/**
 * Información de comercios desde OpenStreetMap (#118). Los locales vinculados
 * por `osm_id` (los importados de cadenas y las sugerencias aceptadas) traen en
 * sus tags el teléfono y el horario del local, y a veces el sitio web y el
 * Instagram del comercio. Solo se sugiere lo vacío, y lo acepta el operador:
 * OSM lo edita cualquiera.
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

/** "https://www.tata.com.uy/" → "tata.com.uy": para contar juntas las variantes del mismo sitio. */
const dominio = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const dominioDe = (v: string) => (/^https?:/.test(v) ? dominio(v) : v);

/**
 * El dato del comercio a partir de sus locales. Con uno o dos locales, el que
 * haya. En una cadena, un solo local con dato puede ser una franquicia con
 * su propia página ("estacionhimalaya.com" en ANCAP): vale si se repite en
 * dos locales o más, o, para el sitio, si el dominio empieza con el nombre del
 * comercio ("eldorado.com.uy" para El Dorado). Exportada para los tests.
 */
export function elegir(
  comercioKey: string,
  valores: (string | null)[],
  tipo: "sitio" | "instagram",
): string | null {
  const grupos = new Map<string, string[]>();
  for (const v of valores) {
    if (!v) continue;
    const clave = tipo === "sitio" ? dominio(v) : v;
    grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
  }
  const [mejor] = [...grupos].sort((a, b) => b[1].length - a[1].length);
  if (!mejor) return null;
  const [clave, variantes] = mejor;
  const cadena = valores.length > 2;
  const compacto = comercioKey.replace(/-/g, "");
  const propio = tipo === "sitio" && clave.replace(/[^a-z0-9]/g, "").startsWith(compacto);
  if (cadena && variantes.length < 2 && !propio) return null;
  // Entre variantes del mismo sitio, la https (y con www si la hay).
  return tipo === "sitio"
    ? ([...variantes].sort((a, b) => Number(b.startsWith("https")) - Number(a.startsWith("https")) || b.length - a.length)[0] ?? null)
    : clave;
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

type Sugerencia = { comercio_key: string; sucursal_id: string | null; campo: string; valor: string; osm_ids: string[] };

/** Sitio e Instagram que ya tienen los comercios: esos no se sugieren. */
async function infoDeComercios(db: SupabaseClient, keys: string[]): Promise<Map<string, { sitio_web: string | null; instagram: string | null }>> {
  const out = new Map<string, { sitio_web: string | null; instagram: string | null }>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await db.from("comercio").select("key, sitio_web, instagram").in("key", keys.slice(i, i + 200));
    if (error) throw new Error(`leyendo comercios: ${error.message}`);
    for (const c of data ?? []) out.set(c.key as string, { sitio_web: c.sitio_web as string | null, instagram: c.instagram as string | null });
  }
  return out;
}

/**
 * Deja como sugerencias (`info_sugerencia`) lo que OSM tiene y el catálogo no.
 * No publica nada: OSM lo edita cualquiera, y lo acepta el operador en
 * /admin/comercios. Un valor ya sugerido (o ignorado) no se repite.
 */
export async function sugerirInfoDeOsm(
  db: SupabaseClient,
): Promise<{ locales: number; lotes_fallidos: number; telefonos: number; horarios: number; sitios: number; instagrams: number }> {
  const locales = await localesVinculados(db);
  const porId = new Map<string, Elemento>();
  // Un lote que Overpass no contesta se saltea: sus locales quedan para la
  // corrida de la semana que viene, y el resto se sugiere igual.
  let lotes = 0;
  let lotesFallidos = 0;
  for (let i = 0; i < locales.length; i += LOTE) {
    lotes++;
    const lote = locales.slice(i, i + LOTE);
    const porTipo = new Map<string, string[]>();
    for (const l of lote) {
      const [tipo, id] = l.osm_id.split("/");
      if (!tipo || !/^(node|way|relation)$/.test(tipo) || !id || !/^\d+$/.test(id)) continue;
      porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), id]);
    }
    const partes = [...porTipo].map(([tipo, ids]) => `${tipo}(id:${ids.join(",")});`).join("");
    try {
      for (const e of await preguntar(`[out:json][timeout:120];(${partes});out tags;`)) porId.set(`${e.type}/${e.id}`, e);
    } catch (e) {
      lotesFallidos++;
      console.error(`::warning::lote ${lotes} (${lote.length} locales) sin respuesta: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (lotes > 0 && lotesFallidos === lotes) throw new Error("Overpass no contestó ningún lote");

  const sugerencias: Sugerencia[] = [];
  const porComercio = new Map<string, { sitios: (string | null)[]; instagrams: (string | null)[]; osm: string[] }>();
  for (const l of locales) {
    const tags = porId.get(l.osm_id)?.tags ?? {};
    const telefono = primero(tags.phone ?? tags["contact:phone"]);
    const horario = tags.opening_hours?.trim() || null;
    if (!l.telefono && telefono) sugerencias.push({ comercio_key: l.comercio_key, sucursal_id: l.id, campo: "telefono", valor: telefono, osm_ids: [l.osm_id] });
    if (!l.horario && horario) sugerencias.push({ comercio_key: l.comercio_key, sucursal_id: l.id, campo: "horario", valor: horario, osm_ids: [l.osm_id] });
    const c = porComercio.get(l.comercio_key) ?? { sitios: [], instagrams: [], osm: [] };
    const web = tags.website ?? tags["contact:website"] ?? tags.url;
    c.sitios.push(sitioWeb(web));
    // Hay locales con el Instagram cargado como sitio web.
    c.instagrams.push(usuarioInstagram(tags["contact:instagram"] ?? tags.instagram ?? (web && /instagram\.com/i.test(web) ? web : undefined)));
    c.osm.push(l.osm_id);
    porComercio.set(l.comercio_key, c);
  }

  const actuales = await infoDeComercios(db, [...porComercio.keys()]);
  for (const [key, c] of porComercio) {
    const ya = actuales.get(key);
    const sitio = elegir(key, c.sitios, "sitio");
    const instagram = elegir(key, c.instagrams, "instagram");
    // De qué locales sale: para que el operador lo pueda mirar en OSM.
    const de = (valores: (string | null)[], v: string) => c.osm.filter((_, i) => valores[i] && (valores[i] === v || dominioDe(valores[i]!) === dominioDe(v)));
    if (sitio && ya && !ya.sitio_web) sugerencias.push({ comercio_key: key, sucursal_id: null, campo: "sitio_web", valor: sitio, osm_ids: de(c.sitios, sitio) });
    if (instagram && ya && !ya.instagram) sugerencias.push({ comercio_key: key, sucursal_id: null, campo: "instagram", valor: instagram, osm_ids: de(c.instagrams, instagram) });
  }

  const nuevas = { telefonos: 0, horarios: 0, sitios: 0, instagrams: 0 };
  for (let i = 0; i < sugerencias.length; i += 500) {
    const { data, error } = await db
      .from("info_sugerencia")
      .upsert(sugerencias.slice(i, i + 500), { onConflict: "comercio_key,sucursal_id,campo,valor", ignoreDuplicates: true })
      .select("campo");
    if (error) throw new Error(`guardando sugerencias: ${error.message}`);
    for (const r of data ?? []) {
      const campo = r.campo as string;
      if (campo === "telefono") nuevas.telefonos++;
      else if (campo === "horario") nuevas.horarios++;
      else if (campo === "sitio_web") nuevas.sitios++;
      else nuevas.instagrams++;
    }
  }
  return { locales: locales.length, lotes_fallidos: lotesFallidos, ...nuevas };
}
