import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo } from "../tipos.js";

/**
 * OCA sirve sus beneficios desde Contentstack; la página los pide con un token
 * de lectura que viene en su propio JavaScript. Consultamos la misma API que
 * consulta el navegador de cualquier visitante.
 */
const API = "https://cdn.contentstack.io/v3/content_types/marketing_benefits_page/entries";
const API_KEY = "blta9b90878af9436b4";
const TOKEN = "cs79086e32ff712b934208ced7";

interface Beneficio {
  uid: string;
  title?: string;
  brand?: string;
  title_ben?: string;
  title_list?: string;
  description_list?: string;
  description_terms?: string;
  important?: string;
  important_tc?: string;
  date_ini?: string;
  date_end?: string;
  days?: string[];
  payment_method?: unknown;
  product?: unknown;
  location?: unknown;
  link?: unknown;
  extern_link?: unknown;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

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

function limpiar(html: string | undefined): string {
  return html ? htmlATexto(html).trim() : "";
}

export async function fetchOca(): Promise<Crudo[]> {
  const url = new URL(API);
  url.searchParams.set("environment", "produccion");
  url.searchParams.append("include[]", "benefits");

  const res = await fetch(url, {
    headers: { api_key: API_KEY, access_token: TOKEN, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Contentstack devolvió ${res.status}`);
  const datos = (await res.json()) as { entries?: { benefits?: Beneficio[] }[] };
  const beneficios = datos.entries?.[0]?.benefits ?? [];

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
    });
  }
  return crudos;
}
