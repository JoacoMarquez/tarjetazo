import { BeneficioSchema, FUENTES, PRODUCTOS } from "@tarjetazo/core";

/**
 * Carga manual de beneficios (#23): lo que ninguna fuente scrapeada publica.
 * Pasa por el mismo schema Zod que el pipeline. Lógica pura: las escrituras
 * viven en las actions.
 */

export const DIAS_DEFAULT = 60;

export type EstadoFormulario = { error?: string; errores?: Record<string, string> };

export type ValoresManual = {
  id?: string;
  fuente_id: string;
  comercio: string;
  categoria: string;
  titulo: string;
  descuento_raw: string;
  tipo: "porcentaje" | "cuotas" | "reintegro" | "2x1";
  porcentaje: string;
  cuotas: string;
  dias_semana: number[];
  productos_elegibles: string[];
  vigencia_desde: string;
  vigencia_hasta: string;
  tope_monto: string;
  tope_periodo: string;
  canal: "presencial" | "online" | "ambos";
  url_fuente: string;
  nota_manual: string;
};

/** "2026-11-22" en Uruguay, `dias` días desde hoy. */
export function fechaUy(dias = 0): string {
  return new Date(Date.now() - 3 * 3600e3 + dias * 86400e3).toISOString().slice(0, 10);
}

export function slugManual(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function leerFormulario(form: FormData): ValoresManual {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  return {
    id: s("id") || undefined,
    fuente_id: s("fuente_id"),
    comercio: s("comercio"),
    categoria: s("categoria"),
    titulo: s("titulo"),
    descuento_raw: s("descuento_raw"),
    tipo: (s("tipo") || "porcentaje") as ValoresManual["tipo"],
    porcentaje: s("porcentaje"),
    cuotas: s("cuotas"),
    dias_semana: form.getAll("dias_semana").map(Number).filter((d) => d >= 0 && d <= 6),
    productos_elegibles: form.getAll("productos_elegibles").map(String),
    vigencia_desde: s("vigencia_desde"),
    vigencia_hasta: s("vigencia_hasta"),
    tope_monto: s("tope_monto"),
    tope_periodo: s("tope_periodo"),
    canal: (s("canal") || "presencial") as ValoresManual["canal"],
    url_fuente: s("url_fuente"),
    nota_manual: s("nota_manual"),
  };
}

/**
 * Arma la fila y la valida con `BeneficioSchema`. Devuelve los errores por
 * campo en castellano; el schema es el mismo que usa el pipeline.
 */
export function validar(
  v: ValoresManual,
  id: string,
  comercioKey: string,
): { fila?: Record<string, unknown>; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  if (!FUENTES.some((f) => f.id === v.fuente_id)) errores.fuente_id = "Elegí la fuente.";
  if (!v.comercio) errores.comercio = "Falta el comercio.";
  if (!v.vigencia_hasta) errores.vigencia_hasta = "La fecha de fin es obligatoria en los beneficios manuales.";
  else if (v.vigencia_hasta < fechaUy()) errores.vigencia_hasta = "Ya venció.";
  if (v.url_fuente && !/^https?:\/\//.test(v.url_fuente)) errores.url_fuente = "Tiene que empezar con http:// o https://.";

  const validos = new Set(PRODUCTOS.filter((p) => p.fuente_id === v.fuente_id).map((p) => p.id));
  const fuente = FUENTES.find((f) => f.id === v.fuente_id);
  const fila = {
    id,
    fuente_id: v.fuente_id,
    comercio_key: comercioKey,
    titulo: v.titulo,
    descuento_raw: v.descuento_raw || v.titulo,
    tipo: v.tipo,
    porcentaje: v.tipo === "cuotas" || v.tipo === "2x1" ? null : numero(v.porcentaje),
    cuotas: v.tipo === "cuotas" ? numero(v.cuotas) : null,
    dias_semana: v.dias_semana.length === 7 ? [] : v.dias_semana,
    vigencia_desde: v.vigencia_desde || null,
    vigencia_hasta: v.vigencia_hasta || null,
    departamentos: [],
    productos_elegibles: v.productos_elegibles.filter((p) => validos.has(p)),
    tope_monto: numero(v.tope_monto),
    tope_periodo: v.tope_monto ? v.tope_periodo || null : null,
    canal: v.canal,
    url_fuente: v.url_fuente || fuente?.url || "https://tarjetazo.uy",
    fetched_at: new Date().toISOString(),
    estado_revision: "ok",
  };
  const r = BeneficioSchema.safeParse(fila);
  if (!r.success) {
    for (const i of r.error.issues) {
      const k = String(i.path[0] ?? "general");
      errores[k] ??= TRADUCCION[k] ?? i.message;
    }
  }
  return Object.keys(errores).length ? { errores } : { fila: r.success ? r.data : fila, errores };
}

const TRADUCCION: Record<string, string> = {
  titulo: "El título tiene que tener entre 4 y 160 caracteres.",
  porcentaje: "Poné el porcentaje (0 a 100).",
  cuotas: "Poné la cantidad de cuotas (hasta 36).",
  tope_periodo: "Si hay tope, elegí cada cuánto.",
  tope_monto: "El tope tiene que ser un número.",
  vigencia_hasta: "La fecha de fin no puede ser anterior a la de inicio.",
  comercio_key: "El nombre del comercio no sirve para armar una clave.",
  url_fuente: "El link no es válido.",
};
