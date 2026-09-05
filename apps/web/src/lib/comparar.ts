import { CATEGORIAS, FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { createSupabaseClient } from "./supabase";

/** Una fila por fuente y rubro, con los componentes del puntaje. */
export interface FilaComparacion {
  fuente_id: string;
  fuente_nombre: string;
  categoria: string;
  n_beneficios: number;
  n_comercios: number;
  mejor_pct: number | null;
  con_tope: number;
  todos_los_dias: number;
  puntos: number;
}

export interface Ranking {
  fuente_id: string;
  fuente_nombre: string;
  url: string;
  puntos: number;
  n_beneficios: number;
  n_comercios: number;
  mejor_pct: number | null;
  con_tope: number;
  todos_los_dias: number;
  /** Desglose por rubro elegido, para el "por qué". */
  rubros: FilaComparacion[];
}

const URL_FUENTE = new Map(FUENTES.map((f) => [f.id, f.url]));

export async function comparar(categorias: string[], departamentos: string[]): Promise<Ranking[]> {
  const db = createSupabaseClient();
  const { data, error } = await db.rpc("comparar_fuentes", {
    p_categorias: categorias.length ? categorias : null,
    p_departamentos: departamentos.length ? departamentos : null,
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaComparacion[];

  const porFuente = new Map<string, Ranking>();
  for (const f of filas) {
    const r =
      porFuente.get(f.fuente_id) ??
      porFuente.set(f.fuente_id, {
        fuente_id: f.fuente_id,
        fuente_nombre: f.fuente_nombre,
        url: URL_FUENTE.get(f.fuente_id) ?? "#",
        puntos: 0,
        n_beneficios: 0,
        n_comercios: 0,
        mejor_pct: null,
        con_tope: 0,
        todos_los_dias: 0,
        rubros: [],
      }).get(f.fuente_id)!;
    r.puntos += Number(f.puntos);
    r.n_beneficios += Number(f.n_beneficios);
    r.n_comercios += Number(f.n_comercios);
    r.con_tope += Number(f.con_tope);
    r.todos_los_dias += Number(f.todos_los_dias);
    if (f.mejor_pct != null && (r.mejor_pct == null || f.mejor_pct > r.mejor_pct)) r.mejor_pct = Number(f.mejor_pct);
    r.rubros.push(f);
  }
  return [...porFuente.values()]
    .map((r) => ({ ...r, puntos: Math.round(r.puntos * 10) / 10 }))
    .sort((a, b) => b.puntos - a.puntos);
}

export const RUBROS = CATEGORIAS.map((c) => ({ slug: c.slug, label: c.label, en_home: c.en_home }));

export function productosDe(fuenteId: string) {
  return PRODUCTOS.filter((p) => p.fuente_id === fuenteId);
}

export function fuente(id: string) {
  return FUENTES.find((f) => f.id === id) ?? null;
}
