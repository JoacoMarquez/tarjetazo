import { BeneficioNormalizadoSchema, type BeneficioNormalizado } from "@tarjetazo/core";
import { mapearProductos, productosPorTipo, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { departamentoDeLugar, departamentos as departamentosQueNombra } from "../geo/lugares.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";
import type { DatosScotiabank } from "./scotiabank.js";
import {
  departamentosDe,
  diasDe,
  sinAcentos,
  topeDelTramo,
  topesDelLegal as topesDeLegales,
  vigenciaDelLegal,
  type TopeLeido,
} from "./legales.js";

// Las piezas genéricas viven en legales.ts; se reexportan para los tests.
export { departamentosDe, diasDe, vigenciaDelLegal };

/**
 * "Tope de $10.000 (pesos uruguayos diez mil) por compra": sin decir de qué es
 * el tope. En Scotiabank es de compra: usa exactamente los montos (10.000 a
 * 25.000) de los "Tope de compra $X" explícitos, mientras que sus topes de
 * descuento explícitos van de $1.000 a $5.000 (catálogo de 2026-10).
 */
const TOPE_POR_COMPRA = /\btope\s+de\s+(u\$d|u\$s|us\$|usd|\$)\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:\([^)]*\)\s*)?por\s+compra\b/g;

/**
 * Los topes de los legales, con las tarjetas de "para tarjetas X $2500"
 * pasadas a ids de Scotiabank y los "Tope de $X por compra" leídos como tope
 * de compra (ver TOPE_POR_COMPRA; la lectura común los toma como de descuento).
 */
export function topesDelLegal(legal: string): TopeLeido[] {
  const deCompra = new Set(
    [...sinAcentos(legal).matchAll(TOPE_POR_COMPRA)].map((m) => `${Number(m[2]!.replace(/\./g, ""))}|${m[1] === "$" ? "UYU" : "USD"}`),
  );
  return topesDeLegales(legal, (frase) => tarjetasDe(frase).ids).map((t) =>
    t.sobre === "devolucion" && t.periodo === "compra" && deCompra.has(`${t.monto}|${t.moneda}`) ? { ...t, sobre: "compra" as const } : t,
  );
}

/**
 * Scotiabank publica su catálogo ya estructurado (porcentaje, tarjetas, días,
 * departamento, vigencia y legales por beneficio), así que no hace falta un
 * modelo para leerlo: este parser arma los tramos a partir de esos campos, que
 * el fetch le pasa en `crudo.datos`. De los legales solo saca lo que el
 * catálogo no trae (topes, fechas concretas de la promo, "no acumulable").
 *
 * Un tramo por cada descuento del catálogo. Lo que no encaja se descarta (un
 * descuento sin porcentaje ni cuotas es un texto de marketing) o va a revisión
 * (un porcentaje que no se puede leer, topes que no se pueden asignar), nunca
 * se inventa.
 */

const FUENTE = "scotiabank";

/**
 * Rubros de Scotiabank → categorías nuestras; vale el primero que tenga una.
 * "interior", "platinumcard" y "shoppings" no dicen el rubro del comercio.
 */
const RUBRO: Record<string, string> = {
  restaurantes: "restaurantes",
  restaurantea: "restaurantes",
  cafeteria: "cafeterias",
  vestimenta: "indumentaria",
  joyerias: "indumentaria",
  mascotas: "mascotas",
  librerias: "libreria-juguetes",
  papelerias: "libreria-juguetes",
  ninos: "libreria-juguetes",
  hogar: "hogar-deco",
  supermercados: "supermercados",
  farmacias: "farmacias",
  opticas: "salud-belleza",
  estetica: "salud-belleza",
  deportes: "deportes",
  tecnologia: "electro-tecnologia",
  viajes: "viajes",
  cines: "entretenimiento",
  automovil: "transporte",
};

/** Texto del catálogo: sin HTML, sin el `**negrita**` y con los espacios colapsados. */
function limpio(s: string): string {
  return htmlATexto(s).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function esDatos(d: unknown): d is DatosScotiabank {
  const x = d as DatosScotiabank | undefined;
  return !!x && typeof x.titulo === "string" && Array.isArray(x.descuentos) && typeof x.legal === "string";
}

// ---------------------------------------------------------------- comercio

/**
 * El nombre del comercio y, si el título la nombra, la sucursal: "Albanes -
 * Florida" → Albanes en Florida; "Zule | Panadería y Café" → Zule; "Cines
 * 50%" → Cines. Lo que va después de un guion solo se saca si es un lugar
 * ("BIGA - pizza & pasta" queda entero), como hacía el modelo: la clave del
 * comercio sale de acá y cambiarla movería los beneficios a otro comercio.
 * Exportada para los tests.
 */
/**
 * Fichas de un rubro, no de un comercio, cuya key cae en un alias de rubro
 * entero que les queda grande. "Cines 50%" da `cines`, alias de
 * `todo-cines-teatros`, pero los legales dicen que vale solo en
 * "establecimientos que tengan como giro exclusivo el de Cine": los teatros
 * no entran. No hay rubro entero de cines solos: va a un comercio propio.
 */
const COMERCIO_DE_RUBRO: Record<string, { key: string; nombre: string }> = {
  cines: { key: "salas-de-cine", nombre: "Salas de cine" },
};

export function comercioDelTitulo(titulo: string): { nombre: string; departamento: string | null } {
  let nombre = titulo.split(/\s+\|\s+/)[0]!.replace(/\s+\d{1,2}\s*%$/, "").trim();
  let departamento: string | null = null;
  const guion = nombre.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (guion) {
    // El lugar entero ("Florida", "Treinta y Tres", "La Paloma"), no un texto
    // que lo contiene ("Hyatt Centric Montevideo", "Parrilla Punta del Este").
    const lugar = sinAcentos(guion[2]!).trim();
    const d = departamentoDeLugar(lugar);
    if (d && (slugificar(lugar) === d || departamentosQueNombra(lugar).length === 0)) {
      departamento = d;
      nombre = guion[1]!;
    }
  }
  return { nombre: nombre || titulo, departamento };
}

function categoriaDe(rubros: string): string {
  for (const r of rubros.split(",").map((x) => sinAcentos(x).trim())) {
    if (RUBRO[r]) return RUBRO[r]!;
  }
  return "otros";
}

/** "2026|-07-01" (así viene alguna) → "2026-07-01"; lo que no es una fecha, null. */
function fechaDelCatalogo(f: string | null): string | null {
  const m = (f ?? "").replace(/[^\d-]/g, "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ---------------------------------------------------------------- tarjetas

/** Palabras que hacen de un pedazo de frase el nombre de una tarjeta. */
const NOMBRE_TARJETA = /\b(platinum|infinite|signature|gold|oro|premium|amex|american express|visa|master ?card|connectmiles|copa|credito|debito|scotiabank|club card)\b/;

/** Los de nivel alto: lo que Scotiabank llama "Platinum, Infinite, Gold y Débito Premium". */
const PREMIUM = ["platinum", "infinite", "gold", "debito premium"];

/**
 * Las tarjetas que nombra una frase del catálogo o de los legales, como ids
 * del catálogo. Parte la lista ("Crédito Platinum, Infinite, Gold y Débito
 * Premium") y pasa cada nombre por `mapearProductos`, el mismo mapeo (y las
 * mismas reglas del backoffice) que usa el normalizador con modelo. Sin ningún
 * nombre de tarjeta, `nombres` queda vacío. Exportada para los tests.
 */
export function tarjetasDe(frase: string): { ids: string[]; desconocidos: string[]; nombres: string[] } {
  let f = sinAcentos(frase)
    .replace(/\btarjas\b/g, "tarjetas")
    .replace(/\bmaster card\b/g, "mastercard")
    // La Visa Débito Infinite es la Débito Premium (en el catálogo, débito con
    // nivel infinite): no la Visa Infinite de crédito.
    .replace(/\bdebito infinite\b/g, "debito premium")
    .replace(/[*"“”]/g, "");
  const nombres: string[] = [];
  // "Crédito y Débito Premium", "Débito y Crédito Premium": el "Premium" es de
  // las dos, que es como Scotiabank llama a las de nivel alto.
  if (/(credito y debito|debito y credito) premium/.test(f)) {
    nombres.push(...PREMIUM);
    f = f.replace(/(credito y debito|debito y credito) premium/g, " ");
  }
  for (let pedazo of f.split(/,|;|:|\/|\s+y\s+|\s+e\s+|\s+o\s+/)) {
    pedazo = pedazo.trim();
    // "de todo el país con tarjetas débito Premium" → "tarjetas debito premium".
    const i = pedazo.indexOf("tarjeta");
    if (i > 0) pedazo = pedazo.slice(i);
    pedazo = pedazo.replace(/\s+(emitidas?|de scotiabank uruguay|para compras|en el|en la|en los|en todos|todos los dias).*$/, "").trim();
    if (NOMBRE_TARJETA.test(pedazo)) nombres.push(pedazo);
  }
  if (nombres.length === 0) return { ids: [], desconocidos: [], nombres };
  const { ids, desconocidos } = mapearProductos(FUENTE, nombres);
  return { ids: ids.sort(), desconocidos, nombres };
}

/**
 * Frases de los legales que dicen qué porcentaje va con qué tarjetas: "Todos
 * los días 15% de descuento con Tarjetas de Débito y Crédito y 25% Tarjetas de
 * Crédito Gold, Platinum e Infinite". Sus tarjetas suman a las del descuento
 * del mismo porcentaje, lo reemplazan si no nombra ninguna ("50% en
 * Telepeajes") y arman los tramos de las fichas cuyo catálogo no trae el
 * porcentaje.
 */
function frasesDelLegal(legal: string): { pct: number; hasta: boolean; tarjetas: string }[] {
  const t = sinAcentos(legal);
  const out: { pct: number; hasta: boolean; tarjetas: string }[] = [];
  const re =
    /(hasta\s+)?(\d{1,2})\s*%\s*(?:de\s+(?:descuento|ahorro|devolucion|reintegro)\s+)?(?:(?:con|para)\s+)?(?:las\s+|tus\s+)?(tarjetas?\b.*?)(?=\s+y\s+(?:un\s+)?\d{1,2}\s*%|[.;](?:\s|$)|$|\s+emitidas|,?\s+con tope|\s+para compras|\s+el descuento|\s+de scotiabank uruguay)/gm;
  for (const m of t.matchAll(re)) {
    out.push({ pct: Number(m[2]), hasta: !!m[1], tarjetas: m[3]! });
  }
  return out;
}

/** "aplica únicamente a las tarjetas de crédito The Platinum Card American Express emitidas por…". */
function tarjetasGeneralesDelLegal(legal: string): string | null {
  const t = sinAcentos(legal);
  const m = t.match(/(?:unicamente|exclusivamente|solo|exclusiva)\s+(?:a|para)\s+(?:las\s+)?(tarjetas?\b.*?)(?=\s+emitidas|[.;](?:\s|$)|$|\s+de scotiabank)/m);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------- descuentos

interface TramoLeido {
  tipo: BeneficioNormalizado["tipo"];
  porcentaje: number | null;
  cuotas: number | null;
  hasta: boolean;
  /** Texto del descuento: "25% de ahorro con tarjetas Platinum, Infinite, Gold y Débito Premium." */
  raw: string;
  /** Lo que queda después del porcentaje: la frase con las tarjetas. */
  frase: string;
  /** "sin interés" / "sin recargo", para el título de las cuotas. */
  sinQue: string;
}

/**
 * Un descuento del catálogo → sus tramos. Casi siempre uno: "25% de ahorro"
 * con "con tarjetas Platinum…", "12 y 18 cuotas" con "sin recargo." (un tramo
 * con el máximo, 18). Ballon escribe "15%" y "y 25% de ahorro…": dos tramos
 * con las mismas tarjetas. Sin porcentaje, cuotas ni 2x1 no es un tramo
 * (textos como "Disfrutá beneficios exclusivos…"): lista vacía. Un
 * porcentaje que no se puede leer ("25% + 15% ADICIONAL") → `null`, a revisión.
 */
function leerDescuento(pctCrudo: string, textoCrudo: string): TramoLeido[] | null {
  const pct = limpio(pctCrudo);
  const texto = limpio(textoCrudo);
  const raw = `${pct} ${texto}`.replace(/\s+/g, " ").replace(/(de ahorro)\s+de ahorro/i, "$1").trim();
  const t = sinAcentos(raw);

  const cuotas = [...t.matchAll(/((?:\d{1,2}\s*(?:,|y|o)\s*)*\d{1,2})\s*cuotas/g)]
    .flatMap((m) => m[1]!.match(/\d{1,2}/g)!.map(Number))
    .filter((n) => n >= 2 && n <= 36);
  if (cuotas.length > 0 && !/\d\s*%/.test(t)) {
    return [{
      tipo: "cuotas",
      porcentaje: null,
      cuotas: Math.max(...cuotas),
      hasta: new Set(cuotas).size > 1,
      raw,
      frase: t.replace(/^.*?cuotas/, ""),
      sinQue: /sin interes/.test(t) ? "sin interés" : /sin recargo/.test(t) ? "sin recargo" : "",
    }];
  }
  if (/\b2\s*x\s*1\b/.test(t)) {
    return [{ tipo: "2x1", porcentaje: null, cuotas: null, hasta: false, raw, frase: t, sinQue: "" }];
  }
  if (/\d\s*%\s*\+/.test(t)) return null;
  // "15%" + "y 25% de ahorro Todos los días con tus Tarjetas Scotiabank".
  const pcts = t.match(/^(hasta\s+)?(\d{1,2})\s*%(?:\s*de ahorro)?(?:\s+y\s+(\d{1,2})\s*%)?/);
  if (!pcts) {
    // El porcentaje escrito solo en el texto: "Todos los días 10% de ahorro con Tarjetas de Débito."
    const suelto = t.match(/(hasta\s+)?(\d{1,2})\s*%/);
    if (!suelto) return [];
    return [{
      tipo: "porcentaje", porcentaje: Number(suelto[2]), cuotas: null, hasta: !!suelto[1], raw,
      frase: t.slice(suelto.index! + suelto[0].length), sinQue: "",
    }];
  }
  const frase = t.slice(pcts[0].length);
  return [pcts[2], pcts[3]]
    .filter((p): p is string => p !== undefined)
    .map((p) => ({
      tipo: "porcentaje" as const, porcentaje: Number(p), cuotas: null, hasta: !!pcts[1], raw, frase, sinQue: "",
    }));
}

function tituloDe(t: TramoLeido): string {
  if (t.tipo === "cuotas") return `${t.hasta ? "Hasta " : ""}${t.cuotas} cuotas ${t.sinQue}`.trim();
  // El schema pide al menos 4 caracteres: "2x1" solo no pasa.
  if (t.tipo === "2x1") return "Promoción 2x1";
  return `${t.hasta ? "Hasta " : ""}${t.porcentaje}% de descuento`;
}

/**
 * Canal: presencial salvo que los legales digan que vale en la web. "Si aplica
 * el descuento para ventas efectuadas por la web propia", "compras realizadas
 * en la página web … y en su espacio" → ambos; solo la web → online.
 */
function canalDe(legal: string): BeneficioNormalizado["canal"] {
  const t = sinAcentos(legal);
  const web = /si aplica (?:el descuento )?(?:para|a) (?:las )?ventas efectuadas por la web|pagina web|sitio web|tienda online|compras online|en linea/.test(t);
  if (!web) return "presencial";
  const local = /establecimiento|local|tienda fisica|sucursal|espacio|si aplica (?:el descuento )?(?:para|a) (?:las )?ventas efectuadas por la web/.test(t);
  return local ? "ambos" : "online";
}

export function normalizarScotiabank(crudo: Crudo): Extraido {
  if (!esDatos(crudo.datos)) {
    // Sin los campos del catálogo no hay nada confiable que leer. Tirar hace
    // que la página cuente como fallida y sus beneficios sigan publicados.
    throw new Error(`scotiabank: ${crudo.external_id} no trae los datos del catálogo`);
  }
  const d = crudo.datos;
  const delTitulo = comercioDelTitulo(limpio(d.titulo));
  const deptoDelTitulo = delTitulo.departamento;
  const deRubro = COMERCIO_DE_RUBRO[slugificar(delTitulo.nombre)];
  const nombre = deRubro?.nombre ?? delTitulo.nombre;
  const key = deRubro?.key ?? slugificar(nombre);
  const legal = d.legal.trim();
  const legales_raw = legal || null;

  const fechas = vigenciaDelLegal(legal);
  const vigencia_desde = fechas.desde ?? fechaDelCatalogo(d.desde);
  const vigencia_hasta = sinFechaComodin(fechas.hasta ?? fechaDelCatalogo(d.hasta));
  // Sin departamento en el catálogo, el que nombra el título ("La Perdiz - Rivera").
  const departamentos = departamentosDe(d.departamento || deptoDelTitulo || "");
  const diasDelCatalogo = diasDe(d.dias.replace(/^custom:/, ""));
  const canal = canalDe(legal);
  // "No se acumula con otras promociones"; "pueden no acumular" no alcanza.
  const acumulable = /no (?:es )?acumulable|no se acumula|no acumula con|no se suma/.test(sinAcentos(legal)) ? false : null;
  const topes = topesDelLegal(legal);
  const frases = frasesDelLegal(legal);

  const desconocidos: string[] = [];
  let leidos: TramoLeido[] = [];
  for (const [i, desc] of d.descuentos.entries()) {
    const r = leerDescuento(desc.pct, desc.texto);
    if (r === null) desconocidos.push(`tramo ${i}: descuento que no se puede leer: ${limpio(`${desc.pct} ${desc.texto}`).slice(0, 120)}`);
    else leidos.push(...r);
  }
  // Fichas cuyo catálogo no trae el porcentaje (Koffee Skates, Old Christians):
  // los tramos salen de las frases de los legales. Si un porcentaje se repite,
  // los legales son de varios comercios (Expo Prado lista los locales del
  // predio): eso es un listado, no un beneficio.
  const repetidos = new Set(frases.map((f) => f.pct)).size < frases.length;
  if (leidos.length === 0 && desconocidos.length === 0 && !repetidos) {
    const vistos = new Set<number>();
    leidos = frases
      .filter((f) => !vistos.has(f.pct) && vistos.add(f.pct))
      .map((f) => ({
        tipo: "porcentaje" as const, porcentaje: f.pct, cuotas: null, hasta: f.hasta,
        // La oración de los legales que lo dice, tal cual.
        raw: legal.split(/(?<=\.)\s+/).find((o) => new RegExp(`\\b${f.pct}\\s*%`).test(o))?.trim() ?? `${f.pct}%`,
        frase: f.tarjetas, sinQue: "",
      }));
  }

  if (leidos.length === 0) {
    // Ni porcentaje ni cuotas en ningún lado: "Solicitá tu TAG gratis",
    // "Accedé a PressReader". No es un descuento en un comercio.
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: desconocidos, es_beneficio: desconocidos.length > 0 ? undefined : false };
  }

  const beneficios: BeneficioNormalizado[] = [];
  for (const [i, t] of leidos.entries()) {
    // Las tarjetas del descuento, más las que los legales nombran para el
    // mismo porcentaje: el catálogo a veces resume ("15% con tarjetas de
    // crédito") lo que los legales dicen entero ("… de crédito y débito").
    let tarjetas = tarjetasDe(t.frase);
    const delLegal = frases.filter((f) => f.pct === t.porcentaje).map((f) => tarjetasDe(f.tarjetas));
    if (tarjetas.nombres.length === 0) {
      // El descuento no nombra tarjetas ("50% en Telepeajes"): las de los
      // legales para ese porcentaje, o las que el legal dice en general.
      const general = tarjetasGeneralesDelLegal(legal);
      if (delLegal.length > 0) {
        tarjetas = {
          ids: delLegal.flatMap((x) => x.ids),
          desconocidos: delLegal.flatMap((x) => x.desconocidos),
          nombres: delLegal.flatMap((x) => x.nombres),
        };
      } else if (general) tarjetas = tarjetasDe(general);
    } else {
      // Solo suman: un nombre de los legales que no mapea no manda la página a
      // revisión si el descuento ya dijo sus tarjetas.
      tarjetas = { ...tarjetas, ids: [...tarjetas.ids, ...delLegal.flatMap((x) => x.ids)] };
    }
    desconocidos.push(...tarjetas.desconocidos);
    let ids = [...new Set(tarjetas.ids)].sort();
    if (tarjetas.nombres.length === 0) {
      // Unas cuotas sin tarjeta nombrada son de las de crédito: sin recargo
      // solo se financia con crédito.
      ids = t.tipo === "cuotas" ? mapearProductos(FUENTE, ["credito"]).ids.sort() : productosPorTipo(FUENTE, t.raw, legales_raw);
    }

    let tope: TopeLeido | null = null;
    if (t.tipo === "porcentaje") {
      const r = topeDelTramo(topes, { pct: t.porcentaje!, ids });
      tope = r.tope;
      if (r.ambiguo) desconocidos.push(`tramo ${i}: los legales publican varios topes y no se puede saber cuál es el de este tramo`);
    }
    const dias = diasDe(t.raw);

    const candidato = {
      comercio_key: key,
      titulo: tituloDe(t),
      descuento_raw: t.raw,
      porcentaje: t.porcentaje,
      cuotas: t.cuotas,
      tipo: t.tipo,
      dias_semana: dias.length > 0 ? dias : diasDelCatalogo,
      vigencia_desde,
      vigencia_hasta,
      departamentos,
      productos_elegibles: ids,
      ...topeDevolucion({
        tipo: t.tipo,
        porcentaje: t.porcentaje,
        tope_monto: tope?.monto ?? null,
        tope_moneda: tope?.moneda ?? null,
        tope_sobre: tope?.sobre ?? null,
        tope_periodo: tope?.periodo ?? null,
      }),
      canal,
      mecanica: [],
      acumulable,
      compra_minima: null,
      requiere_activacion: false,
      legales_raw,
      como_usarlo: [],
      url_fuente: crudo.url_fuente,
    };
    const parsed = BeneficioNormalizadoSchema.safeParse(candidato);
    if (parsed.success) beneficios.push(parsed.data);
    else desconocidos.push(`tramo ${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
  }

  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre, categoria: categoriaDe(d.categoria) } : null,
    beneficios,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}
