"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { RUBROS_COMPARAR, fmt } from "@/lib/comparar-tarjetas";

/**
 * La columna de gasto mensual: mueve los montos y toda la comparación se
 * recalcula. Plegada deja solo las etiquetas de rubro con el monto debajo.
 */
export function ColumnaGasto({
  gasto,
  onGasto,
  onReset,
  plegada = false,
  onPlegar,
  subtitulo,
}: {
  gasto: Record<string, number>;
  onGasto: (rubro: string, v: number) => void;
  onReset: () => void;
  plegada?: boolean;
  onPlegar?: (v: boolean) => void;
  subtitulo: string;
}) {
  const total = RUBROS_COMPARAR.reduce((s, r) => s + (gasto[r.slug] ?? 0), 0);

  return (
    <div
      className="bg-tinta relative shrink-0 overflow-hidden rounded-[18px] text-white"
      style={{
        width: plegada ? 150 : 210,
        boxShadow: "0 20px 50px rgba(20,32,44,.25)",
        transition: "width .3s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div className="bg-pizarra h-1.5" />

      {onPlegar && (
        <button
          type="button"
          aria-label={plegada ? "Abrir el gasto" : "Plegar el gasto"}
          onClick={() => onPlegar(!plegada)}
          className="bg-pizarra border-hueso absolute right-2 z-10 inline-flex size-7 items-center justify-center rounded-full border-2"
          style={{ top: 66 }}
        >
          {plegada ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      )}

      <div className="flex h-[146px] flex-col justify-center px-3.5">
        <p className="text-humo-oscuro m-0 text-[11px] font-semibold tracking-[.08em] uppercase">
          {plegada ? "Categorías" : "Tu gasto mensual"}
        </p>
        {!plegada && (
          <p className="text-humo-claro m-0 mt-1.5 pr-8 text-[12px] leading-snug">
            {subtitulo}
          </p>
        )}
        <p className="num text-sol m-0 mt-2 text-[22px] font-bold">
          {fmt(total)}
        </p>
        {!plegada && (
          <button
            type="button"
            onClick={onReset}
            className="text-humo-claro mt-1 self-start text-[12px] underline-offset-2 hover:underline"
          >
            Restablecer
          </button>
        )}
      </div>

      {RUBROS_COMPARAR.map((r) => (
        <div
          key={r.slug}
          className="flex h-[59px] flex-col justify-center gap-1 border-t border-white/10 px-3.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold">
              {r.label}
            </span>
            {!plegada && (
              <span className="num text-sol shrink-0 text-[13px] font-bold">
                {fmt(gasto[r.slug] ?? 0)}
              </span>
            )}
          </div>
          {plegada ? (
            <span className="num text-humo-oscuro text-[11px]">
              {fmt(gasto[r.slug] ?? 0)}
            </span>
          ) : (
            <input
              type="range"
              min={0}
              max={40000}
              step={500}
              value={gasto[r.slug] ?? 0}
              onChange={(e) => onGasto(r.slug, Number(e.target.value))}
              aria-label={`Gasto mensual en ${r.label}`}
              className="h-1 w-full"
              style={{ accentColor: "#f7b500" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
