"use client";

import { diaEnUruguay } from "@/lib/filtros";
import { cn } from "@/lib/utils";

const LETRAS = ["D", "L", "M", "M", "J", "V", "S"];
/** El tablero arranca en lunes, como el calendario. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

const PRESETS: { label: string; dias: number[] }[] = [
  { label: "Todos", dias: [0, 1, 2, 3, 4, 5, 6] },
  { label: "L–V", dias: [1, 2, 3, 4, 5] },
  { label: "Finde", dias: [6, 0] },
];

function mismos(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

export function SelectorDias({
  dias,
  onCambiar,
}: {
  dias: number[];
  onCambiar: (d: number[]) => void;
}) {
  const hoy = diaEnUruguay();
  const presets = [...PRESETS, { label: "Hoy", dias: [hoy] }];

  return (
    <div className="border-linea flex h-10 items-center gap-1 rounded-pill border bg-white px-1.5">
      {presets.map((p) => {
        const activo = mismos(dias, p.dias);
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(p.dias)}
            className={cn(
              "h-8 rounded-pill px-3 text-[13px] font-semibold transition-colors",
              activo ? "bg-tinta text-white" : "text-humo hover:bg-papel",
            )}
          >
            {p.label}
          </button>
        );
      })}
      <span className="bg-linea mx-1 h-5 w-px" aria-hidden />
      {ORDEN.map((d) => {
        const activo = dias.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={activo}
            aria-label={`Día ${LETRAS[d]}`}
            onClick={() =>
              onCambiar(activo ? dias.filter((x) => x !== d) : [...dias, d])
            }
            className={cn(
              "inline-flex size-[30px] items-center justify-center rounded-full text-xs font-semibold transition-colors",
              activo
                ? "bg-tinta text-white"
                : "border-linea text-humo-oscuro border bg-white",
            )}
            // Hoy lleva anillo sol para ubicarse sin leer.
            style={
              d === hoy
                ? { boxShadow: "0 0 0 2px #fff, 0 0 0 4px #f7b500" }
                : undefined
            }
          >
            {LETRAS[d]}
          </button>
        );
      })}
    </div>
  );
}
