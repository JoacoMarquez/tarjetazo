import type { BeneficioNormalizado, Moneda, TopePeriodo } from "@tarjetazo/core";
import { departamentoDeLugar } from "../geo/lugares.js";

/**
 * Lectura de legales y campos libres que comparten los parsers propios
 * (Scotiabank, Itaú): días de la semana, departamentos, fechas concretas de la
 * promo y topes. Todo es determinista y conservador: lo que no se entiende
 * queda en null o se informa como ambiguo, nunca se adivina.
 */

export const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

export const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

export function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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

const DIA_SINGULAR = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIA_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

/**
 * Los días para el título: [1, 3] → " los lunes y miércoles"; tres o más
 * seguidos, " de lunes a miércoles"; todos los días (vacío), nada.
 */
export function diasEnTitulo(dias: number[]): string {
  if (dias.length === 0 || dias.length === 7) return "";
  const seguidos = dias.length >= 3 && dias.every((d, i) => i === 0 || d === (dias[i - 1]! + 1) % 7);
  if (seguidos) return ` de ${DIA_SINGULAR[dias[0]!]} a ${DIA_SINGULAR[dias.at(-1)!]}`;
  const n = dias.map((d) => DIA_PLURAL[d]!);
  return ` los ${n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} y ${n.at(-1)}`}`;
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

export function iso(anio: string, mes: number, dia: string): string {
  const a = anio.length === 2 ? `20${anio}` : anio;
  return `${a}-${String(mes).padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

/**
 * Fechas concretas de la promoción en los legales, que mandan sobre las del
 * catálogo: "Promoción válida desde el 19/09/2026 al 27/09/2026", "Vigencia de
 * la campaña: 1/09/26 al 30/09/26", "del 1° al 31 de julio de 2023", "Del 1 de
 * setiembre 2026 al 30 de setiembre del 2026", "del 1° de julio al 15 de
 * agosto de 2019", "válido hasta el 31 de agosto de 2024", "Campaña vigente
 * hasta el 01/12/2026". Un rango sin año ("desde el 1 de junio al 30 de
 * setiembre") toma el año solo si el texto nombra uno y uno solo.
 */
export function vigenciaDelLegal(legal: string): { desde: string | null; hasta: string | null } {
  const t = sinAcentos(legal).replace(/°|º/g, "").replace(/\s+/g, " ");
  const num = t.match(/(?:desde|del|:)\s*(?:el\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(?:al?|hasta(?: el)?)\s+(?:el\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (num) return { desde: iso(num[3]!, Number(num[2]), num[1]!), hasta: iso(num[6]!, Number(num[5]), num[4]!) };
  const mes = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)";
  const anio = "(?:del?\\s+)?(\\d{4})";
  const hastaEl = "(?:al?|hasta(?: el)?)\\s+(?:el\\s+)?";
  // "del 1 al 31 de julio de 2023"
  const mismoMes = t.match(new RegExp(`\\bdel\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+${mes}\\s+${anio}`));
  if (mismoMes) {
    const m = MESES[mismoMes[3]!]!;
    return { desde: iso(mismoMes[4]!, m, mismoMes[1]!), hasta: iso(mismoMes[4]!, m, mismoMes[2]!) };
  }
  const desde = `(?:desde|del)\\s+(?:el\\s+)?(\\d{1,2})\\s+de\\s+${mes}`;
  // "desde el 3 de julio 2026 al 27 de septiembre 2026", "Del 1 de setiembre 2026 al 30 de setiembre del 2026"
  const dosMeses = t.match(new RegExp(`${desde}\\s+${anio}\\s+${hastaEl}(\\d{1,2})\\s+de\\s+${mes}\\s+${anio}`));
  if (dosMeses) {
    return {
      desde: iso(dosMeses[3]!, MESES[dosMeses[2]!]!, dosMeses[1]!),
      hasta: iso(dosMeses[6]!, MESES[dosMeses[5]!]!, dosMeses[4]!),
    };
  }
  // "del 1 de julio al 15 de agosto de 2019": el año solo al final, vale para las dos.
  const unAnio = t.match(new RegExp(`${desde}\\s+${hastaEl}(\\d{1,2})\\s+de\\s+${mes}\\s+${anio}`));
  if (unAnio) {
    return {
      desde: iso(unAnio[5]!, MESES[unAnio[2]!]!, unAnio[1]!),
      hasta: iso(unAnio[5]!, MESES[unAnio[4]!]!, unAnio[3]!),
    };
  }
  // "desde el 1 de junio al 30 de setiembre", sin año: el único que nombre el texto.
  const sinAnio = t.match(new RegExp(`${desde}\\s+${hastaEl}(\\d{1,2})\\s+de\\s+${mes}\\b`));
  const anios = [...new Set(t.match(/\b20\d{2}\b/g) ?? [])];
  if (sinAnio && anios.length === 1) {
    return {
      desde: iso(anios[0]!, MESES[sinAnio[2]!]!, sinAnio[1]!),
      hasta: iso(anios[0]!, MESES[sinAnio[4]!]!, sinAnio[3]!),
    };
  }
  const hasta = t.match(new RegExp(`(?:valid[ao]|vigente)\\s+hasta\\s+el\\s+(\\d{1,2})\\s+de\\s+${mes}\\s+${anio}`));
  if (hasta) return { desde: null, hasta: iso(hasta[3]!, MESES[hasta[2]!]!, hasta[1]!) };
  const hastaNum = t.match(/(?:valid[ao]|vigente)\s+hasta\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (hastaNum) return { desde: null, hasta: iso(hastaNum[3]!, Number(hastaNum[2]), hastaNum[1]!) };
  return { desde: null, hasta: null };
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

export const MONTO = /(u\$d|u\$s|us\$|usd|\$)\s*(\d{1,3}(?:\.\d{3})+|\d+)/g;

/** Hasta el fin de la oración: un punto seguido de espacio y mayúscula, o de un salto de línea. */
export function finDeOracion(legal: string, desde: number): number {
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
 *   promoción", "por única vez", "por cuenta" → beneficio. Sin período escrito,
 *   por compra (lo que guardaba el modelo; la base exige un período).
 * - Moneda: USD, U$S, US$ o U$D; si no, pesos.
 *
 * `tarjetasDe` pasa a ids las tarjetas de "para tarjetas X $2500": cada
 * fuente tiene su mapeo.
 */
export function topesDelLegal(legal: string, tarjetasDe: (frase: string) => string[] = () => []): TopeLeido[] {
  const t = sinAcentos(legal);
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
        tarjetas: tarjetas ? tarjetasDe(tarjetas) : null,
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

export const claveTope = (t: TopeLeido) => `${t.monto}|${t.moneda}|${t.sobre}|${t.periodo}`;

/**
 * El tope de un tramo. Con un solo tope (o todos iguales) vale para todos los
 * de porcentaje. Con varios distintos, al tramo le tocan los que lo nombran
 * (por porcentaje, por tarjetas o porque el legal dijo su porcentaje justo
 * antes) más los que no nombran a nadie; de esos, el más chico en el tiempo
 * (el de la compra antes que el mensual). Dos del mismo período con montos
 * distintos (La Pasiva publica uno por local) no se pueden elegir: `null` y
 * `ambiguo`, que manda la página a revisión.
 */
export function topeDelTramo(
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
