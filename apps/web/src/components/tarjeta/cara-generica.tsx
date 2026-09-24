import { PROPORCION_TARJETA } from "@/components/tarjeta-3d";
import { colorFuente } from "@/lib/marca";

/**
 * Lo que se ve cuando todavía no hay foto de la tarjeta: el color del banco
 * y el nombre, sin logos (no tenemos derechos sobre los de los bancos).
 */
export function CaraGenerica({ fuenteId, banco, nombre, pie }: { fuenteId: string; banco: string; nombre: string; pie: string }) {
  const c = colorFuente(fuenteId);
  return (
    <div
      className="relative flex w-full flex-col justify-between overflow-hidden rounded-[4%/6.3%] p-[6%] text-white shadow-lg"
      style={{ aspectRatio: PROPORCION_TARJETA, background: `linear-gradient(135deg, ${c.color} 0%, ${c.ink} 100%)` }}
      role="img"
      aria-label={`${nombre} de ${banco}`}
    >
      <span className="text-sm font-semibold tracking-wide uppercase opacity-90">{banco}</span>
      <span aria-hidden className="h-[18%] w-[14%] rounded-md bg-white/35" />
      <span>
        <span className="block text-lg leading-tight font-semibold">{nombre}</span>
        <span className="block text-xs opacity-80">{pie}</span>
      </span>
    </div>
  );
}
