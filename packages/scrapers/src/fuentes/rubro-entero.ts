import { RUBROS_ENTEROS, keyDeRubro, type BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import type { Crudo, Extraido } from "../tipos.js";

/**
 * Fuentes que solo publican promos de rubro entero ("Lunes de librerías, 20%"):
 * Creditel y PassCard. Cada promo va al comercio canónico del rubro
 * (`todo-librerias`, ver RUBROS_ENTEROS en @tarjetazo/core). Son pocas y de
 * plantilla fija: se leen sin modelo.
 */

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** "Librerías", "cines y teatros", "Pasajes", "Gastronomía" → el rubro entero. */
const PALABRAS_RUBRO: [RegExp, string][] = [
  [/librer/, "librerias"],
  [/farmac/, "farmacias"],
  [/restaurant|gastronom/, "restaurantes"],
  [/helad/, "heladerias"],
  [/peluquer/, "peluquerias"],
  [/hotel/, "hoteles"],
  [/cine|teatro|entretenimiento|redticket/, "cines-teatros"],
  [/pasaje|transporte/, "pasajes"],
  [/telepeaje/, "telepeaje"],
  [/supermerc/, "supermercados"],
  [/combustible|estacion/, "combustible"],
  [/optic/, "opticas"],
  [/zapat|calzad/, "zapaterias"],
  [/veterinar/, "veterinarias"],
  [/taller|repuesto/, "talleres"],
  [/mutualista/, "mutualistas"],
  [/ferreter|pinturer|barraca/, "ferreterias"],
];

export function rubroDeTexto(texto: string) {
  const t = sinAcentos(texto);
  const id = PALABRAS_RUBRO.find(([re]) => re.test(t))?.[1];
  return id ? RUBROS_ENTEROS.find((r) => r.id === id) ?? null : null;
}

function diaDeTexto(texto: string): number | null {
  const m = sinAcentos(texto).match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?\b/);
  return m ? DIAS[m[1]!]! : null;
}

/** El crudo de una promo: una línea por dato, para que el hash cambie si cambia algo. */
function crudo(fuenteId: string, rubroId: string, url: string, lineas: string[]): Crudo {
  return { fuente_id: fuenteId, external_id: rubroId, url_fuente: url, contenido: lineas.join("\n"), fetched_at: new Date().toISOString() };
}

function base(rubroKey: string, url: string): Omit<BeneficioNormalizado, "titulo" | "descuento_raw" | "porcentaje" | "tipo" | "dias_semana" | "productos_elegibles" | "tope_monto" | "tope_periodo" | "legales_raw"> {
  return {
    comercio_key: rubroKey,
    cuotas: null,
    vigencia_desde: null,
    vigencia_hasta: null,
    departamentos: [],
    canal: "presencial",
    mecanica: [],
    acumulable: null,
    compra_minima: null,
    requiere_activacion: false,
    como_usarlo: [],
    url_fuente: url,
  } as never;
}

function comercioDe(rubroId: string): Extraido["comercio"] {
  const r = RUBROS_ENTEROS.find((x) => x.id === rubroId)!;
  return { key: keyDeRubro(r), nombre: r.nombre, categoria: r.categoria };
}

// ------------------------------------------------------------------ Creditel

const CREDITEL = "https://www.creditel.com.uy";
const CREDITEL_API = `${CREDITEL}/api/v1/promotions`;
const CREDITEL_PAGINA = `${CREDITEL}/promociones-descuentos`;

interface PromoCreditel {
  promotionId: number;
  name: string;
  description: string;
  category: string;
}

/** La API pagina de a 10; la categoría "1" son las promos de la tarjeta. */
export async function fetchCreditel(): Promise<Crudo[]> {
  const promos: PromoCreditel[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = JSON.parse(await bajarTexto(`${CREDITEL_API}?page=${page}`)) as { pageCount: number; results: PromoCreditel[] };
    promos.push(...r.results);
    if (page >= r.pageCount) break;
  }
  const crudos: Crudo[] = [];
  // La API no siempre respeta ?page=: la misma promo puede venir dos veces.
  const unicas = [...new Map(promos.map((p) => [p.promotionId, p])).values()];
  for (const p of unicas.filter((x) => x.category === "1")) {
    const rubro = rubroDeTexto(p.name);
    const dia = diaDeTexto(p.name);
    if (!rubro || dia === null) continue;
    crudos.push(crudo("creditel", rubro.id, CREDITEL_PAGINA, [p.name, `Día: ${dia}`, `Rubro: ${rubro.id}`, `Descuento: ${p.description.replace(/_{3,}/g, "·").replace(/\s+/g, " ").trim()}`]));
  }
  return crudos.slice(0, Number(process.env.SCRAPER_LIMITE) || Infinity);
}

export function normalizarCreditel(c: Crudo): Extraido {
  const [nombre = "", diaL = "", , descL = ""] = c.contenido.split("\n");
  const rubroId = c.external_id;
  const comercio = comercioDe(rubroId);
  const desc = descL.replace(/^Descuento: /, "");
  // "20% de descuento · y si sos MODO creditel 25% de descuento": el 20 es para
  // todos; el 25 depende de ser cliente MODO, que no es una tarjeta.
  const pct = Number(desc.match(/(\d{1,2})\s*%/)?.[1]);
  if (!comercio || !pct) return { crudo: c, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  const dia = Number(diaL.replace(/^Día: /, ""));
  const beneficio = {
    ...base(comercio.key, c.url_fuente),
    titulo: `${pct}% de descuento`,
    descuento_raw: `${nombre}: ${desc}`,
    porcentaje: pct,
    tipo: "porcentaje",
    dias_semana: [dia],
    productos_elegibles: ["creditel-mastercard"],
    tope_monto: null,
    tope_periodo: null,
    legales_raw: desc,
  } as BeneficioNormalizado;
  return { crudo: c, comercio, beneficios: [beneficio], productos_desconocidos: [], es_beneficio: true };
}

// ------------------------------------------------------------------ PassCard

const PASSCARD = "https://www.passcard.com.uy";
const PASSCARD_PAGINA = `${PASSCARD}/tarjeta/promociones`;

/**
 * Lo que la página no dice y sí las bases oficiales (PDF "Bases y condiciones
 * descuento todos los días", /download-variable/3): el día de las promos que
 * lo dicen a medias ("a mitad de semana", "el finde") y los topes, que son de
 * reintegro por cierre de estado de cuenta.
 */
const BASES_PASSCARD: Record<string, { dia: number; tope: number }> = {
  librerias: { dia: 1, tope: 400 },
  peluquerias: { dia: 2, tope: 400 },
  restaurantes: { dia: 3, tope: 400 },
  pasajes: { dia: 4, tope: 400 },
  "cines-teatros": { dia: 5, tope: 400 },
  heladerias: { dia: 6, tope: 400 },
  telepeaje: { dia: 0, tope: 200 },
};

/** "Passcard Experta 30% OFF" → producto. "Passcard" a secas es la Clásica. */
const TARJETA_PASSCARD: [RegExp, string][] = [
  [/like/, "passcard-like"],
  [/experta/, "passcard-experta"],
  [/black/, "passcard-black"],
  [/passcard/, "passcard-clasica"],
];

export function crudosDePasscard(html: string): Crudo[] {
  const crudos: Crudo[] = [];
  for (const m of html.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)) {
    const bloque = m[1]!;
    const titulo = htmlATexto(bloque.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "").trim();
    const rubro = rubroDeTexto(titulo);
    if (!rubro) continue;
    const textos = [...bloque.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p) => htmlATexto(p[1]!).trim()).filter(Boolean);
    const tarjetas = [...bloque.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((l) => htmlATexto(l[1]!).trim()).filter(Boolean);
    crudos.push(crudo("passcard", rubro.id, PASSCARD_PAGINA, [titulo, ...textos, "Tarjetas:", ...tarjetas]));
  }
  return crudos;
}

export async function fetchPasscard(): Promise<Crudo[]> {
  return crudosDePasscard(await bajarTexto(PASSCARD_PAGINA)).slice(0, Number(process.env.SCRAPER_LIMITE) || Infinity);
}

export function normalizarPasscard(c: Crudo): Extraido {
  const lineas = c.contenido.split("\n");
  const iTarjetas = lineas.indexOf("Tarjetas:");
  const textos = lineas.slice(1, iTarjetas).join(" ");
  const tarjetas = lineas.slice(iTarjetas + 1);
  const comercio = comercioDe(c.external_id);
  const bases = BASES_PASSCARD[c.external_id];
  const dia = diaDeTexto(textos) ?? bases?.dia ?? null;
  if (!comercio || dia === null) return { crudo: c, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };

  // Un tramo por porcentaje: "Passcard 25%, Like 25%, Experta 30%, Black 30%".
  // Sin porcentaje por tarjeta, el del texto ("50% de descuento en TODAS las heladerías") vale para todas.
  const porPct = new Map<number, string[]>();
  const pctGeneral = Number(textos.match(/(\d{1,2})\s*%/)?.[1]) || null;
  for (const t of tarjetas) {
    const producto = TARJETA_PASSCARD.find(([re]) => re.test(sinAcentos(t)))?.[1];
    const pct = Number(t.match(/(\d{1,2})\s*%/)?.[1]) || pctGeneral;
    if (!producto || !pct) continue;
    porPct.set(pct, [...(porPct.get(pct) ?? []), producto]);
  }
  if (porPct.size === 0 && pctGeneral) porPct.set(pctGeneral, []);

  const beneficios = [...porPct].map(([pct, productos]) => ({
    ...base(comercio.key, c.url_fuente),
    titulo: `${pct}% de descuento`,
    descuento_raw: `${pct}% en ${comercio.nombre.toLowerCase()}`,
    porcentaje: pct,
    // "Todos los descuentos son reflejados en el estado de cuenta" (bases).
    tipo: "reintegro",
    dias_semana: [dia],
    productos_elegibles: [...new Set(productos)],
    tope_monto: bases?.tope ?? null,
    tope_periodo: bases ? "mes" : null,
    legales_raw: `${textos} Reintegro en el estado de cuenta${bases ? `, tope $${bases.tope} por cierre` : ""} (bases y condiciones de Passcard).`,
  })) as BeneficioNormalizado[];
  return { crudo: c, comercio, beneficios, productos_desconocidos: [], es_beneficio: true };
}
