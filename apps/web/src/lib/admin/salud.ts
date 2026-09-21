/** Tipos y textos de los chequeos de `supabase/migrations/*_salud.sql`. */

export type TipoHallazgo =
  | "saltos"
  | "paginas_sin_beneficios"
  | "porcentaje_alto"
  | "derivados_desfasados"
  | "sin_productos"
  | "vencido_publicado"
  | "comercio_en_otros"
  | "nombres_parecidos"
  | "comercios_sin_sucursal";

export const HALLAZGOS: Record<TipoHallazgo, { titulo: string; ayuda: string }> = {
  saltos: {
    titulo: "Saltos entre corridas",
    ayuda:
      "La última corrida trajo muchas más o menos páginas que la anterior, o dio de baja buena parte del catálogo. Una corrida manual con --limite aparece como caída.",
  },
  paginas_sin_beneficios: {
    titulo: "Páginas sin beneficios",
    ayuda:
      "Se bajaron pero no salió ningún tramo ni quedaron en la cola: o no eran un beneficio o el normalizador no entendió nada.",
  },
  porcentaje_alto: {
    titulo: "Porcentaje sospechoso",
    ayuda: "Más de 60 %. Casi siempre es un tope o un monto leído como porcentaje.",
  },
  derivados_desfasados: {
    titulo: "Comercio muestra datos viejos",
    ayuda:
      "El mejor descuento o la cantidad de beneficios del comercio ya no salen de sus beneficios vigentes: alguno venció y nadie recalculó.",
  },
  sin_productos: {
    titulo: "Sin tarjetas elegibles",
    ayuda: "No restringe tarjetas en una fuente donde más del 90 % de los beneficios sí lo hace.",
  },
  vencido_publicado: {
    titulo: "Vencidos que la fuente sigue publicando",
    ayuda:
      "No se muestran en la web, pero indican qué fuentes dejan páginas viejas arriba.",
  },
  comercio_en_otros: {
    titulo: "Comercios en el rubro «Otros»",
    ayuda: "El normalizador no supo en qué rubro ponerlos.",
  },
  nombres_parecidos: {
    titulo: "Comercios con nombre casi igual",
    ayuda: "Candidatos a fusionar.",
  },
  comercios_sin_sucursal: {
    titulo: "Comercios sin ubicación",
    ayuda: "Tienen beneficios presenciales vigentes pero no aparecen en el mapa.",
  },
};

/**
 * Los que piden hacer algo: son los que cuenta el dashboard. El resto es
 * contexto (la mayoría de los bancos no publica direcciones, por ejemplo).
 */
export const ACCIONABLES: TipoHallazgo[] = [
  "saltos",
  "paginas_sin_beneficios",
  "porcentaje_alto",
  "derivados_desfasados",
];

export type Resumen = Partial<Record<TipoHallazgo, number>>;

export function armarResumen(filas: { tipo: string; cantidad: number }[] | null): Resumen {
  const r: Resumen = {};
  for (const f of filas ?? []) r[f.tipo as TipoHallazgo] = Number(f.cantidad);
  return r;
}

export function totalAccionables(r: Resumen): number {
  return ACCIONABLES.reduce((n, t) => n + (r[t] ?? 0), 0);
}

export type PaginasFuente = {
  fuente_id: string;
  paginas: number;
  con_beneficios: number;
  sin_beneficios: number;
};

export type PaginaVacia = {
  fuente_id: string;
  external_id: string;
  url_fuente: string;
  fetched_at: string;
};

export type Salto = {
  fuente_id: string;
  corrida_id: string;
  empezo_en: string;
  paginas: number;
  paginas_anterior: number | null;
  variacion_paginas_pct: number | null;
  nuevos: number;
  vencidos: number;
  activos: number;
  bajas_pct: number | null;
  alerta: boolean;
};

export type Inconsistencia = {
  tipo: TipoHallazgo;
  fuente_id: string | null;
  beneficio_id: string | null;
  comercio_key: string;
  comercio: string;
  detalle: string;
  url_fuente: string | null;
};

export type ParParecido = {
  key_a: string;
  nombre_a: string;
  n_a: number;
  key_b: string;
  nombre_b: string;
  n_b: number;
  similitud: number;
};

export type ComercioSinSucursal = {
  comercio_key: string;
  comercio: string;
  categoria: string;
  n_beneficios: number;
};

export type MetricaGeo = { metrica: string; cantidad: number };
