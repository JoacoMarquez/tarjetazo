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
  /** Tokens del modelo. Ausente en normalizadores propios (sin modelo). */
  uso?: UsoModelo;
}

export interface Scraper {
  readonly id: string;
  fetch(): Promise<Crudo[]>;
}
