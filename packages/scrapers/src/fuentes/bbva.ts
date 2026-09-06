import { bajarTexto, resolverRedireccion } from "../http.js";
import { contenidoPrincipal, htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, SucursalDeFuente } from "../tipos.js";

const BASE = "https://www.bbva.com.uy";
const LISTADO = `${BASE}/personas/productos/tarjetas/descuentos`;

/**
 * BBVA publica un listado paginado (`descuentos.pag-N.html`) con una tarjeta
 * por comercio que enlaza a su ficha (`/descuentos/<rubro>/<comercio>.html`).
 * La ficha es server-rendered y completa: rubro y localidad, vigencia, tramos
 * por tier de tarjeta, locales con dirección y link a Google Maps, y legales.
 * En 2025 daba 403 a bots; hoy responde con un User-Agent de navegador.
 */
async function fichasDelListado(): Promise<string[]> {
  const fichas = new Set<string>();
  let ultima = 1;
  for (let n = 1; n <= ultima; n++) {
    const url = n === 1 ? `${LISTADO}.html` : `${LISTADO}.pag-${n}.html`;
    let html: string;
    try {
      html = await bajarTexto(url, 3, { comoNavegador: true });
    } catch {
      break;
    }
    for (const m of html.matchAll(/href="(\/personas\/productos\/tarjetas\/descuentos\/[^"/]+\/[^"]+\.html)"/g)) {
      fichas.add(m[1]!);
    }
    for (const m of html.matchAll(/descuentos\.pag-(\d+)\.html/g)) ultima = Math.max(ultima, Number(m[1]));
  }
  return [...fichas].sort();
}

/** Los links "ir" de cada local van a Google Maps con las coordenadas. */
function coordenadas(href: string): { lat: number; lng: number } | null {
  const m =
    href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ??
    href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
    href.match(/[?&](?:q|query|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat < -29 && lat > -36 ? { lat, lng } : null;
}

async function localesDe(html: string): Promise<SucursalDeFuente[]> {
  const out: SucursalDeFuente[] = [];
  // "Dirección, Localidad (<a href=maps>ir</a>)": la dirección es el texto
  // inmediatamente anterior al link. El link es un acortador goo.gl: hay que
  // seguirlo para llegar a las coordenadas.
  for (const m of html.matchAll(/([^<>\n]{6,140}?)\s*\(\s*<a[^>]+href="([^"]*(?:maps|goo\.gl)[^"]*)"[^>]*>\s*ir\s*<\/a>/gi)) {
    const href = m[2]!;
    const destino = /goo\.gl|maps\.app/.test(href) ? await resolverRedireccion(href) : href;
    const punto = destino ? coordenadas(destino) : null;
    if (!punto) continue;
    const direccion = htmlATexto(m[1]!).trim();
    if (direccion) out.push({ nombre: null, direccion, ...punto });
  }
  return out;
}

export async function fetchBbva(): Promise<Crudo[]> {
  let fichas = await fichasDelListado();
  // Para probar sin bajar las ~300 fichas (el runner lo setea con --limite).
  const tope = Number(process.env.SCRAPER_LIMITE ?? process.env.BBVA_TOPE);
  if (Number.isFinite(tope) && tope > 0) fichas = fichas.slice(0, tope);
  const crudos: Crudo[] = [];
  for (const path of fichas) {
    const url = `${BASE}${path}`;
    let html: string;
    try {
      html = await bajarTexto(url, 3, { comoNavegador: true });
    } catch {
      continue;
    }
    const partes = path.split("/");
    const rubro = partes.at(-2) ?? "";
    const slug = partes.at(-1)!.replace(/\.html$/, "");
    const texto = htmlATexto(contenidoPrincipal(html));
    // Después de "Legales" viene el bloque largo; lo recortamos para no pagar
    // (ni leer) el resto de la página; 3.000 chars cubren los tres grupos de tarjetas.
    const i = texto.search(/\nLegales\n/);
    const contenido = i > 0 ? `${texto.slice(0, i)}\n\nLegales:\n${texto.slice(i + 9, i + 9 + 3000).trim()}` : texto;
    crudos.push({
      fuente_id: "bbva",
      external_id: slugificar(`${rubro}-${slug}`),
      url_fuente: url,
      contenido: `${contenido}\n\nRubro según BBVA: ${rubro}.`,
      fetched_at: new Date().toISOString(),
      sucursales: await localesDe(html),
    });
  }
  return crudos;
}
