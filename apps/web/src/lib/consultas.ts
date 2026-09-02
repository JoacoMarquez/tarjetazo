import { createSupabaseClient } from "./supabase";
import { diaNumerico, type Filtros } from "./filtros";

/** `null` significa "sin filtrar" en las funciones de la base. */
function oNull(xs: string[]): string[] | null {
  return xs.length > 0 ? xs : null;
}

export function argumentosComunes(f: Filtros) {
  return {
    p_fuentes: oNull(f.bancos),
    p_productos: f.soloMisTarjetas ? oNull(f.productos) : null,
    p_categorias: oNull(f.categorias),
    p_dia: diaNumerico(f.dia),
  };
}

export interface BeneficioListado {
  id: string;
  fuente_id: string;
  fuente_nombre: string;
  comercio_key: string;
  comercio: string;
  categoria: string;
  logo_url: string | null;
  titulo: string;
  descuento_raw: string;
  porcentaje: number | null;
  cuotas: number | null;
  tipo: "porcentaje" | "cuotas" | "reintegro" | "2x1";
  dias_semana: number[];
  tope_monto: number | null;
  tope_periodo: string | null;
  canal: string;
  vigencia_hasta: string | null;
  productos_elegibles: string[];
  n_sucursales: number;
  total: number;
}

export async function listarBeneficios(f: Filtros, pagina = 0, porPagina = 40) {
  const db = createSupabaseClient();
  const { data, error } = await db.rpc("beneficios_filtrados", {
    ...argumentosComunes(f),
    p_departamentos: oNull(f.departamentos),
    p_tipos: oNull(f.tipos),
    p_comercio: f.comercio,
    p_orden: f.orden,
    p_limit: porPagina,
    p_offset: pagina * porPagina,
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as BeneficioListado[];
  return { beneficios: filas, total: filas[0]?.total ?? 0 };
}

export interface PuntoMapa {
  sucursal_id: string;
  comercio_key: string;
  comercio: string;
  categoria: string;
  logo_url: string | null;
  direccion: string;
  lat: number;
  lng: number;
  best_pct: number | null;
  max_cuotas: number | null;
  n_beneficios: number;
}

export interface Bbox {
  sur: number;
  oeste: number;
  norte: number;
  este: number;
}

/** Tope de puntos que devolvemos; si se alcanza, la UI pide acercar el mapa. */
export const TOPE_PUNTOS = 300;

export async function puntosDelMapa(f: Filtros, bbox: Bbox) {
  const db = createSupabaseClient();
  const { data, error } = await db.rpc("sucursales_en_bbox", {
    ...argumentosComunes(f),
    p_sur: bbox.sur,
    p_oeste: bbox.oeste,
    p_norte: bbox.norte,
    p_este: bbox.este,
    p_limit: TOPE_PUNTOS,
  });
  if (error) throw new Error(error.message);
  const puntos = (data ?? []) as PuntoMapa[];
  return { puntos, recortado: puntos.length >= TOPE_PUNTOS };
}

export interface ResultadoBusqueda {
  comercio_key: string;
  comercio: string;
  categoria: string;
  logo_url: string | null;
  best_pct: number | null;
  max_cuotas: number | null;
  mejor_fuente: string;
  mejor_titulo: string;
  n_beneficios: number;
}

export async function buscarComercios(q: string, f: Filtros) {
  const db = createSupabaseClient();
  const { data, error } = await db.rpc("buscar_comercios", {
    p_q: q,
    p_fuentes: oNull(f.bancos),
    p_productos: f.soloMisTarjetas ? oNull(f.productos) : null,
    p_limit: 8,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResultadoBusqueda[];
}
