import type { Producto } from "@tarjetazo/core";
import type { BeneficioListado } from "./consultas";
import { PRODUCTO_POR_ID, productosDe } from "./marca";

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
