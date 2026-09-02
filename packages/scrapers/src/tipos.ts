import type { BeneficioNormalizado } from "@tarjetazo/core";

/** Material crudo de una página, antes de interpretarlo. Se guarda siempre. */
export interface Crudo {
  fuente_id: string;
  /** Identidad del beneficio dentro de la fuente (para upsert idempotente). */
  external_id: string;
  url_fuente: string;
  /** Texto de la página tal como lo lee una persona. */
  contenido: string;
  fetched_at: string;
}

/** Una página puede contener varios beneficios (uno por tramo de tarjeta). */
export interface Extraido {
  crudo: Crudo;
  comercio: { key: string; nombre: string; categoria: string } | null;
  beneficios: BeneficioNormalizado[];
  /** Productos que el normalizador nombró pero no supimos mapear. */
  productos_desconocidos: string[];
}

export interface Scraper {
  readonly id: string;
  fetch(): Promise<Crudo[]>;
}
