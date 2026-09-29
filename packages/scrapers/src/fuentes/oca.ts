import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo } from "../tipos.js";

/**
 * OCA sirve sus beneficios desde Contentstack; la página los pide con un token
 * de lectura que viene en su propio JavaScript. Consultamos la misma API que
 * consulta el navegador de cualquier visitante.
 */
/**
 * Se consulta el tipo `benefits` directo y no la página que los referencia: esa
 * página lista 57 de los 72 que OCA tiene publicados.
 */
const API = "https://cdn.contentstack.io/v3/content_types/benefits/entries";
const API_KEY = "blta9b90878af9436b4";
const TOKEN = "cs79086e32ff712b934208ced7";

/**
 * Lo que lee el parser (`oca-parser.ts`), en `Crudo.datos`: los campos de la
 * API tal como vienen, con los ids numéricos (el sitio los traduce en su JS:
 * producto 1 = Visa, 2 = Mastercard, 3 = OCA Blue, 4 = préstamos, 5 =
 * seguros; los días empiezan en 0 = lunes; los departamentos son 1..19 en
 * orden alfabético). No se guarda ni entra en el hash.
 */
export interface DatosOca {
  titulo: string;
  marca: string;
  tituloBeneficio: string;
  tituloLista: string;
  descripcion: string;
  condiciones: string;
  /** 0 = lunes … 6 = domingo, como los numera OCA. */
  dias: number[];
  desde: string | null;
  hasta: string | null;
  medios: number[];
  productos: number[];
  departamentos: number[];
  categorias: string[];
}

interface Beneficio {
  uid: string;
  title?: string;
  brand?: string;
  title_ben?: string;
  title_list?: string;
  description_list?: string;
  description_terms?: string;
  // Desde 2026-09-16 llegan como booleanos ("destacar el aviso"), no como texto.
  important?: unknown;
  important_tc?: unknown;
  date_ini?: string;
  date_end?: string;
  days?: string[];
  payment_method?: unknown;
  category?: { uid?: string }[];
  product?: unknown;
  location?: unknown;
  link?: unknown;
  extern_link?: unknown;
}

// OCA numera los días desde el lunes (su sitio: names = ["lunes", …, "domingo"]).
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const CATEGORIAS = "https://cdn.contentstack.io/v3/content_types/marketing_benefits_category/entries";

const ids = (valor: unknown): number[] =>
  (Array.isArray(valor) ? valor : []).map((v) => Number(v)).filter((n) => Number.isInteger(n));

/** Los campos de referencia vienen como objetos o listas; nos sirve su texto. */
function nombres(valor: unknown): string[] {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista
    .map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const clave of ["title", "name", "nombre", "label"]) {
          if (typeof o[clave] === "string") return o[clave] as string;
        }
      }
      return "";
    })
    .filter(Boolean)
    // Varios de estos campos vienen como ids ("3", "12") en vez de nombres:
    // no le dicen nada al normalizador y solo ensucian el texto.
    .filter((n) => !/^\d+$/.test(n.trim()));
}

/** En Contentstack un campo "link" es `{ title, href }`, no una cadena. */
function href(valor: unknown): string | null {
  if (typeof valor === "string" && valor.startsWith("http")) return valor;
  if (valor && typeof valor === "object") {
    const h = (valor as Record<string, unknown>).href;
    if (typeof h === "string" && h.startsWith("http")) return h;
  }
  return null;
}

/**
 * OCA cambia el tipo de sus campos sin aviso (un rich text pasó a ser un
 * booleano): lo que no sea texto se ignora en vez de tirar abajo la fuente.
 */
function limpiar(html: unknown): string {
  return typeof html === "string" && html ? htmlATexto(html).trim() : "";
}

export async function fetchOca(): Promise<Crudo[]> {
  const beneficios: Beneficio[] = [];
  // Contentstack pagina de a 100; pedimos hasta agotar.
  for (let salto = 0; ; salto += 100) {
    const url = new URL(API);
    url.searchParams.set("environment", "produccion");
    url.searchParams.set("limit", "100");
    url.searchParams.set("skip", String(salto));
    url.searchParams.set("include_count", "true");

    const res = await fetch(url, {
      headers: { api_key: API_KEY, access_token: TOKEN, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Contentstack devolvió ${res.status}`);
    const datos = (await res.json()) as { entries?: Beneficio[]; count?: number };
    const pagina = datos.entries ?? [];
    beneficios.push(...pagina);
    if (pagina.length < 100 || beneficios.length >= (datos.count ?? 0)) break;
  }

  // Los nombres de las categorías ("gastronomia", "moda"), para los comercios nuevos.
  const categorias = new Map<string, string>();
  try {
    const url = new URL(CATEGORIAS);
    url.searchParams.set("environment", "produccion");
    url.searchParams.set("limit", "100");
    const res = await fetch(url, {
      headers: { api_key: API_KEY, access_token: TOKEN, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const d = (await res.json()) as { entries?: { uid: string; title?: string }[] };
      for (const c of d.entries ?? []) if (c.title) categorias.set(c.uid, c.title);
    }
  } catch {
    // Sin categorías: los comercios nuevos quedan en "otros".
  }

  const fetched_at = new Date().toISOString();
  const crudos: Crudo[] = [];

  for (const b of beneficios) {
    const titulo = b.title_ben || b.title || b.brand || b.title_list || "";
    if (!titulo) continue;

    const dias = (b.days ?? []).map((d) => DIAS[Number(d)]).filter(Boolean);
    const medios = nombres(b.payment_method).concat(nombres(b.product));
    const lugares = nombres(b.location);

    const contenido = [
      titulo,
      b.brand && b.brand !== titulo ? `Comercio: ${b.brand}` : "",
      limpiar(b.description_list),
      limpiar(b.important),
      medios.length ? `Medios de pago: ${medios.join(", ")}.` : "",
      // Siete días es "todos los días": no hace falta enumerarlos.
      dias.length > 0 && dias.length < 7 ? `Días: ${dias.join(", ")}.` : "",
      b.date_ini || b.date_end ? `Vigencia: ${b.date_ini ?? ""} a ${b.date_end ?? ""}.` : "",
      lugares.length ? `Locales: ${lugares.join(", ")}.` : "",
      limpiar(b.description_terms) || limpiar(b.important_tc)
        ? `Condiciones:\n${limpiar(b.description_terms)}\n${limpiar(b.important_tc)}`.trim()
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    crudos.push({
      fuente_id: "oca",
      external_id: slugificar(b.uid),
      url_fuente: href(b.link) ?? href(b.extern_link) ?? "https://oca.uy/beneficios",
      contenido,
      fetched_at,
      datos: {
        titulo: b.title ?? "",
        marca: b.brand ?? "",
        tituloBeneficio: limpiar(b.title_ben),
        tituloLista: limpiar(b.title_list),
        descripcion: limpiar(b.description_list),
        condiciones: [limpiar(b.description_terms), limpiar(b.important_tc)].filter(Boolean).join("\n"),
        dias: ids(b.days),
        desde: b.date_ini || null,
        hasta: b.date_end || null,
        medios: ids(b.payment_method),
        productos: ids(b.product),
        departamentos: ids(b.location),
        categorias: (b.category ?? []).map((c) => categorias.get(c.uid ?? "") ?? "").filter(Boolean),
      } satisfies DatosOca,
    });
  }
  return crudos;
}
