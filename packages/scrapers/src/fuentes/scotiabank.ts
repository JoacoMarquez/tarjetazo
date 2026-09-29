import { bajarTexto } from "../http.js";
import { argumentosDeLlamadas } from "../literal-js.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, SucursalDeFuente } from "../tipos.js";

const BASE = "https://www.scotiabank.com.uy";
const INDICE = `${BASE}/Personas/Tarjetas/Beneficios/default`;

/**
 * Scotiabank embebe todo el catálogo en el índice como objetos JS
 * (`pushBenefit({...})`, uno por beneficio, ~420) y cada ficha con página
 * propia trae sus datos igual (`setBenefit('DETALLE', {...})`). No son JSON:
 * comillas simples, comas finales, HTML adentro. Se leen como literales, sin
 * ejecutar el código de la página: node:vm no aísla, y un script del banco
 * correría con los secretos del job.
 */
/**
 * Lo que el parser (`scotiabank-parser.ts`) lee de cada beneficio: los campos
 * del catálogo tal como vienen, más los legales ya pasados a texto (los de la
 * ficha si tiene página propia, que son más completos). Viaja en `Crudo.datos`
 * y no se guarda: el hash sigue siendo el del `contenido`.
 */
export interface DatosScotiabank {
  titulo: string;
  categoria: string;
  descuentos: { pct: string; texto: string }[];
  dias: string;
  departamento: string;
  desde: string | null;
  hasta: string | null;
  legal: string;
}

interface Item {
  categoria?: string;
  departamento?: string;
  dias?: string;
  desde?: string;
  hasta?: string;
  titulo?: string;
  descuentos?: { pct?: string; texto?: string }[];
  legal?: string;
  link?: string;
  promo?: string;
}

interface Detalle {
  info?: { type?: string; content?: unknown }[];
  donde?: { type?: string; content?: { title?: string; address?: string; maps?: string }[] }[];
  legales?: { type?: string; content?: string }[];
}

function bloquesScript(html: string, marca: string): string[] {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]!)
    .filter((s) => s.includes(marca));
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Exportada para los tests. */
export function catalogo(html: string): Item[] {
  return bloquesScript(html, "pushBenefit(")
    .flatMap((b) => argumentosDeLlamadas(b, "pushBenefit"))
    .map((args) => args[0])
    // La página descarta los que traen menos de 5 campos (`Falta data`).
    .filter((d) => esObjeto(d) && Object.keys(d).length >= 5)
    .map((d) => d as Item)
    .filter((i) => i.titulo);
}

/**
 * Las fichas con página propia (~93) casi nunca están enlazadas desde el
 * catálogo: se unen por el slug del título, que es el último tramo de su URL.
 */
function fichasDelIndice(html: string): Map<string, string> {
  const fichas = new Map<string, string>();
  for (const m of html.matchAll(/\/Personas\/Tarjetas\/Beneficios\/[^'"?#\s]+\/([^'"?#\/\s]+)/g)) {
    const slug = slugificar(m[1]!);
    if (slug && slug !== "default" && !fichas.has(slug)) fichas.set(slug, `${BASE}${m[0]}`);
  }
  return fichas;
}

/** Exportada para los tests. */
export function detalle(html: string): Detalle | null {
  let out: Detalle | null = null;
  for (const b of bloquesScript(html, "setBenefit(")) {
    for (const [seccion, datos] of argumentosDeLlamadas(b, "setBenefit")) {
      if (seccion === "DETALLE" && esObjeto(datos)) out = datos as Detalle;
    }
  }
  return out;
}

/** Las coordenadas vienen en el link de Google Maps: `...!3dLAT!4dLNG` o `@LAT,LNG`. */
function coordenadas(maps: string | undefined): { lat: number; lng: number } | null {
  if (!maps) return null;
  const m = maps.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? maps.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function sucursalesDe(d: Detalle | null): SucursalDeFuente[] {
  const out: SucursalDeFuente[] = [];
  for (const bloque of d?.donde ?? []) {
    if (bloque.type !== "location") continue;
    for (const l of bloque.content ?? []) {
      const punto = coordenadas(l.maps);
      // Sin coordenadas no hay sucursal para el mapa; la dirección igual va
      // en el texto y el geocodificador puede resolverla después.
      if (!punto) continue;
      const direccion = htmlATexto(l.address ?? "").split("\n")[0]?.trim();
      if (!direccion) continue;
      out.push({ nombre: null, direccion, ...punto });
    }
  }
  return out;
}

/** El campo `departamento` viene libre: "punta del este", "nacional", "web", listas. */
function departamentosLegibles(d: string | undefined): string {
  if (!d || /^(nacional|web|undefined)$/i.test(d)) return "";
  return d.replace(/punta del este/gi, "Maldonado (Punta del Este)");
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

export async function fetchScotiabank(): Promise<Crudo[]> {
  const indice = await bajarTexto(INDICE);
  const items = catalogo(indice);
  const fichas = fichasDelIndice(indice);
  const hoy = new Date().toISOString().slice(0, 10);
  const fetched_at = new Date().toISOString();
  const crudos: Crudo[] = [];
  const vistos = new Set<string>();

  for (const it of items) {
    // Lo vencido no se normaliza: Scotiabank deja meses de campañas viejas en
    // el catálogo y pagarlas no aporta nada.
    if (it.hasta && it.hasta < hoy) continue;

    const external_id = slugificar(`${it.titulo}-${it.desde ?? ""}`);
    if (vistos.has(external_id)) continue;
    vistos.add(external_id);

    let sucursales: SucursalDeFuente[] = [];
    let legalesFicha = "";
    let url_fuente = INDICE;
    const enlace = it.link?.includes("/Personas/Tarjetas/Beneficios/")
      ? it.link.replace(/^\//, `${BASE}/`)
      : fichas.get(slugificar(it.titulo!));
    if (enlace) {
      url_fuente = enlace;
      try {
        const d = detalle(await bajarTexto(url_fuente));
        sucursales = sucursalesDe(d);
        legalesFicha = (d?.legales ?? [])
          .map((l) => (typeof l.content === "string" ? htmlATexto(l.content) : ""))
          .join("\n")
          .trim();
      } catch {
        // La ficha es un extra: sin ella queda lo del catálogo, que ya es completo.
      }
    }

    const tramos = (it.descuentos ?? [])
      .map((d) => `${htmlATexto(d.pct ?? "")} ${htmlATexto(d.texto ?? "").replace(/\*\*/g, "")}`.trim())
      .filter(Boolean);
    const deptos = departamentosLegibles(it.departamento);
    const dias = (it.dias ?? "").replace(/^custom:/, "");
    const legal = htmlATexto(legalesFicha || it.legal || "");

    crudos.push({
      fuente_id: "scotiabank",
      external_id,
      url_fuente,
      contenido: [
        htmlATexto(it.titulo!),
        it.categoria ? `Rubro según Scotiabank: ${it.categoria}.` : "",
        tramos.length ? tramos.map((t) => `- ${t}`).join("\n") : "",
        dias ? `Días: ${dias}.` : "",
        deptos ? `Departamentos: ${deptos}.` : "",
        it.desde || it.hasta ? `Vigencia: ${it.desde ?? ""} a ${it.hasta ?? ""}.` : "",
        sucursales.length ? `Locales:\n${sucursales.map((s) => `- ${s.direccion}`).join("\n")}` : "",
        legal ? `Condiciones:\n${recortar(legal, 700)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      fetched_at,
      sucursales,
      datos: {
        titulo: htmlATexto(it.titulo!),
        categoria: it.categoria ?? "",
        descuentos: (it.descuentos ?? []).map((d) => ({ pct: d.pct ?? "", texto: d.texto ?? "" })),
        dias: it.dias ?? "",
        departamento: it.departamento ?? "",
        desde: it.desde || null,
        hasta: it.hasta || null,
        legal,
      } satisfies DatosScotiabank,
    });
  }
  return crudos;
}
