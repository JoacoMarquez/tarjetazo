import type { BeneficioNormalizado } from "@tarjetazo/core";

/** Lo que un scraper guarda en crudo antes de normalizar (se conserva siempre). */
export interface Crudo {
  fuente_id: string;
  url_fuente: string;
  /** HTML o JSON tal cual vino. */
  contenido: string;
  fetched_at: string;
}

export interface Scraper {
  /** id de la fuente en la tabla `fuente`. */
  readonly id: string;
  /** Descarga y devuelve el material crudo, sin interpretar. */
  fetch(): Promise<Crudo[]>;
  /** Convierte un crudo en beneficios normalizados (con Claude o parseo directo). */
  normalizar(crudo: Crudo): Promise<BeneficioNormalizado[]>;
}
