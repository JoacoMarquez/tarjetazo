"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { RUBROS_COMPARAR, fmt } from "@/lib/comparar-tarjetas";
import { cn } from "@/lib/utils";

/**
 * La columna de gasto mensual: mueve los montos y toda la comparación se
 * recalcula. Plegada deja solo las etiquetas de rubro con el monto debajo.
 *
 * `plegada = null` es "según el ancho": plegada en el celular y abierta en el
 * resto, resuelto con CSS. Decidirlo en un efecto hacía saltar la página al
 * cargar (CLS); el primer toque del botón la fija.
 */
export function ColumnaGasto({
  gasto,
  onGasto,
  onReset,
  plegada = false,
  onPlegar,
  subtitulo,
  className,
}: {
  gasto: Record<string, number>;
  onGasto: (rubro: string, v: number) => void;
  onReset: () => void;
  plegada?: boolean | null;
  onPlegar?: (v: boolean) => void;
  subtitulo: string;
  className?: string;
}) {
  const total = RUBROS_COMPARAR.reduce((s, r) => s + (gasto[r.slug] ?? 0), 0);
  const auto = plegada === null;
  /** Clases para lo que se ve solo plegada (`true`) o solo abierta (`false`). */
  const solo = (cuandoPlegada: boolean) =>
    auto
      ? cuandoPlegada
        ? "sm:hidden"
        : "max-sm:hidden"
      : plegada === cuandoPlegada
        ? ""
        : "hidden";
  const plegadaAhora = () =>
    auto ? window.matchMedia("(max-width: 639px)").matches : plegada;

  return (
    <div
      className={cn(
        "bg-tinta relative shrink-0 overflow-hidden rounded-[18px] text-white",
        auto && "w-[150px] sm:w-[210px]",
        className,
      )}
      style={{
        width: auto ? undefined : plegada ? 150 : 210,
        boxShadow: "0 20px 50px rgba(20,32,44,.25)",
        transition: "width .3s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div className="bg-pizarra h-1.5" />

      {onPlegar && (
        <button
          type="button"
          aria-label={auto ? "Plegar o abrir el gasto" : plegada ? "Abrir el gasto" : "Plegar el gasto"}
          onClick={() => onPlegar(!plegadaAhora())}
          className="bg-pizarra border-hueso absolute right-2 z-10 inline-flex size-7 items-center justify-center rounded-full border-2"
          style={{ top: 66 }}
        >
          <ChevronRight className={cn("size-3.5", solo(true))} />
          <ChevronLeft className={cn("size-3.5", solo(false))} />
        </button>
      )}

      <div className="flex h-[146px] flex-col justify-center px-3.5">
        <p className="text-humo-oscuro m-0 text-[11px] font-semibold tracking-[.08em] uppercase">
          <span className={solo(true)}>Categorías</span>
          <span className={solo(false)}>Tu gasto mensual</span>
        </p>
        <p
          className={cn(
            "text-humo-claro m-0 mt-1.5 pr-8 text-[12px] leading-snug",
            solo(false),
          )}
        >
          {subtitulo}
        </p>
        <p className="num text-sol m-0 mt-2 text-[22px] font-bold">
          {fmt(total)}
        </p>
        <button
          type="button"
          onClick={onReset}
          className={cn(
            "text-humo-claro mt-1 self-start text-[12px] underline-offset-2 hover:underline",
            solo(false),
          )}
        >
          Restablecer
        </button>
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
            <span
              className={cn(
                "num text-sol shrink-0 text-[13px] font-bold",
                solo(false),
              )}
            >
              {fmt(gasto[r.slug] ?? 0)}
            </span>
          </div>
          <span className={cn("num text-humo-oscuro text-[11px]", solo(true))}>
            {fmt(gasto[r.slug] ?? 0)}
          </span>
          <input
            type="range"
            min={0}
            max={40000}
            step={500}
            value={gasto[r.slug] ?? 0}
            onChange={(e) => onGasto(r.slug, Number(e.target.value))}
            aria-label={`Gasto mensual en ${r.label}`}
            className={cn("h-1 w-full", solo(false))}
            style={{ accentColor: "#f7b500" }}
          />
        </div>
      ))}
    </div>
  );
}
