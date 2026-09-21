import { ETIQUETA_ESTADO, type EstadoFuente } from "@/lib/admin/corridas";
import { cn } from "@/lib/utils";

const CLASE: Record<EstadoFuente, string> = {
  ok: "bg-menta-s text-menta-ink border-menta-ln",
  en_curso: "bg-cielo-s text-cielo-ink border-cielo-ln",
  error: "bg-coral-s text-coral-ink border-coral-ln",
  trabada: "bg-coral-s text-coral-ink border-coral-ln",
  sin_correr: "bg-sol-s text-sol-ink border-sol-ln",
  sin_historial: "bg-papel-1 text-humo-oscuro border-linea",
};

export function EstadoCorridaBadge({ estado }: { estado: EstadoFuente }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        CLASE[estado],
      )}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
