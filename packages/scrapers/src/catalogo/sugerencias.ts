import { FAMILIAS, familiaDe, PRODUCTOS } from "@tarjetazo/core";
import type { TarjetaVista } from "./extraer.js";

/** Campos de la ficha que salen de la página oficial (decisión del grill). */
export const CAMPOS = [
  "costo_anual", "costo_moneda", "costo_bonificado", "ingreso_minimo", "requisitos", "tasa_tea",
  "programa", "seguros", "salas_vip", "link_solicitud", "otros",
] as const;
export type Campo = (typeof CAMPOS)[number] | "imagen";

/** Palabras que no alcanzan para elegir familia, pero sí para desempatar. */
const DEBILES = ["internacional"];
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const VACIAS = new Set(["tarjeta", "tarjetas", "de", "del", "la", "el", "credito", "debito", "internacional", "visa", "mastercard", "master", "santander", "brou", "bbva", "soy", "y", "con"]);
const tokens = (s: string) =>
  new Set(
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !VACIAS.has(t)),
  );

/**
 * A qué familia del catálogo en código corresponde una tarjeta vista. Primero
 * por plástico (instrumento, red, tier); si hay varias familias posibles (la
 * Visa Infinite de Santander está en tres packs), por palabras del nombre.
 * Null = no está en el catálogo: sugerencia de alta.
 */
export function familiaPara(fuenteId: string, t: TarjetaVista): string | null {
  const tier = t.tier === "clasica" ? null : t.tier;
  const candidatos = PRODUCTOS.filter(
    (p) =>
      p.fuente_id === fuenteId &&
      p.activo !== false &&
      p.instrumento === t.instrumento &&
      (t.red === "otra" || p.red === t.red) &&
      (p.tier ?? null) === tier,
  );
  const familias = [...new Set(candidatos.map(familiaDe))];
  if (familias.length === 1) return familias[0]!;
  if (familias.length === 0) return null;
  const vistos = tokens(t.nombre);
  // El nombre de la familia pesa doble que los de sus plásticos: el débito
  // del pack AAdvantage se llama "Débito Select AAdvantage" y no es el Select.
  const coincidencias = (texto: string) => [...tokens(texto)].filter((x) => vistos.has(x)).length;
  const textoDe = (fid: string) => {
    const f = FAMILIAS.find((x) => x.id === fid);
    return { nombre: f?.nombre ?? "", plasticos: (f?.productos ?? []).map((p) => p.nombre).join(" ") };
  };
  const puntaje = (fid: string) => {
    const { nombre, plasticos } = textoDe(fid);
    return 2 * coincidencias(nombre) + coincidencias(plasticos);
  };
  // Solo desempata: "Mastercard Internacional" de BBVA no tiene otra palabra
  // que la distinga de Sodimac o Comunidad Plus. No suma al puntaje porque en
  // Santander "Internacional" está en varias familias.
  const debil = (fid: string) => {
    const { nombre, plasticos } = textoDe(fid);
    const texto = sinAcentos(`${nombre} ${plasticos}`);
    return DEBILES.filter((d) => sinAcentos(t.nombre).includes(d) && texto.includes(d)).length;
  };
  // Último desempate: palabras propias de la familia que no aparecen en lo
  // visto. "BROU Visa Débito" es la Visa Débito y no MI BROU Tarjeta Joven,
  // aunque las dos sean Visa de débito.
  const ajenas = (fid: string) => {
    const { nombre, plasticos } = textoDe(fid);
    return [...tokens(`${nombre} ${plasticos}`)].filter((x) => !vistos.has(x)).length;
  };
  const orden = familias
    .map((f) => [f, puntaje(f), debil(f), ajenas(f)] as const)
    .sort((a, b) => b[1] - a[1] || b[2] - a[2] || a[3] - b[3]);
  const [primera, segunda] = orden;
  const [, p1, d1, a1] = primera!;
  const gana =
    !segunda ||
    p1 > segunda[1] ||
    (p1 === segunda[1] && (d1 > segunda[2] || (d1 === segunda[2] && a1 < segunda[3])));
  // Sin ninguna palabra en común, solo si la familia no tiene palabras propias.
  return gana && (p1 + d1 > 0 || a1 === 0) ? primera![0] : null;
}

/** Lo que el scraper vio de una familia, juntando las tarjetas de un pack. */
export function juntar(tarjetas: TarjetaVista[]): TarjetaVista {
  const [primera, ...resto] = tarjetas;
  const out = { ...primera! };
  for (const t of resto) {
    for (const k of Object.keys(t) as (keyof TarjetaVista)[]) {
      const a = out[k];
      const b = t[k];
      if (Array.isArray(a) && Array.isArray(b)) (out as Record<string, unknown>)[k] = [...new Set([...a, ...b])];
      else if (a === null || a === undefined) (out as Record<string, unknown>)[k] = b;
    }
  }
  return out;
}

export type Ficha = Partial<Record<(typeof CAMPOS)[number], unknown>> & { imagen_origen?: string | null };

export type Sugerencia = {
  fuente_id: string;
  familia_id: string | null;
  tipo: "campo" | "alta";
  campo: Campo | null;
  valor: unknown;
  valor_actual: unknown;
  nombre_visto: string;
  url: string;
  /** Solo en una foto: dónde quedó guardada en Storage (`_sugeridas/…`). */
  archivo?: string | null;
};

const vacio = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const igual = (a: unknown, b: unknown) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a ?? null) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b ?? null) ||
  // 1308 y "1308.00" (numeric de Postgres) son el mismo número; 0 y null no:
  // una tarjeta sin costo no es una tarjeta sin dato.
  (a != null && b != null && (typeof a === "number" || typeof b === "number") ? Number(a) === Number(b) : false);

/** Sugerencias para una familia vista: un campo por diferencia con la ficha actual. */
export function sugerenciasDeFamilia(
  fuenteId: string,
  familiaId: string,
  t: TarjetaVista,
  ficha: Ficha | null,
  url: string,
): Sugerencia[] {
  const out: Sugerencia[] = [];
  for (const campo of CAMPOS) {
    const valor = t[campo];
    if (vacio(valor)) continue; // el banco no lo dice: no se sugiere borrar
    const actual = ficha?.[campo] ?? null;
    if (!igual(valor, actual)) {
      out.push({ fuente_id: fuenteId, familia_id: familiaId, tipo: "campo", campo, valor, valor_actual: actual, nombre_visto: t.nombre, url });
    }
  }
  if (t.imagen && t.imagen !== (ficha?.imagen_origen ?? null)) {
    out.push({ fuente_id: fuenteId, familia_id: familiaId, tipo: "campo", campo: "imagen", valor: t.imagen, valor_actual: ficha?.imagen_origen ?? null, nombre_visto: t.nombre, url });
  }
  return out;
}

/**
 * Qué hacer con una sugerencia nueva frente a las que ya existen: repetir una
 * ignorada con el mismo valor no se hace; una pendiente del mismo campo se
 * reemplaza si el valor cambió.
 */
export function clave(s: Pick<Sugerencia, "fuente_id" | "familia_id" | "tipo" | "campo" | "nombre_visto">): string {
  return s.tipo === "alta" ? `alta|${s.fuente_id}|${s.nombre_visto.toLowerCase()}` : `campo|${s.familia_id}|${s.campo}`;
}
