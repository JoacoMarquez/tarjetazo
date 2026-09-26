import type { Punto } from "./tipos.js";

/**
 * Pines para las fuentes que publican la dirección escrita pero no el punto
 * (Club El País). El geocodificador oficial devuelve "exacta" aunque haya
 * elegido otra calle ("Punta Carretas - Local 136" → "La Carreta 1602") o
 * un número a kilómetros: un pin equivocado es peor que ninguno, así que solo
 * se acepta cuando la calle devuelta es la pedida y el número está cerca.
 */

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras que no identifican la calle: títulos, tipos de vía, conectores. */
const RELLENO = new Set([
  "av", "avda", "avenida", "bv", "bvar", "bulevar", "boulevard", "rbla", "rambla", "calle", "camino",
  "dr", "doctor", "ing", "ingeniero", "gral", "general", "cnel", "coronel", "prof", "profesor", "pte", "presidente",
  "de", "del", "la", "las", "los", "el", "y", "e", "n", "no", "nro", "numero", "bis",
]);

/**
 * Lo que se le pregunta al geocodificador: sin esquinas, locales ni pisos
 * ("Pesaro 2917 Esq. Madreselva" → "Pesaro 2917"). Null si no hay una calle
 * con número, o si es una ruta o un kilómetro: ahí no hay número de puerta.
 */
export function limpiarDireccion(direccion: string): string | null {
  const d = direccion
    .replace(/\s+(esq\.?|esquina)\s+.*$/i, "")
    .replace(/[-–,]?\s*\b(local|loc\.?|piso|nivel|apto\.?|of\.?|oficina)\s*[\w.]+/gi, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(ruta|km)\b/i.test(d)) return null;
  if (!/[a-záéíóúñ]{3,}.*\s\d{1,5}\b/i.test(d)) return null;
  return d;
}

function calleYNumero(texto: string): { palabras: string[]; numero: number | null } {
  const t = sinAcentos(texto.split(",")[0]!);
  const numero = t.match(/\b(\d{1,5})\b(?!.*\b\d{1,5}\b)/)?.[1];
  const palabras = t
    .replace(/\d+/g, " ")
    .split(/[^a-z]+/)
    .filter((p) => p.length > 1 && !RELLENO.has(p));
  return { palabras, numero: numero ? Number(numero) : null };
}

/**
 * ¿El punto es de la dirección pedida? Todas las palabras de la calle pedida
 * tienen que estar en la devuelta ("Solano García" ⊂ "FRANCISCO SOLANO
 * GARCIA"), y el número a 50 o menos (la numeración uruguaya es en metros).
 */
export function mismaDireccion(pedida: string, devuelta: string | null): boolean {
  if (!devuelta) return false;
  const a = calleYNumero(pedida);
  const b = calleYNumero(devuelta);
  if (a.palabras.length === 0 || a.numero === null || b.numero === null) return false;
  if (!a.palabras.every((p) => b.palabras.includes(p))) return false;
  return Math.abs(a.numero - b.numero) <= 50;
}

/** El pin se guarda solo si es a la puerta y es la dirección pedida. */
export function puntoConfiable(pedida: string, p: Punto | null): p is Punto {
  return p !== null && p.precision === "exacta" && mismaDireccion(pedida, p.direccion_normalizada);
}
