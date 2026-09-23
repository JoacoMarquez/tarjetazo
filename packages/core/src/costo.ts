/**
 * Tokens del normalizador y su costo **estimado**. La referencia de gasto es el
 * saldo de la consola de Anthropic: los contadores de `usage` ya subestimaron
 * entre 2 y 6 veces (docs/03-spec.md, memoria de costos).
 */
export interface UsoModelo {
  entrada: number;
  cache_escritura: number;
  cache_lectura: number;
  salida: number;
}

/** claude-sonnet-5, USD por millón de tokens (lista de precios de Anthropic, 2026). */
export const COSTO_MODELO_USD_POR_MTOK = {
  entrada: 2,
  cache_escritura: 2.5,
  cache_lectura: 0.2,
  salida: 10,
} as const;

export function costoEstimadoUsd(u: UsoModelo): number {
  const p = COSTO_MODELO_USD_POR_MTOK;
  return (
    (u.entrada * p.entrada +
      u.cache_escritura * p.cache_escritura +
      u.cache_lectura * p.cache_lectura +
      u.salida * p.salida) /
    1_000_000
  );
}
