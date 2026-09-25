import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { contenidoPrincipal, htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido, SucursalDeFuente } from "../tipos.js";

/**
 * Midinero (prepaga Mastercard de Redpagos, #10). WordPress con una ficha por
 * beneficio listada en el sitemap. Todas usan la misma plantilla — porcentaje,
 * días, detalles, locales — y traen el rubro y los departamentos en las clases
 * del <article> y las coordenadas de cada local en un atributo: se lee con un
 * parser propio, sin modelo. Lo que no es un porcentaje ("Matrícula gratis")
 * queda sin tramos en vez de inventar uno.
 */

const BASE = "https://www.midinero.com.uy";
const SITEMAP = `${BASE}/beneficios-sitemap.xml`;
const PRODUCTO = "midinero-mastercard";

/** Rubros de Midinero → categorías de Tarjetazo. Lo desconocido va a "otros". */
const RUBRO: Record<string, string> = {
  supermercados: "supermercados",
  "restaurantes-y-bares": "restaurantes",
  "restaurantes-y-confiterias": "restaurantes",
  servicios: "servicios",
  educacion: "servicios",
  ecommerce: "otros",
  "salud-y-belleza": "salud-belleza",
  farmacias: "farmacias",
  opticas: "salud-belleza",
  hoteleria: "viajes",
  turismo: "viajes",
  "hogar-y-decoracion": "hogar-deco",
  papeleria: "libreria-juguetes",
  libreria: "libreria-juguetes",
  jugueterias: "libreria-juguetes",
  "tecnologia-audio-y-video": "electro-tecnologia",
  vestimenta: "indumentaria",
  calzado: "indumentaria",
  deportes: "deportes",
  entretenimiento: "entretenimiento",
  mascotas: "mascotas",
  combustible: "combustible",
  transporte: "transporte",
};

/**
 * Varias fichas no traen rubro en el HTML (casi todas las de Rocha): se
 * deduce del nombre del comercio, y si no dice nada, "otros".
 */
const RUBRO_POR_NOMBRE: [RegExp, string][] = [
  [/farmacia/, "farmacias"],
  [/optica|ortopedia|clinica|odont|sonrisa/, "salud-belleza"],
  [/papeleria|libreria|libros/, "libreria-juguetes"],
  [/cine|teatro/, "entretenimiento"],
  [/termas|hotel|hostel/, "viajes"],
  [/restaurante|bistro|cantina|parrilla|pizzeria|cafe|confiteria/, "restaurantes"],
  [/supermercado|almacen/, "supermercados"],
  [/multimarcas|roperia|ropa|calzado|accesorios|indumentaria/, "indumentaria"],
  [/bazar|hogar|deco/, "hogar-deco"],
  [/escuela|academia|academy|instituto/, "servicios"],
  [/gimnasio|fitness/, "deportes"],
];

const DEPARTAMENTOS = new Set([
  "artigas", "canelones", "cerro-largo", "colonia", "durazno", "flores", "florida", "lavalleja",
  "maldonado", "montevideo", "paysandu", "rio-negro", "rivera", "rocha", "salto", "san-jose",
  "soriano", "tacuarembo", "treinta-y-tres",
]);

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function decodificar(s: string): string {
  return htmlATexto(s).trim();
}

/** Los locales con coordenadas: `<a … coordenadas="-34.92,-56.16"><h3>Nombre</h3><li>Dirección</li>`. */
export function localesDe(html: string): SucursalDeFuente[] {
  const out: SucursalDeFuente[] = [];
  for (const m of html.matchAll(/<a\b[^>]*coordenadas="\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!(lat < -30 && lat > -35.2 && lng < -53 && lng > -58.6)) continue;
    const nombre = m[3]!.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1];
    const direccion = m[3]!.match(/<li[^>]*>([\s\S]*?)<\/li>/)?.[1];
    if (!direccion || !decodificar(direccion)) continue;
    out.push({ nombre: nombre ? decodificar(nombre) : null, direccion: decodificar(direccion), lat, lng });
  }
  return out;
}

/** El texto de la ficha, con rubro y departamentos al frente para el parser. */
export function crudoDeFicha(url: string, html: string): Crudo {
  const nombre = decodificar(html.match(/og:title" content="Descuentos Midinero en ([^"]*)"/)?.[1] ?? "");
  const clases = html.match(/<article\b[^>]*class="([^"]*)"/)?.[1] ?? "";
  const rubros = [...clases.matchAll(/categoria_beneficio-([a-z0-9-]+)/g)].map((m) => m[1]!);
  const deptos = [...clases.matchAll(/departamentos-([a-z0-9-]+)/g)].map((m) => m[1]!).filter((d) => DEPARTAMENTOS.has(d));
  const sucursales = localesDe(html);

  const lineas = htmlATexto(contenidoPrincipal(html))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // Encabezado: entre el último "Volver" y "Detalles", sin el nombre del
  // comercio ni la etiqueta de departamento que la plantilla repite ahí.
  const iDetalles = lineas.indexOf("Detalles");
  const iVolver = lineas.lastIndexOf("Volver", iDetalles >= 0 ? iDetalles : undefined);
  const encabezado = lineas
    .slice(iVolver + 1, iDetalles >= 0 ? iDetalles : undefined)
    .filter((l) => {
      const n = sinAcentos(l);
      return n !== sinAcentos(nombre) && n !== "varios" && !DEPARTAMENTOS.has(slugificar(l));
    });
  const iLocales = lineas.indexOf("Locales");
  const fin = lineas.findIndex((l, k) => k > iDetalles && /^(Locales|Copiar Link|Compartir|visitar web)$/i.test(l));
  const detalles = iDetalles >= 0 ? lineas.slice(iDetalles + 1, fin > 0 ? fin : undefined) : [];

  const contenido = [
    nombre,
    ...encabezado,
    `Rubro según Midinero: ${rubros.join(", ") || "sin rubro"}.`,
    `Departamentos según Midinero: ${deptos.join(", ") || "sin dato"}.`,
    "Detalles:",
    ...detalles,
    ...(iLocales >= 0 && sucursales.length > 0
      ? ["Locales:", ...sucursales.map((s) => `- ${s.nombre ?? nombre}: ${s.direccion}`)]
      : []),
  ].join("\n");

  return {
    fuente_id: "midinero",
    external_id: slugificar(new URL(url).pathname.replace(/^\/beneficio\//, "").replace(/\/$/, "")),
    url_fuente: url,
    contenido,
    fetched_at: new Date().toISOString(),
    sucursales,
  };
}

export async function fetchMidinero(): Promise<Crudo[]> {
  const sitemap = await bajarTexto(SITEMAP);
  const urls = [...sitemap.matchAll(/<loc>([^<]*\/beneficio\/[^<]+)<\/loc>/g)].map((m) => m[1]!.trim());
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  const crudos: Crudo[] = [];
  for (const url of urls.slice(0, limite)) {
    try {
      crudos.push(crudoDeFicha(url, await bajarTexto(url)));
    } catch (e) {
      console.error(`  midinero ${url}: ${String(e).slice(0, 120)}`);
    }
  }
  return crudos;
}

function dias(texto: string): number[] | null {
  const t = sinAcentos(texto);
  if (/todos los dias/.test(t)) return [];
  const rango = t.match(/de (domingo|lunes|martes|miercoles|jueves|viernes|sabado) a (domingo|lunes|martes|miercoles|jueves|viernes|sabado)/);
  if (rango) {
    const out: number[] = [];
    for (let d = DIAS[rango[1]!]!; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === DIAS[rango[2]!]) break;
    }
    return out.sort();
  }
  const sueltos = [...t.matchAll(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?\b/g)].map((m) => DIAS[m[1]!]!);
  return sueltos.length > 0 ? [...new Set(sueltos)].sort() : null;
}

/** "hasta el 31/12/2026" o "hasta el 31 de diciembre de 2026". */
function vigenciaHasta(texto: string): string | null {
  const t = sinAcentos(texto);
  const n = t.match(/hasta el (\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (n) {
    const anio = n[3]!.length === 2 ? `20${n[3]}` : n[3]!;
    return `${anio}-${n[2]!.padStart(2, "0")}-${n[1]!.padStart(2, "0")}`;
  }
  const l = t.match(/hasta el (\d{1,2}) de (\w+)(?: de (\d{4}))?/);
  const mes = l ? MESES[l[2]!] : undefined;
  if (l && mes) {
    const anio = l[3] ?? String(new Date().getFullYear());
    return `${anio}-${String(mes).padStart(2, "0")}-${l[1]!.padStart(2, "0")}`;
  }
  return null;
}

/** "Tope de reintegro $500 por mes", "tope de $1.000 por compra". */
function tope(texto: string): { monto: number; periodo: BeneficioNormalizado["tope_periodo"] } | null {
  const t = sinAcentos(texto);
  const m = t.match(/tope[^$\d]{0,40}\$\s*([\d.]+)(?:[^.\n]{0,30}?por (mes|dia|compra|semana))?/);
  if (!m) return null;
  const periodo = ({ mes: "mes", dia: "dia", compra: "compra", semana: "semana" } as const)[m[2] as "mes"] ?? null;
  return { monto: Number(m[1]!.replace(/\./g, "")), periodo };
}

export function normalizarMidinero(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n").map((l) => l.trim()).filter(Boolean);
  const nombre = lineas[0] ?? "";
  const rubros = crudo.contenido.match(/Rubro según Midinero: ([^.]*)\./)?.[1]?.split(", ") ?? [];
  const categoria =
    // "ecommerce, vestimenta": el rubro concreto antes que el genérico.
    rubros.map((r) => RUBRO[r]).find((c) => c && c !== "otros") ??
    rubros.map((r) => RUBRO[r]).find(Boolean) ??
    RUBRO_POR_NOMBRE.find(([re]) => re.test(sinAcentos(nombre)))?.[1] ??
    "otros";
  const deptos = (crudo.contenido.match(/Departamentos según Midinero: ([^.]*)\./)?.[1]?.split(", ") ?? []).filter((d) =>
    DEPARTAMENTOS.has(d),
  );
  const iDetalles = lineas.indexOf("Detalles:");
  const iLocales = lineas.indexOf("Locales:");
  const encabezado = lineas.slice(1, lineas.findIndex((l) => l.startsWith("Rubro según Midinero")));
  const detalles = lineas.slice(iDetalles + 1, iLocales > 0 ? iLocales : undefined).join("\n");

  const comercio = nombre ? { key: slugificar(nombre), nombre, categoria } : null;
  const pct = encabezado.join(" ").match(/(\d{1,2})\s*%\s*de ahorro/i);
  if (!comercio || !pct) {
    // Es un beneficio ("Matrícula gratis"), pero no un porcentaje: sin tramos.
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  }

  const diasLinea = encabezado.find((l) => dias(l) !== null);
  const t = tope(detalles);
  // "Válido en locales físicos y en la tienda online" = ambos; con código de
  // descuento o solo web, sin locales = online.
  const d = sinAcentos(detalles);
  const fisico = /locales? fisicos?|sucursales|en el local|en tienda/.test(d) || (crudo.sucursales ?? []).length > 0;
  const web = /online|\bweb\b|codigo|cupon/.test(d) || rubros.includes("ecommerce");
  const canal: BeneficioNormalizado["canal"] = fisico && web ? "ambos" : web ? "online" : "presencial";
  const beneficio: BeneficioNormalizado = {
    comercio_key: comercio.key,
    // Sin el comercio: la web ya lo muestra al lado ("… en Benny´s en Benny´s").
    titulo: `${pct[1]}% de ahorro`,
    descuento_raw: [encabezado.find((l) => /%/.test(l)) ? `${pct[1]}% de ahorro` : pct[0], diasLinea].filter(Boolean).join(" · "),
    porcentaje: Number(pct[1]),
    cuotas: null,
    tipo: "porcentaje",
    dias_semana: diasLinea ? dias(diasLinea)! : [],
    vigencia_desde: null,
    vigencia_hasta: vigenciaHasta(detalles),
    // Todos los departamentos = todo el país.
    departamentos: (deptos.length >= DEPARTAMENTOS.size ? [] : deptos) as BeneficioNormalizado["departamentos"],
    productos_elegibles: [PRODUCTO],
    tope_monto: t?.monto ?? null,
    tope_periodo: t?.periodo ?? null,
    canal,
    mecanica: [],
    acumulable: null,
    compra_minima: null,
    requiere_activacion: false,
    legales_raw: detalles || null,
    como_usarlo: [],
    url_fuente: crudo.url_fuente,
  } as BeneficioNormalizado;

  return { crudo, comercio, beneficios: [beneficio], productos_desconocidos: [], es_beneficio: true };
}
