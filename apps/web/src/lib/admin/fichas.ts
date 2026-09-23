/**
 * Fichas de tarjeta (#26): una por familia en `producto_ficha`, la escribe solo
 * el operador (aceptando una sugerencia del scraper de catálogo o editando).
 * Sin `server-only`: el formulario usa las etiquetas y la URL de las fotos.
 */
import { origenSupabase } from "@tarjetazo/core";

export type TipoCampo = "numero" | "moneda" | "texto" | "lista" | "url";

/** Campos editables, en el orden del formulario. Mismos que `CAMPOS` del scraper. */
export const CAMPOS_FICHA = [
  { campo: "costo_anual", etiqueta: "Costo anual", tipo: "numero" },
  { campo: "costo_moneda", etiqueta: "Moneda del costo", tipo: "moneda" },
  { campo: "costo_bonificado", etiqueta: "Costo bonificado", tipo: "texto", ayuda: "Cuándo es gratis o más barata." },
  { campo: "ingreso_minimo", etiqueta: "Ingreso mínimo (pesos)", tipo: "numero" },
  { campo: "tasa_tea", etiqueta: "Tasa (TEA %)", tipo: "numero" },
  { campo: "programa", etiqueta: "Puntos o millas", tipo: "texto" },
  { campo: "salas_vip", etiqueta: "Salas VIP", tipo: "texto" },
  { campo: "link_solicitud", etiqueta: "Link de solicitud", tipo: "url" },
  { campo: "requisitos", etiqueta: "Requisitos", tipo: "lista", ayuda: "Uno por línea." },
  { campo: "seguros", etiqueta: "Seguros", tipo: "lista", ayuda: "Uno por línea." },
  { campo: "otros", etiqueta: "Otros", tipo: "lista", ayuda: "Uno por línea." },
] as const satisfies readonly { campo: string; etiqueta: string; tipo: TipoCampo; ayuda?: string }[];

export type CampoFicha = (typeof CAMPOS_FICHA)[number]["campo"];
export const MONEDAS = ["UYU", "UI", "USD"] as const;
export const NOMBRE_MONEDA: Record<string, string> = { UYU: "pesos", UI: "UI", USD: "dólares" };

const POR_CAMPO = new Map<string, (typeof CAMPOS_FICHA)[number]>(CAMPOS_FICHA.map((c) => [c.campo, c]));

export function etiquetaDe(campo: string): string {
  return campo === "imagen" ? "Foto (frente)" : (POR_CAMPO.get(campo)?.etiqueta ?? campo);
}

export type Ficha = {
  familia_id: string;
  fuente_id: string;
  costo_anual: number | null;
  costo_moneda: (typeof MONEDAS)[number] | null;
  costo_bonificado: string | null;
  ingreso_minimo: number | null;
  requisitos: string[];
  tasa_tea: number | null;
  programa: string | null;
  seguros: string[];
  salas_vip: string | null;
  link_solicitud: string | null;
  otros: string[];
  imagen_frente: string | null;
  imagen_dorso: string | null;
  imagen_origen: string | null;
  url_oficial: string | null;
  actualizado_en: string;
};

export const COLUMNAS_FICHA =
  "familia_id, fuente_id, costo_anual, costo_moneda, costo_bonificado, ingreso_minimo, requisitos, tasa_tea, programa, seguros, salas_vip, link_solicitud, otros, imagen_frente, imagen_dorso, imagen_origen, url_oficial, actualizado_en";

export type Sugerencia = {
  id: string;
  fuente_id: string;
  familia_id: string | null;
  tipo: "campo" | "alta";
  campo: string | null;
  valor: unknown;
  valor_actual: unknown;
  nombre_visto: string;
  url: string;
  creada_en: string;
};

export const COLUMNAS_SUGERENCIA =
  "id, fuente_id, familia_id, tipo, campo, valor, valor_actual, nombre_visto, url, creada_en";

export type EstadoFicha = { error?: string; ok?: string; errores?: Record<string, string> };

const vacio = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Qué tan completa está una ficha: cada campo cuenta uno (la moneda va con el
 * costo) y la foto de frente cuenta otro. El dorso es opcional.
 */
export function completitud(f: Ficha | null | undefined): { llenos: number; total: number } {
  const campos = CAMPOS_FICHA.filter((c) => c.campo !== "costo_moneda");
  const total = campos.length + 1;
  if (!f) return { llenos: 0, total };
  const llenos =
    campos.filter((c) => !vacio(f[c.campo])).length + (f.imagen_frente ? 1 : 0);
  return { llenos, total };
}

/** URL pública de una foto guardada en el bucket `tarjetas`. */
export function urlImagen(ruta: string | null | undefined): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!ruta || !url) return null;
  return `${origenSupabase(url)}/storage/v1/object/public/tarjetas/${ruta}`;
}

/** Un valor de la ficha (o de una sugerencia) como texto para mostrar. */
export function mostrar(campo: string, v: unknown): string | string[] {
  if (vacio(v)) return "—";
  if (Array.isArray(v)) return v.map(String);
  if (campo === "costo_moneda") return NOMBRE_MONEDA[String(v)] ?? String(v);
  if (typeof v === "number") return v.toLocaleString("es-UY");
  return String(v);
}

/**
 * Número escrito a la uruguaya o a la inglesa: "1.308", "1.308,50", "65,5",
 * "65.5". Un punto seguido de exactamente tres dígitos es de miles.
 */
export function leerNumero(s: string): number | null | "invalido" {
  const t = s.trim().replace(/\s|\$|U\$S|%/gi, "");
  if (t === "") return null;
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : "invalido";
}

function esUrl(s: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

/**
 * El valor de una sugerencia (jsonb, lo que devolvió el modelo) convertido al
 * tipo de su columna. Si no encaja no se escribe: mejor una sugerencia que
 * queda pendiente que una ficha con basura.
 */
export function valorDeSugerencia(
  campo: string,
  valor: unknown,
): { ok: true; valor: unknown } | { ok: false; error: string } {
  const def = POR_CAMPO.get(campo);
  if (!def) return { ok: false, error: `campo desconocido: ${campo}` };
  switch (def.tipo) {
    case "numero": {
      const n = typeof valor === "number" ? valor : leerNumero(String(valor ?? ""));
      return typeof n === "number" && n >= 0 ? { ok: true, valor: n } : { ok: false, error: "no es un número" };
    }
    case "moneda":
      return MONEDAS.includes(valor as never) ? { ok: true, valor } : { ok: false, error: "moneda desconocida" };
    case "lista":
      return Array.isArray(valor) && valor.every((x) => typeof x === "string")
        ? { ok: true, valor: valor.map((x) => x.trim()).filter(Boolean) }
        : { ok: false, error: "no es una lista de textos" };
    case "url":
      return typeof valor === "string" && esUrl(valor) ? { ok: true, valor } : { ok: false, error: "no es una URL" };
    case "texto":
      return typeof valor === "string" && valor.trim() ? { ok: true, valor: valor.trim() } : { ok: false, error: "texto vacío" };
  }
}

/** Lee y valida los campos del formulario de edición. */
export function leerFormularioFicha(form: FormData): {
  fila: Record<CampoFicha, unknown> | null;
  errores: Record<string, string>;
} {
  const errores: Record<string, string> = {};
  const fila = {} as Record<CampoFicha, unknown>;
  for (const c of CAMPOS_FICHA) {
    const crudo = String(form.get(c.campo) ?? "");
    switch (c.tipo) {
      case "numero": {
        const n = leerNumero(crudo);
        if (n === "invalido") errores[c.campo] = "Tiene que ser un número.";
        else fila[c.campo] = n;
        break;
      }
      case "moneda":
        if (crudo && !MONEDAS.includes(crudo as never)) errores[c.campo] = "Moneda desconocida.";
        else fila[c.campo] = crudo || null;
        break;
      case "lista":
        fila[c.campo] = crudo.split("\n").map((l) => l.trim()).filter(Boolean);
        break;
      case "url":
        if (crudo.trim() && !esUrl(crudo.trim())) errores[c.campo] = "Tiene que empezar con https://";
        else fila[c.campo] = crudo.trim() || null;
        break;
      case "texto":
        fila[c.campo] = crudo.trim() || null;
        break;
    }
  }
  if (fila.costo_anual != null && !fila.costo_moneda) errores.costo_moneda = "Falta la moneda del costo.";
  return Object.keys(errores).length > 0 ? { fila: null, errores } : { fila, errores };
}

/** Lo que trae una sugerencia de alta (la tarjeta entera, según el modelo). */
export type Alta = {
  nombre?: string;
  red?: string;
  tier?: string;
  instrumento?: string;
  imagen?: string | null;
};

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * La línea para pegar en `PRODUCTOS` (packages/core/src/fuentes.ts): el
 * catálogo vive en código, así que una tarjeta nueva entra con un PR.
 */
export function lineaProducto(fuenteId: string, nombreFuente: string, alta: Alta, url: string): string {
  const nombre = alta.nombre ?? "";
  const resto = slug(nombre).split("-").filter((t) => t && t !== fuenteId).join("-");
  const tier = !alta.tier || alta.tier === "clasica" ? "null" : JSON.stringify(alta.tier);
  const red = alta.red === "otra" || !alta.red ? "propia" : alta.red;
  const conFuente = nombre.toLowerCase().includes(nombreFuente.toLowerCase()) ? nombre : `${nombre} ${nombreFuente}`;
  return `{ id: "${fuenteId}-${resto}", fuente_id: "${fuenteId}", nombre: ${JSON.stringify(conFuente)}, instrumento: "${alta.instrumento ?? "credito"}", red: "${red}", tier: ${tier}, url_oficial: ${JSON.stringify(url)} },`;
}
