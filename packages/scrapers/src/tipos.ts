import type { BeneficioNormalizado, UsoModelo } from "@tarjetazo/core";

/** Material crudo de una página, antes de interpretarlo. Se guarda siempre. */
export interface Crudo {
  fuente_id: string;
  /** Identidad del beneficio dentro de la fuente (para upsert idempotente). */
  external_id: string;
  url_fuente: string;
  /** Texto de la página tal como lo lee una persona. */
  contenido: string;
  fetched_at: string;
  /**
   * Locales que la propia fuente publica con coordenadas. Itaú los trae en su
   * feed; se guardan como sucursales una vez que sabemos a qué comercio
   * pertenece el beneficio.
   */
  sucursales?: SucursalDeFuente[];
  /**
   * Locales que la fuente publica solo con la dirección escrita (Club El País).
   * El runner los geocodifica y guarda el pin si es confiable (geo/direccion.ts).
   */
  direcciones?: DireccionDeFuente[];
  /**
   * Comercio que la fuente ya nombra sin ambigüedad (cada landing de Itaú es
   * de un restaurante). Gana sobre el que diga el modelo, que a veces toma el
   * rubro ("Restaurantes") como nombre y junta ahí páginas de distintos locales.
   */
  comercio?: { nombre: string; categoria: string };
  /**
   * El logo del comercio tal como lo publica la fuente (URL absoluta). El
   * runner lo baja una vez por comercio, si todavía no tiene uno (#118).
   */
  logo?: string;
  /**
   * Los campos que la fuente ya publica estructurados (Scotiabank), para su
   * normalizador propio: así no tiene que volver a leerlos del texto. No se
   * guarda ni entra en el hash, que sigue siendo el de `contenido`. Cada
   * parser sabe su forma.
   */
  datos?: unknown;
}

export interface DireccionDeFuente {
  direccion: string;
  /** Slug del departamento que dice la propia dirección. */
  departamento: string;
}

export interface SucursalDeFuente {
  nombre: string | null;
  direccion: string;
  lat: number;
  lng: number;
}

/** Una página puede contener varios beneficios (uno por tramo de tarjeta). */
export interface Extraido {
  crudo: Crudo;
  comercio: { key: string; nombre: string; categoria: string } | null;
  beneficios: BeneficioNormalizado[];
  /** Productos que el normalizador nombró pero no supimos mapear. */
  productos_desconocidos: string[];
  /**
   * `false` cuando el normalizador decidió que la página no es un beneficio
   * (institucional, sorteo, listado). Distinto de "no le pudo sacar tramos".
   */
  es_beneficio?: boolean;
  /**
   * Los beneficios sin departamentos toman los de los locales que la fuente
   * publicó con la página (Santander: las direcciones casi nunca dicen el
   * departamento, pero cada local trae su punto). Lo completa el runner, que
   * es el que conoce el departamento de cada punto.
   */
  departamentosDeLocales?: boolean;
  /** Tokens del modelo. Ausente en normalizadores propios (sin modelo). */
  uso?: UsoModelo;
}

/**
 * Un parser propio que no entiende una página con seguridad la devuelve así:
 * queda pendiente (como en el modo sin modelo) y sus beneficios de antes
 * siguen publicados, en vez de publicar algo dudoso.
 */
export class PaginaPendiente extends Error {}

export interface Scraper {
  readonly id: string;
  fetch(): Promise<Crudo[]>;
}
