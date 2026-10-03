import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, DireccionDeFuente, Extraido } from "../tipos.js";
import { departamentoDeLugar, departamentos } from "../geo/lugares.js";

/**
 * Pronto+ (#10), la Visa de la financiera Pronto. `/promos-tarjeta/` lista una
 * tarjeta por promo y cada una lleva a su página (`/promo-kfc/`, `/zero/`),
 * escrita a mano: "15% de descuento en KFC · Aplica los días lunes, martes y
 * miércoles · Tope $500 por cuenta y por mes · Válido hasta el 31/05/2026".
 * No hay plantilla, pero las frases se repiten: se lee con reglas, sin modelo.
 * Lo que no entiende queda en `legales_raw`.
 *
 * La lista mezcla páginas que no son de un comercio (IVA en restaurantes,
 * recarga de STM, "cines del interior", tarjeta gratis): se saltean.
 */

const BASE = "https://www.pronto.com.uy";
const LISTA = `${BASE}/promos-tarjeta/`;

/** Páginas de la lista que no son el beneficio de un comercio. */
const NO_COMERCIO = /^(restaurantes|stm|tus-servicios-favoritos|nueva-tarjeta.*|modo-minas|paseo-florida|promo-cines|shows-del-interior|page_id.*)$/;

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Algunas páginas vienen con el UTF-8 codificado dos veces ("AccedÃ©"). */
export function arreglarCodificacion(s: string): string {
  if (!/Ã[\u0080-¿]/.test(s)) return s;
  try {
    const arreglado = Buffer.from(s, "latin1").toString("utf8");
    return arreglado.includes("�") ? s : arreglado;
  } catch {
    return s;
  }
}

export function urlsDeLista(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\s+href="([^"]+)"\s+class="card h-100/g)) {
    // Hay links cargados a mano con errores ("https://www..pronto.com.uy/").
    const url = m[1]!.replace("://www..", "://www.");
    if (!url.startsWith(BASE)) continue;
    out.add(url.endsWith("/") ? url : `${url}/`);
  }
  return [...out];
}

/** "10% OFF en Farmacia Cooper", "Promo Óptica Focal", "Hasta 25% DTO Buffet Jureré" → el comercio. */
export function nombreDeTitulo(titulo: string): string {
  return titulo
    .replace(/\s*[-–]\s*(Tarjeta Visa )?Pronto\+?\s*$/i, "")
    .replace(/^promos?\s+/i, "")
    .replace(/^(hasta\s+)?\d{1,2}\s*%\s*(off|dto\.?|de descuento)?\s*(en\s+)?/i, "")
    .trim();
}

export function crudoDePagina(url: string, html: string): Crudo | null {
  const slug = new URL(url).pathname.replace(/^\/|\/$/g, "");
  if (NO_COMERCIO.test(slug)) return null;
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0];
  if (!main) return null;
  const titulo = arreglarCodificacion(htmlATexto(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim());
  // Sin título, el slug ("promo-regency" → "Regency").
  const nombre =
    nombreDeTitulo(titulo) ||
    slug.replace(/^promos?-/, "").replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const texto = arreglarCodificacion(htmlATexto(main))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  if (!nombre || !texto) return null;
  return {
    fuente_id: "pronto",
    external_id: slugificar(slug.replace(/^promos?-/, "")),
    url_fuente: url,
    contenido: [nombre, "Detalle:", texto].join("\n"),
    fetched_at: new Date().toISOString(),
    direcciones: direccionesDe(texto),
  };
}

/**
 * Las direcciones que nombra el texto, para ubicar el local en el mapa: "Se
 * aplica en el local de Montevideo, Av. Italia 5625" o "punto de venta de
 * Rivera 6694 esquina Arocena, Montevideo". El runner las geocodifica y solo
 * guarda el pin si es confiable (geo/direccion.ts): acá alcanza con no
 * inventar ninguna.
 */
export function direccionesDe(original: string): DireccionDeFuente[] {
  // "Av. Italia 5625": sin el punto de la abreviatura, que corta la frase.
  const texto = original.replace(/\b(av|avda|gral|dr|ing|bv|br|rbla|cnel|pte|prof|esq|sta|sto)\./gi, "$1");
  const out = new Map<string, DireccionDeFuente>();
  const agregar = (calle: string, lugar: string) => {
    const departamento = departamentoDeLugar(lugar);
    const c = calle
      .replace(/^.*?\b(punto de venta|local(es)?)(\s+(fisico|físico))?(\s+del local)?(\s+de)?\s+/i, "")
      .trim();
    if (!departamento || !/\d/.test(c) || c.length > 60) return;
    out.set(`${c}|${departamento}`, { direccion: `${c}, ${lugar.trim()}`, departamento });
  };
  const CALLE = String.raw`([A-ZÁÉÍÓÚÑ0-9][^,.;:•\n]{2,55}?\s\d{1,5}(?:\s*(?:[Bb]is|esq\.?|esquina)[^,.;•\n]{0,40})?)`;
  const LUGAR = String.raw`([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ ]{2,30}?)`;
  // "local de <Lugar>, <Calle 123>"
  for (const m of texto.matchAll(new RegExp(String.raw`local(?:es)? de ${LUGAR},\s*${CALLE}(?=[.,;
]|\s+y\s)`, "g"))) agregar(m[2]!, m[1]!);
  // "<Calle 123>, <Lugar>"
  for (const m of texto.matchAll(new RegExp(String.raw`${CALLE},\s*${LUGAR}(?=[.,;
-]|\s+y\s|$)`, "g"))) agregar(m[1]!, m[2]!);
  return [...out.values()];
}

export async function fetchPronto(): Promise<Crudo[]> {
  const urls = urlsDeLista(await bajarTexto(LISTA));
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  const crudos: Crudo[] = [];
  for (const url of urls) {
    if (crudos.length >= limite) break;
    try {
      const c = crudoDePagina(url, await bajarTexto(url));
      if (c) crudos.push(c);
    } catch (e) {
      // Hay tarjetas que apuntan a páginas borradas (404).
      console.error(`  pronto ${url}: ${String(e).slice(0, 120)}`);
    }
  }
  return crudos;
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const DIA = "(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)";
/** "sábados" → sábado; "lunes" ya es singular. */
const dia = (d: string) => DIAS[d.replace(/^(sabado|domingo)s$/, "$1")]!;

function fechaNumerica(d: string, m: string, a: string): string {
  return `${a.length === 2 ? `20${a}` : a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "hasta el 30 de setiembre de 2026", "hasta 31/12/2026", "Vigencia: 1/11/2023 al 30/09/26". */
export function vigencia(t: string): { desde: string | null; hasta: string | null } {
  const num = String.raw`(\d{1,2})\/(\d{1,2})\/(\d{2,4})`;
  const let_ = String.raw`(\d{1,2})(?:ero|ro|°|º)? de ([a-z]+)(?: de (\d{4}))?`;
  let hasta: string | null = null;
  const hn = t.match(new RegExp(`(?:hasta(?: el)?|al) ${num}`));
  if (hn) hasta = fechaNumerica(hn[1]!, hn[2]!, hn[3]!);
  const hl = t.match(new RegExp(`(?:hasta(?: el)?|al) ${let_}`));
  if (!hasta && hl && MESES[hl[2]!] && hl[3]) hasta = fechaNumerica(hl[1]!, String(MESES[hl[2]!]), hl[3]);
  let desde: string | null = null;
  const dn = t.match(new RegExp(`(?:desde(?: el)?|vigencia:?) ${num}`));
  if (dn) desde = fechaNumerica(dn[1]!, dn[2]!, dn[3]!);
  const dl = t.match(new RegExp(`desde(?: el)? ${let_}`));
  if (!desde && dl && MESES[dl[2]!]) {
    // "desde 1ero de noviembre hasta el 31 de octubre de 2026": el año es el anterior.
    const anioHasta = Number(hasta?.slice(0, 4));
    const mes = MESES[dl[2]!]!;
    const anio = dl[3] ?? (anioHasta ? String(mes > Number(hasta!.slice(5, 7)) ? anioHasta - 1 : anioHasta) : null);
    if (anio) desde = fechaNumerica(dl[1]!, String(mes), anio);
  }
  if (desde && hasta && desde > hasta) desde = null;
  return { desde, hasta };
}

/** "los lunes, martes y miércoles", "de viernes a domingo", "todos los miércoles". */
export function dias(t: string): number[] {
  const rango = t.match(new RegExp(`(?:valid[oa]|aplica)[^.\\n]{0,20}? de ${DIA} a ${DIA}`));
  if (rango) {
    const a = dia(rango[1]!);
    const b = dia(rango[2]!);
    const out: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === b) break;
    }
    return out.sort();
  }
  const lista = t.match(new RegExp(`(?:los|todos los|dias)\\s+(${DIA}(?:\\s*(?:,|y)\\s*${DIA})*)`));
  if (!lista) return [];
  return [...new Set([...lista[1]!.matchAll(new RegExp(DIA, "g"))].map((m) => dia(m[1]!)))].sort();
}

function tope(t: string): { monto: number; periodo: BeneficioNormalizado["tope_periodo"] } | null {
  const m = t.match(/tope[^$]{0,40}\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)([^.\n]{0,40})/);
  if (!m) return null;
  const resto = m[2] ?? "";
  const periodo: BeneficioNormalizado["tope_periodo"] = /mes/.test(resto) ? "mes" : /dia/.test(resto) ? "dia" : /cuenta/.test(resto) ? "beneficio" : "compra";
  return { monto: Number(m[1]!.replace(/[.,]/g, "")), periodo };
}

const RUBRO: [RegExp, string][] = [
  [/farmac/, "farmacias"],
  [/optic|vision|optisol/, "salud-belleza"],
  [/dental|odontolog|dent\b|brackets|dra\.|spa\b|masaje|centro ianthe|natura siberica|bella/, "salud-belleza"],
  [/veterinari|puntovet|mascota|ser animal/, "mascotas"],
  [/hotel|regency|viajes|colonia express|experiences|hertz|avis|cabify|jurere/, "viajes"],
  [/kfc|mc ?donald|pizza|bbq|restaurante|floreal|cerveceria|chelato|grido|gelato|buffet|volcanica|barrita/, "restaurantes"],
  [/cine|games|game ?stop|mundo cartoon|ludic/, "entretenimiento"],
  [/gimnasio|fitness|fit center|training|vital club|sport|deportiv|electrofitness/, "deportes"],
  [/papeleria|libreria|lunares|habichuelas|mikangaroo/, "libreria-juguetes"],
  [/academy|coderhouse|education|e-learning|ude\b|talleres|foto arte/, "servicios"],
  [/universo binario|control remoto|tecno/, "electro-tecnologia"],
  [/vidrimas|baratillo|thonet|cebala|lasa|agro/, "hogar-deco"],
  [/joyas|boutique|guapa|paprika|pappolino|macri|kuka|marijo|mala\b|freedom|tienda|zero|delfi|ina\.uy|baiz|b@iz|canel/, "indumentaria"],
];

export function normalizarPronto(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n");
  const nombre = lineas[0]?.trim() ?? "";
  const detalle = lineas.slice(2).join("\n");
  const t = sinAcentos(detalle);
  const categoria = RUBRO.find(([re]) => re.test(sinAcentos(`${nombre} ${detalle.slice(0, 200)}`)))?.[1] ?? "otros";
  const comercio = nombre ? { key: slugificar(nombre), nombre, categoria } : null;

  // El número de la cabecera ("Hasta 40% de descuento", "15% DTO"). Si dice
  // "hasta", el descuento_raw lo conserva: hay tramos menores.
  const cabecera = t.slice(0, 250);
  const pct = cabecera.match(/(hasta\s+(?:un\s+)?)?(\d{1,2})\s*%\s*(?:de descuento|off|dto|menos)/);
  const dosPorUno = /2\s*x\s*1/.test(cabecera);
  // "60% de regalo en la carga": saldo extra en una tarjeta de juegos, no un descuento.
  const bonus = /de regalo en la carga|carga bonus/.test(cabecera);
  if (!comercio || bonus || (!pct && !dosPorUno)) {
    // "Upgrade gratis", "$1.000 de regalo": beneficios, pero no un porcentaje.
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  }

  const v = vigencia(t);
  const tp = tope(t);
  const web = /\bweb\b|online|codigo|\.com\.uy/.test(t);
  const presencial = /punto de venta|local|sucursal|presencial/.test(t) && !/no aplica (en|a) (locales|la tienda fisica)/.test(t);
  const soloWeb = /se aplica en (la )?web|aplica en web|se aplica en [a-z0-9-]+\.com\.uy/.test(t) && !/local/.test(t);
  const canal: BeneficioNormalizado["canal"] = soloWeb ? "online" : web && presencial ? "ambos" : web && !presencial ? "online" : "presencial";
  const estadoDeCuenta = /estado de cuenta/.test(t) && !/punto de venta/.test(t);
  const deptos = departamentos(t);
  // "Hasta 50% de descuento" y las condiciones dicen un solo número ("25% de
  // descuento"): vale el de las condiciones, fijo. Con varios ("50% en
  // carreras técnicas, 40% en universitarias") queda el máximo con "Hasta".
  const enCondiciones = /condiciones/.test(t)
    ? [...new Set([...t.slice(t.search(/condiciones/)).matchAll(/(hasta\s+(?:un\s+)?)?(\d{1,2})\s*%/g)].filter((m) => !m[1]).map((m) => Number(m[2])))]
    : [];
  const unoSolo = pct?.[1] && enCondiciones.length === 1 && enCondiciones[0]! <= Number(pct[2]) ? enCondiciones[0]! : null;
  const hasta = Boolean(pct?.[1]) && unoSolo === null;
  const porcentaje = unoSolo ?? (pct ? Number(pct[2]) : null);
  const beneficio = {
    comercio_key: comercio.key,
    titulo: pct ? `${hasta ? "Hasta " : ""}${porcentaje}% de descuento` : "2x1 con Visa Pronto+",
    descuento_raw: pct ? `${hasta ? "Hasta " : ""}${porcentaje}%` : "2x1",
    porcentaje,
    cuotas: null,
    tipo: dosPorUno && !pct ? "2x1" : estadoDeCuenta ? "reintegro" : "porcentaje",
    dias_semana: dias(t),
    vigencia_desde: v.desde,
    vigencia_hasta: v.hasta,
    departamentos: deptos.length >= 19 ? [] : deptos,
    // "Visa Pronto+ & Visa Pronto+ Premium" o sin decir: las dos.
    productos_elegibles: [],
    tope_monto: tp?.monto ?? null,
    tope_periodo: tp?.periodo ?? null,
    tope_moneda: "UYU",
    canal,
    mecanica: [],
    acumulable: /no (es )?acumulable|no aplica con otras|no es aplicable con otras/.test(t) ? false : /acumulable con/.test(t) ? true : null,
    compra_minima: Number(t.match(/compras mayores a (?:los )?\$\s*(\d[\d.]*)/)?.[1]?.replace(/\./g, "")) || null,
    requiere_activacion: false,
    legales_raw: detalle || null,
    como_usarlo: [...t.matchAll(/codigo(?: promocional)?:?\s*([a-z0-9]{4,})/g)].map((m) => `Código: ${m[1]!.toUpperCase()}`),
    url_fuente: crudo.url_fuente,
  } as BeneficioNormalizado;

  return { crudo, comercio, beneficios: [beneficio], productos_desconocidos: [], es_beneficio: true };
}
