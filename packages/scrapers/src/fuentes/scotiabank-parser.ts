import { BeneficioNormalizadoSchema, type BeneficioNormalizado, type Moneda, type TopePeriodo } from "@tarjetazo/core";
import { mapearProductos, productosPorTipo, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { departamentoDeLugar, departamentos as departamentosQueNombra } from "../geo/lugares.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";
import type { DatosScotiabank } from "./scotiabank.js";

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

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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

// ---------------------------------------------------------------- días, departamentos, fechas

const singular = (dia: string) => dia.replace(/(sabado|domingo)s$/, "$1");

/**
 * Días de la semana que nombra un texto: "De lunes a viernes", "Jueves y
 * Domingos", "el primer y último domingo de cada mes" (→ domingo). "Todos los
 * días", o un rango de fechas ("Del 19 al 27 de septiembre"), no restringen.
 * Exportada para los tests.
 */
export function diasDe(texto: string): number[] {
  const t = sinAcentos(texto);
  if (/todos los dias/.test(t)) return [];
  const nombre = "(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)";
  const rango = t.match(new RegExp(`de ${nombre} a ${nombre}`));
  if (rango) {
    const a = DIAS[singular(rango[1]!)]!;
    const b = DIAS[singular(rango[2]!)]!;
    const out: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === b) break;
    }
    return out;
  }
  const sueltos = [...t.matchAll(new RegExp(`\\b${nombre}\\b`, "g"))]
    .map((m) => DIAS[singular(m[1]!)])
    .filter((d): d is number => d !== undefined);
  return [...new Set(sueltos)];
}

/**
 * El campo `departamento` viene libre: "montevideo", "Maldonado,Montevideo",
 * "punta del este", "mercedes", "nacional", "web". Lo que no es un lugar de
 * Uruguay se ignora; si no queda ninguno, todo el país. Exportada para los tests.
 */
export function departamentosDe(campo: string): BeneficioNormalizado["departamentos"] {
  const out = new Set<string>();
  for (const pedazo of campo.split(",")) {
    const d = departamentoDeLugar(pedazo);
    if (d) out.add(d);
  }
  return [...out].sort() as BeneficioNormalizado["departamentos"];
}

/** "2026|-07-01" (así viene alguna) → "2026-07-01"; lo que no es una fecha, null. */
function fechaDelCatalogo(f: string | null): string | null {
  const m = (f ?? "").replace(/[^\d-]/g, "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function iso(anio: string, mes: number, dia: string): string {
  const a = anio.length === 2 ? `20${anio}` : anio;
  return `${a}-${String(mes).padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

/**
 * Fechas concretas de la promoción en los legales, que mandan sobre las del
 * catálogo: "Promoción válida desde el 19/09/2026 al 27/09/2026", "del 1° al
 * 31 de julio de 2023", "válido hasta el 31 de agosto de 2024". Exportada para
 * los tests.
 */
export function vigenciaDelLegal(legal: string): { desde: string | null; hasta: string | null } {
  const t = sinAcentos(legal).replace(/°|º/g, "");
  const num = t.match(/(?:desde|del)\s+(?:el\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(?:al?|hasta(?: el)?)\s+(?:el\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (num) return { desde: iso(num[3]!, Number(num[2]), num[1]!), hasta: iso(num[6]!, Number(num[5]), num[4]!) };
  const mes = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)";
  // "del 1 al 31 de julio de 2023"
  const mismoMes = t.match(new RegExp(`\\bdel\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+${mes}\\s+(?:de\\s+)?(\\d{4})`));
  if (mismoMes) {
    const m = MESES[mismoMes[3]!]!;
    return { desde: iso(mismoMes[4]!, m, mismoMes[1]!), hasta: iso(mismoMes[4]!, m, mismoMes[2]!) };
  }
  // "desde el 3 de julio 2026 al 27 de septiembre 2026"
  const dosMeses = t.match(new RegExp(`(?:desde|del)\\s+(?:el\\s+)?(\\d{1,2})\\s+de\\s+${mes}\\s+(?:de\\s+)?(\\d{4})\\s+(?:al?|hasta(?: el)?)\\s+(?:el\\s+)?(\\d{1,2})\\s+de\\s+${mes}\\s+(?:de\\s+)?(\\d{4})`));
  if (dosMeses) {
    return {
      desde: iso(dosMeses[3]!, MESES[dosMeses[2]!]!, dosMeses[1]!),
      hasta: iso(dosMeses[6]!, MESES[dosMeses[5]!]!, dosMeses[4]!),
    };
  }
  const hasta = t.match(new RegExp(`(?:valid[ao]|vigente)\\s+hasta\\s+el\\s+(\\d{1,2})\\s+de\\s+${mes}\\s+(?:de\\s+)?(\\d{4})`));
  if (hasta) return { desde: null, hasta: iso(hasta[3]!, MESES[hasta[2]!]!, hasta[1]!) };
  return { desde: null, hasta: null };
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

// ---------------------------------------------------------------- topes

/** Un tope como lo publica el legal, antes de pasarlo a devolución. */
export interface TopeLeido {
  monto: number;
  moneda: Moneda;
  sobre: "compra" | "devolucion";
  periodo: TopePeriodo | null;
  /** "Tope máximo de devolución del 15%", "para descuentos del 25%". */
  pct: number | null;
  /** "para tarjetas Platinum, Infinite, Gold y Débito Premium $2500". */
  tarjetas: string[] | null;
  /**
   * Porcentajes que el legal nombró entre el tope anterior y este: "15% … con
   * tope de $5.250 y 25% … con tope de $8.750". Vacío = el tope no dice de qué
   * tramo es.
   */
  pctsAnteriores: number[];
}

const MONTO = /(u\$d|u\$s|us\$|usd|\$)\s*(\d{1,3}(?:\.\d{3})+|\d+)/g;

/** Hasta el fin de la oración: un punto seguido de espacio y mayúscula, o de un salto de línea. */
function finDeOracion(legal: string, desde: number): number {
  const resto = legal.slice(desde);
  const m = resto.match(/\.(?:-)?(?=\s+[A-ZÁÉÍÓÚ¿"“-]|\s*\n|\s*$)|\n/);
  return m ? desde + m.index! : legal.length;
}

const ORDEN_PERIODO: Record<string, number> = { compra: 0, dia: 1, semana: 2, mes: 3, beneficio: 4 };

/**
 * Los topes de los legales: monto, moneda, si es de compra o de devolución, el
 * período y, si lo dice, a qué porcentaje o a qué tarjetas corresponde.
 *
 * - "Tope de compra $15.000", "Tope de factura o compra para obtener el
 *   descuento", "tope máximo de compra para tener el descuento" → compra.
 * - "Tope de descuento/devolución …", "Tope por mes y por cuenta de $5000" →
 *   devolución.
 * - "Tope de $10.000 por compra" no dice de qué es: se lee literal, como tope
 *   del descuento por compra (igual que el modelo).
 * - Período: "por día"; "por mes", "mensual"; "por compra"; "por cuenta y
 *   promoción", "por única vez", "por cuenta" → beneficio. Sin período, un tope
 *   de compra es por compra, y uno de devolución también si el descuento se
 *   hace en el momento de la compra (si se acredita después no se sabe).
 * - Moneda: USD, U$S, US$ o U$D; si no, pesos.
 *
 * Exportada para los tests.
 */
export function topesDelLegal(legal: string): TopeLeido[] {
  const t = sinAcentos(legal);
  const alMomento = /(al|en el) momento/.test(t);
  const porcentajes = [...t.matchAll(/(\d{1,2})\s*%/g)].map((m) => ({ pct: Number(m[1]), indice: m.index! }));
  const inicios = [...t.matchAll(/\btope\b/g)].map((m) => m.index!);
  const out: TopeLeido[] = [];
  let finAnterior = 0;
  for (const [n, inicio] of inicios.entries()) {
    // La oración del tope, cortada donde empieza el siguiente tope.
    const fin = Math.min(finDeOracion(legal, inicio), inicios[n + 1] ?? Infinity);
    const oracion = t.slice(inicio, fin);
    const montos = [...oracion.matchAll(MONTO)];
    if (montos.length === 0) continue;

    const antes = oracion.slice(0, montos[0]!.index!);
    const tipo = antes.match(/^tope\s+(?:maximo\s+)?(?:de\s+)?(compra|factura|descuento|devolucion|reintegro)/)?.[1];
    const sobre: "compra" | "devolucion" =
      tipo === "compra" || tipo === "factura" || (!tipo && /tope de compra|compra para (obtener|efectuar|realizar|aplicar|tener)/.test(antes))
        ? "compra"
        : "devolucion";
    const periodo: TopePeriodo | null = /por dia\b|diari/.test(oracion)
      ? "dia"
      : /por mes\b|mensual|por cierre/.test(oracion)
        ? "mes"
        : /por c(?:om|o)pra\b|por factura/.test(oracion)
          ? "compra"
          : /por cuenta y (?:por )?promocion|por unica vez|toda la vigencia|por promocion|por cuenta\b/.test(oracion)
            ? "beneficio"
            // Sin período escrito ("Tope de descuento: $3.000"), por compra:
            // lo mismo que guardaba el modelo, y la base exige un período.
            : "compra";
    const pctsAnteriores = [
      ...new Set(porcentajes.filter((p) => p.indice >= finAnterior && p.indice < inicio).map((p) => p.pct)),
    ];
    // Lo que viene después del último monto leído ya es del próximo tope.
    finAnterior = inicio + montos[0]!.index! + montos[0]![0].length;

    for (const [k, mm] of montos.entries()) {
      // Cada monto con su pedazo: del monto anterior a este, y de este al siguiente.
      const desde = k === 0 ? 0 : montos[k - 1]!.index! + montos[k - 1]![0].length;
      const hasta = k + 1 < montos.length ? montos[k + 1]!.index! : oracion.length;
      const previo = oracion.slice(desde, mm.index!);
      const siguiente = oracion.slice(mm.index! + mm[0].length, hasta);
      // "… $1500 para descuentos del 15%", "Tope máximo de devolución del 25%: $2.500",
      // "tope … para el 15% es de $1.800 … y para el 25% de $5.000".
      const pct =
        siguiente.match(/^[^$]*?para (?:los )?descuentos? del (\d{1,2})\s*%/)?.[1] ??
        previo.match(/(?:del|para el)\s+(\d{1,2})\s*%(?:\s+es)?(?:\s+de)?\s*:?\s*$/)?.[1];
      const tarjetas = previo.match(/para (tarjetas?\b[^$]*?)\s*$/)?.[1];
      out.push({
        monto: Number(mm[2]!.replace(/\./g, "")),
        moneda: mm[1] === "$" ? "UYU" : "USD",
        sobre,
        periodo,
        pct: pct ? Number(pct) : null,
        tarjetas: tarjetas ? tarjetasDe(tarjetas).ids : null,
        pctsAnteriores,
      });
      // Un monto seguido de otro sin "y para …" es un paréntesis o un
      // equivalente ("USD 2.000 o su equivalente"): con el primero alcanza.
      finAnterior = inicio + mm.index! + mm[0].length;
      if (!/\by\s+(para|\$)|\by\s*$/.test(siguiente) && !/para (?:los )?descuentos? del/.test(siguiente)) break;
    }
  }
  return out;
}

const claveTope = (t: TopeLeido) => `${t.monto}|${t.moneda}|${t.sobre}|${t.periodo}`;

/**
 * El tope de un tramo. Con un solo tope (o todos iguales) vale para todos los
 * de porcentaje. Con varios distintos, al tramo le tocan los que lo nombran
 * (por porcentaje, por tarjetas o porque el legal dijo su porcentaje justo
 * antes) más los que no nombran a nadie; de esos, el más chico en el tiempo
 * (el de la compra antes que el mensual). Dos del mismo período con montos
 * distintos (La Pasiva publica uno por local) no se pueden elegir: `null` y
 * `ambiguo`, que manda la página a revisión.
 */
function topeDelTramo(
  topes: TopeLeido[],
  tramo: { pct: number; ids: string[] },
): { tope: TopeLeido | null; ambiguo: boolean } {
  if (topes.length === 0) return { tope: null, ambiguo: false };
  if (new Set(topes.map(claveTope)).size === 1) return { tope: topes[0]!, ambiguo: false };

  const ids = [...tramo.ids].sort().join(",");
  const lo = (t: TopeLeido) =>
    t.pct === tramo.pct ||
    (t.tarjetas !== null && [...t.tarjetas].sort().join(",") === ids) ||
    (t.pct === null && t.tarjetas === null && t.pctsAnteriores.includes(tramo.pct));
  const general = (t: TopeLeido) => t.pct === null && t.tarjetas === null && t.pctsAnteriores.length === 0;
  const candidatos = topes.filter((t) => lo(t) || general(t));
  if (candidatos.length === 0) return { tope: null, ambiguo: false };

  const orden = [...candidatos].sort(
    (a, b) => (ORDEN_PERIODO[a.periodo ?? ""] ?? 5) - (ORDEN_PERIODO[b.periodo ?? ""] ?? 5),
  );
  const primero = orden[0]!;
  const empate = orden.some((t) => t.periodo === primero.periodo && claveTope(t) !== claveTope(primero));
  return empate ? { tope: null, ambiguo: true } : { tope: primero, ambiguo: false };
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
  if (t.tipo === "2x1") return "2x1";
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
  const { nombre, departamento: deptoDelTitulo } = comercioDelTitulo(limpio(d.titulo));
  const key = slugificar(nombre);
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
