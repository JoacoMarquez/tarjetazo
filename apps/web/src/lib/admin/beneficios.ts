import { CATEGORIAS, FUENTES } from "@tarjetazo/core";

/** Filtros del registro, leídos de la URL. Lógica pura: la consulta vive en la página. */

export const ESTADOS = ["ok", "oculto", "revisar", "descartado", "todos"] as const;
export type EstadoFiltro = (typeof ESTADOS)[number];

export const VIGENCIAS = ["todas", "vigentes", "vencidos", "sin_fin", "sospechosos"] as const;
export type VigenciaFiltro = (typeof VIGENCIAS)[number];

export const POR_PAGINA = 50;

export type FiltrosRegistro = {
  fuente: string | null;
  rubro: string | null;
  estado: EstadoFiltro;
  vigencia: VigenciaFiltro;
  q: string;
  pagina: number;
};

const FUENTES_VALIDAS = new Set<string>(FUENTES.map((f) => f.id));
const RUBROS_VALIDOS = new Set<string>(CATEGORIAS.map((c) => c.slug));

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function leerFiltrosRegistro(params: Params): FiltrosRegistro {
  const fuente = uno(params.fuente);
  const rubro = uno(params.rubro);
  const estado = uno(params.estado) as EstadoFiltro;
  const vigencia = uno(params.vigencia) as VigenciaFiltro;
  const pagina = Number.parseInt(uno(params.pagina), 10);
  return {
    fuente: FUENTES_VALIDAS.has(fuente) ? fuente : null,
    rubro: RUBROS_VALIDOS.has(rubro) ? rubro : null,
    // Por defecto lo publicado, que es lo que ve la gente.
    estado: ESTADOS.includes(estado) ? estado : "ok",
    vigencia: VIGENCIAS.includes(vigencia) ? vigencia : "todas",
    q: uno(params.q).trim().slice(0, 80),
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
  };
}

/** Query string para un link, sin los valores por defecto. */
export function urlRegistro(f: FiltrosRegistro, cambios: Partial<FiltrosRegistro> = {}): string {
  const g = { ...f, ...cambios };
  const p = new URLSearchParams();
  if (g.fuente) p.set("fuente", g.fuente);
  if (g.rubro) p.set("rubro", g.rubro);
  if (g.estado !== "ok") p.set("estado", g.estado);
  if (g.vigencia !== "todas") p.set("vigencia", g.vigencia);
  if (g.q) p.set("q", g.q);
  if (g.pagina > 1) p.set("pagina", String(g.pagina));
  const qs = p.toString();
  return `/admin/beneficios${qs ? `?${qs}` : ""}`;
}

/**
 * Texto libre para un filtro `or` de PostgREST: las comas, paréntesis y
 * comodines rompen la sintaxis del filtro, así que se sacan.
 */
export function textoSeguro(q: string): string {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim();
}

/** Como `slugificar` del scraper: la clave del comercio es el nombre en slug. */
export function slugBusqueda(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type FilaRegistro = {
  id: string;
  fuente_id: string;
  comercio_key: string;
  titulo: string;
  descuento_raw: string;
  tipo: "porcentaje" | "cuotas" | "reintegro" | "2x1";
  porcentaje: number | null;
  cuotas: number | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  productos_elegibles: string[];
  estado_revision: "ok" | "revisar" | "descartado" | "oculto";
  verificado_hasta: string | null;
  origen: "scraper" | "manual";
  url_fuente: string;
  updated_at: string;
  comercio: { nombre: string; categoria: string } | null;
};

/** "25 %", "12 cuotas", "2x1", "reintegro 20 %". */
export function descuentoCorto(b: FilaRegistro): string {
  if (b.tipo === "cuotas") return b.cuotas ? `${b.cuotas} cuotas` : "cuotas";
  if (b.tipo === "2x1") return "2x1";
  const pct = b.porcentaje === null ? "" : `${Number(b.porcentaje).toLocaleString("es-UY")} %`;
  return b.tipo === "reintegro" ? `reintegro ${pct}`.trim() : pct || "—";
}
