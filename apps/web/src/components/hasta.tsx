import { esHasta } from "@/lib/formato";

/**
 * El "hasta" chico al lado (o arriba) de la cifra cuando el porcentaje es un
 * máximo ("Hasta 50%"). En las cards la cifra va grande y no entra la palabra
 * al mismo tamaño.
 */
export function Hasta({
  b,
  apilado = false,
}: {
  b: { porcentaje?: number | null; titulo?: string | null; descuento_raw?: string | null };
  apilado?: boolean;
}) {
  if (!esHasta(b)) return null;
  return (
    <span
      className={
        apilado
          ? "block font-sans text-[11px] leading-none font-semibold tracking-wide uppercase opacity-70"
          : "mr-1 font-sans text-[11px] font-semibold tracking-wide uppercase opacity-70"
      }
    >
      hasta
    </span>
  );
}
