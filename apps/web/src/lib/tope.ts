/**
 * Cómo se muestra un tope. El tope es siempre cuánto te devuelven como máximo
 * (un tope de compra ya viene convertido desde el pipeline) y puede estar en
 * pesos o en dólares: "$ 3.700/mes", "US$ 300 por compra".
 *
 * Sin dependencias: lo usan componentes de cliente y el test corre con
 * `node --test` sin resolver alias.
 */

export type MonedaTope = "UYU" | "USD";

/** Lo mínimo de una fila de beneficio para hablar de su tope. */
export interface ConTope {
  tope_monto: number | string | null;
  tope_periodo: string | null;
  /** Ausente o null en filas viejas o consultas sin la columna: son pesos. */
  tope_moneda?: string | null;
}

/**
 * Cotización de referencia para estimar ahorros (Comparar, "cuánto te
 * ahorrás"). Solo sirve para acotar una cuenta aproximada, nunca se muestra.
 */
export const DOLAR_REFERENCIA = 40;

function moneda(m: string | null | undefined): MonedaTope {
  return m === "USD" ? "USD" : "UYU";
}

/** "$ 1.500" o "US$ 300". Hasta dos decimales, solo si los hay. */
export function montoEn(n: number, m: string | null | undefined = "UYU"): string {
  const cifra = n.toLocaleString("es-UY", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  return moneda(m) === "USD" ? `US$ ${cifra}` : `$ ${cifra}`;
}

/** Un monto en pesos: compra mínima, ahorros estimados. */
export const pesos = (n: number) => montoEn(n, "UYU");

const CORTO: Record<string, string> = { dia: "/día", semana: "/semana", mes: "/mes", compra: "/compra", beneficio: " en total" };
const LARGO: Record<string, string> = { dia: "por día", semana: "por semana", mes: "por mes", compra: "por compra", beneficio: "en total" };

/** Para las cards y las filas: "$ 3.700/mes", "US$ 100 en total". Null si no hay tope. */
export function topeCorto(b: ConTope): string | null {
  if (b.tope_monto == null) return null;
  return `${montoEn(Number(b.tope_monto), b.tope_moneda)}${CORTO[b.tope_periodo ?? ""] ?? ""}`;
}

/** Para la ficha: "US$ 300 por compra", "$ 3.700 por mes". Null si no hay tope. */
export function topeLargo(b: ConTope): string | null {
  if (b.tope_monto == null) return null;
  const periodo = LARGO[b.tope_periodo ?? ""];
  return `${montoEn(Number(b.tope_monto), b.tope_moneda)}${periodo ? ` ${periodo}` : ""}`;
}

/** El tope en pesos (los de dólares, a la cotización de referencia), para estimar ahorros. */
export function topeEnPesos(b: ConTope): number | null {
  if (b.tope_monto == null) return null;
  const n = Number(b.tope_monto);
  return moneda(b.tope_moneda) === "USD" ? n * DOLAR_REFERENCIA : n;
}
