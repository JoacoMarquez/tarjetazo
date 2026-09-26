import type { Route } from "next";

/**
 * Una página cruda se identifica por `(fuente_id, external_id)`. Los ids de
 * beneficio son `fuente:external_id:n`, así que de un beneficio se llega a su
 * página y de una página a sus beneficios.
 */

export function urlInspector(fuenteId: string, externalId: string): Route {
  return `/admin/paginas/${encodeURIComponent(fuenteId)}/${encodeURIComponent(externalId)}` as Route;
}

/** `bbva:autos-acesur1:0` → `autos-acesur1`. El external_id puede tener ":". */
export function paginaDeBeneficio(id: string): { fuenteId: string; externalId: string } | null {
  const primero = id.indexOf(":");
  const ultimo = id.lastIndexOf(":");
  if (primero < 0 || ultimo <= primero) return null;
  return { fuenteId: id.slice(0, primero), externalId: id.slice(primero + 1, ultimo) };
}

/**
 * Patrón LIKE para los beneficios de una página. `_` y `%` son comodines: sin
 * escaparlos, `confiteria_carrera_2026` también trae los de
 * `confiteria-carrera-2026`, que es otra página.
 */
export function patronBeneficiosDe(fuenteId: string, externalId: string): string {
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `${esc(fuenteId)}:${esc(externalId)}:%`;
}

/** Fuentes sin modelo: re-normalizarlas no cuesta nada. */
export const FUENTES_DETERMINISTAS = new Set(["bbva", "midinero", "nativa"]);

export type Tramo = {
  id: string;
  titulo: string;
  descuento_raw: string;
  tipo: string;
  porcentaje: number | null;
  cuotas: number | null;
  dias_semana: number[];
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  departamentos: string[];
  productos_elegibles: string[];
  tope_monto: number | null;
  tope_periodo: string | null;
  canal: string;
  compra_minima: number | null;
  requiere_activacion: boolean;
  legales_raw: string | null;
  estado_revision: "ok" | "revisar" | "descartado" | "oculto";
  verificado_hasta: string | null;
  updated_at: string;
  comercio_key: string;
};

export const COLUMNAS_TRAMO =
  "id, titulo, descuento_raw, tipo, porcentaje, cuotas, dias_semana, vigencia_desde, vigencia_hasta, departamentos, productos_elegibles, tope_monto, tope_periodo, canal, compra_minima, requiere_activacion, legales_raw, estado_revision, verificado_hasta, updated_at, comercio_key";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function diasCorto(dias: number[]): string {
  if (dias.length === 0 || dias.length === 7) return "todos los días";
  return [...dias].sort().map((d) => DIAS[d]).join(", ");
}

/** Orden por el `n` del id, no alfabético (`:10` después de `:9`). */
export function ordenarTramos<T extends { id: string }>(tramos: T[]): T[] {
  const n = (id: string) => Number(id.slice(id.lastIndexOf(":") + 1)) || 0;
  return [...tramos].sort((a, b) => n(a.id) - n(b.id));
}
