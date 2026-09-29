import { PaginaInexistente, bajarTexto } from "../http.js";
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

/**
 * Lo que lee el parser (`brou-parser.ts`), en `Crudo.datos`: los campos de la
 * ficha ya pasados a texto. El `contenido` sigue siendo la página entera
 * recortada, así el hash no cambia. No se guarda.
 */
export interface DatosBrou {
  nombre: string;
  /** Los badges del encabezado: "25 % DTO", "15 % DTO". Vacío en los 2x1. */
  valores: string[];
  /** La frase de debajo del badge: "20% de descuento con todas las tarjetas del Banco República." */
  resumen: string;
  /** El campo "Vigencia:" del encabezado (dd/mm/aaaa), si está. */
  vigencia: string | null;
  /** El cuerpo: una línea por párrafo o ítem ("25% de descuento con tarjetas de crédito…"). */
  descripcion: string[];
  /** Las condiciones del acordeón, una línea por ítem. */
  condiciones: string[];
  /** La categoría de la miga de pan ("Moda", "Gastronomía"); "Beneficios" si se entró por otra ruta. */
  categoria: string | null;
}

const lineas = (html: string) =>
  htmlATexto(html)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** Los campos de la ficha (`#beneficio-detail`). `null` si la página no tiene esa forma. */
export function datosDeFicha(html: string): DatosBrou | null {
  const i = html.indexOf('id="beneficio-detail"');
  if (i < 0) return null;
  const fin = html.indexOf("cont-relacionados", i);
  const ficha = html.slice(i, fin < 0 ? undefined : fin);
  const nombre = htmlATexto(ficha.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").trim();
  if (!nombre) return null;
  const descuento = ficha.match(/<div class="descuento">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const valores = [...descuento.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => htmlATexto(m[1]!).replace(/\s+/g, " ").trim());
  const despues = ficha.slice(ficha.indexOf("</h1>"));
  const resumen = htmlATexto(despues.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const vigencia = ficha.match(/<p>\s*Vigencia:\s*([\d/]+)\s*<\/p>/)?.[1] ?? null;
  const cuerpo = ficha.match(/<div class="col-12 mb-5">([\s\S]*?)<!-- CONDICIONES -->/)?.[1] ?? "";
  const acordeon = ficha.match(/<div class="accordion-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)?.[1] ?? "";
  const miga = [...(ficha.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/)?.[1] ?? "").matchAll(/<li(?![^>]*active)[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => htmlATexto(m[1]!).trim())
    .filter(Boolean);
  const categoria = miga.length > 1 ? miga.at(-1)! : null;
  return { nombre, valores, resumen, vigencia, descripcion: lineas(cuerpo), condiciones: lineas(acordeon), categoria };
}

/** El logo del comercio en la ficha (`<img class="logo img-thumbnail">`). */
export function logoDeFicha(html: string, pagina: string): string | null {
  const src = html.match(/<img[^>]*\ssrc="([^"]+)"[^>]*class="logo\b/)?.[1] ?? html.match(/<img[^>]*class="logo\b[^>]*\ssrc="([^"]+)"/)?.[1];
  if (!src) return null;
  try {
    return new URL(src, pagina).toString();
  } catch {
    return null;
  }
}

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
    let html: string;
    try {
      html = await bajarTexto(url);
    } catch (e) {
      // BROU saca una página (una promo que terminó) y la deja días en el
      // sitemap: un 404 suelto no puede tirar abajo la fuente. Al no verla, el
      // runner da de baja sus beneficios, que es lo correcto. Cualquier otro
      // error sí corta: no sabemos si la página sigue existiendo.
      if (!(e instanceof PaginaInexistente)) throw e;
      console.error(`  ${e.message}: la página ya no existe, se saltea`);
      continue;
    }
    crudos.push({
      fuente_id: "brou",
      external_id: slugDePath(path),
      url_fuente: url,
      contenido: recortarBrou(htmlATexto(html)),
      fetched_at: new Date().toISOString(),
      datos: datosDeFicha(html) ?? undefined,
      ...(logoDeFicha(html, url) ? { logo: logoDeFicha(html, url)! } : {}),
    });
  }
  return crudos;
}
