import { bajarTexto } from "../http.js";
import { slugificar } from "../slug.js";
import { htmlATexto, recortarBrou } from "../texto.js";
import type { Crudo } from "../tipos.js";

const BASE = "https://beneficios.brou.com.uy";

/**
 * Categorías del sitio de BROU. Sus páginas listan solo una parte de los
 * beneficios, así que las combinamos con el sitemap (que a su vez tampoco los
 * trae todos: gastronomía no aparece).
 */
const CATEGORIAS_BROU = [
  "ensenanza",
  "espectaculos",
  "gastronomia",
  "hogar",
  "moda",
  "salud-estetica",
  "tecnologia",
  "transporte",
  "turismo",
  "hoteleria",
  "destacados",
  "semana-brou",
];

/** robots.txt de BROU prohíbe estas rutas. */
const PROHIBIDAS = [/^\/demo\//, /^\/admin\//, /^\/ensenanza\/hugo-fattoruso_2x1$/];

const NO_SON_BENEFICIOS = new Set(["favicon", "fonts", "css", "js", "img", "images"]);

function permitida(path: string): boolean {
  return !PROHIBIDAS.some((re) => re.test(path));
}

function pathsDeHtml(html: string): string[] {
  const re = /href="(?:https?:)?\/\/beneficios\.brou\.com\.uy(\/[^"/]+\/[^"]+)"/g;
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    const path = decodeURI(m[1]!);
    if (!NO_SON_BENEFICIOS.has(path.split("/")[1]!)) out.push(path);
  }
  return out;
}

/**
 * BROU publica el mismo beneficio bajo varias categorías
 * (`/gastronomia/expocafe` y `/destacados/expocafe` son la misma página), así
 * que el slug final es la identidad: es el `external_id` de la fuente.
 */
export function slugDePath(path: string): string {
  // BROU mezcla mayúsculas y guiones bajos ("BeneficioAUF",
  // "confiteria_carrera_2026"); lo normalizamos para que los ids sean parejos.
  return slugificar(path.split("/").filter(Boolean).at(-1)!);
}

async function descubrirPaths(): Promise<string[]> {
  const paths = new Set<string>();

  const sitemap = await bajarTexto(`${BASE}/sitemap.xml`);
  for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = decodeURI(new URL(m[1]!).pathname);
    if (path.split("/").filter(Boolean).length === 2) paths.add(path);
  }

  for (const cat of CATEGORIAS_BROU) {
    const html = await bajarTexto(`${BASE}/${cat}`);
    for (const path of pathsDeHtml(html)) paths.add(path);
  }

  // Un solo path por beneficio, el primero en orden alfabético para que la
  // corrida sea reproducible.
  const porSlug = new Map<string, string>();
  for (const path of [...paths].filter(permitida).sort()) {
    const slug = slugDePath(path);
    if (!porSlug.has(slug)) porSlug.set(slug, path);
  }
  return [...porSlug.values()];
}

export async function fetchBrou(): Promise<Crudo[]> {
  const paths = await descubrirPaths();
  const crudos: Crudo[] = [];
  for (const path of paths) {
    const url = `${BASE}${path}`;
    const html = await bajarTexto(url);
    crudos.push({
      fuente_id: "brou",
      external_id: slugDePath(path),
      url_fuente: url,
      contenido: recortarBrou(htmlATexto(html)),
      fetched_at: new Date().toISOString(),
    });
  }
  return crudos;
}
