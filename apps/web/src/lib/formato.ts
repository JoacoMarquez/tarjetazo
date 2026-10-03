import { alcanceTarjetas, type Producto } from "@tarjetazo/core";
import type { BeneficioListado } from "./consultas";
import { PRODUCTO_POR_ID, productosDe } from "./marca";

/**
 * El alcance para las cards chicas (home, listado, mapa): solo si nombra algo
 * concreto. "Algunas tarjetas de crédito" no ayuda ahí; la página del
 * comercio lo muestra con el detalle a un click.
 */
export function alcanceCorto(fuenteId: string, productos: readonly string[] | null | undefined): string | null {
  const alcance = alcanceTarjetas(fuenteId, productos ?? []);
  return alcance && !alcance.startsWith("algunas") ? alcance : null;
}

/**
 * "Hasta 50%": el porcentaje guardado es el máximo, no lo que se descuenta
 * siempre. Se muestra con un "hasta" para no prometer la cifra como fija.
 */
export function esHasta(b: { porcentaje?: number | null; titulo?: string | null; descuento_raw?: string | null }): boolean {
  return b.porcentaje != null && /^\s*hasta\b/i.test(b.descuento_raw || b.titulo || "");
}

/** La cifra grande de una card: "15%", "2x1" o "12 cuotas". */
export function cifraBeneficio(b: Pick<BeneficioListado, "porcentaje" | "cuotas" | "tipo">): string {
  if (b.tipo === "2x1") return "2x1";
  if (b.porcentaje != null) return `${Math.round(b.porcentaje)}%`;
  if (b.cuotas) return `${b.cuotas} cuotas`;
  return "—";
}

/**
 * Con qué tarjeta conviene pagar este beneficio. Si el usuario tiene alguna de
 * las elegibles gana esa; si no, la primera que publica la fuente (un beneficio
 * sin productos declarados vale para todas las del emisor).
 */
export function tarjetaSugerida(
  b: Pick<BeneficioListado, "productos_elegibles" | "fuente_id">,
  mis: string[],
): { producto: Producto | undefined; laTengo: boolean } {
  const elegibles = b.productos_elegibles?.length
    ? b.productos_elegibles
    : productosDe(b.fuente_id).map((p) => p.id);
  const mia = elegibles.find((id) => mis.includes(id));
  return {
    producto: PRODUCTO_POR_ID[mia ?? elegibles[0] ?? ""],
    laTengo: mia != null,
  };
}
