"use client";

import { CalendarDays, MapPin, Sparkles, Ticket } from "lucide-react";
import { CATEGORIAS } from "@tarjetazo/core";
import { NOMBRES_DIA } from "@/lib/filtros";
import type { BeneficioListado } from "@/lib/consultas";
import { cn } from "@/lib/utils";

const LABEL_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.slug, c.label]));

function pesos(n: number): string {
  return `$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

function diasLegibles(dias: number[]): string | null {
  if (dias.length === 0 || dias.length === 7) return null;
  return dias.map((d) => NOMBRES_DIA[d]!.slice(0, 3)).join(", ");
}

/** El número grande: qué se lleva el usuario. */
function Cifra({ b }: { b: BeneficioListado }) {
  if (b.tipo === "cuotas" && b.cuotas) {
    return (
      <span className="num text-cielo text-2xl font-bold leading-none">
        {b.cuotas}
        <span className="text-humo ml-1 text-xs font-medium">cuotas</span>
      </span>
    );
  }
  if (b.tipo === "2x1") {
    return <span className="num text-sol-ink text-2xl font-bold leading-none">2x1</span>;
  }
  if (b.porcentaje == null) return <span className="text-humo text-sm">—</span>;
  return (
    <span
      className={cn(
        "num text-2xl font-bold leading-none",
        b.tipo === "reintegro" ? "text-menta-ink" : "text-cielo",
      )}
    >
      {b.porcentaje.toLocaleString("es-UY", { maximumFractionDigits: 0 })}
      <span className="text-base">%</span>
    </span>
  );
}

export function CardBeneficio({
  b,
  paraVos,
  onElegir,
}: {
  b: BeneficioListado;
  paraVos: boolean;
  onElegir?: (b: BeneficioListado) => void;
}) {
  const dias = diasLegibles(b.dias_semana);
  return (
    <article
      className="border-linea bg-card hover:border-cielo-ln rounded-lg border p-4 transition-colors"
      onClick={() => onElegir?.(b)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-base font-bold">{b.comercio}</h3>
          <p className="text-humo mt-0.5 text-xs">
            {LABEL_CATEGORIA.get(b.categoria) ?? b.categoria} · {b.fuente_nombre}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Cifra b={b} />
        </div>
      </div>

      <p className="text-humo mt-2 line-clamp-2 text-sm">{b.descuento_raw}</p>

      <div className="text-humo mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        {paraVos && (
          <span className="bg-menta-s text-menta-ink rounded-pill inline-flex items-center gap-1 px-2 py-0.5 font-medium">
            <Sparkles className="size-3" /> Para vos
          </span>
        )}
        {dias && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {dias}
          </span>
        )}
        {b.tope_monto != null && (
          <span className="inline-flex items-center gap-1">
            <Ticket className="size-3.5" /> tope {pesos(b.tope_monto)}
            {b.tope_periodo ? `/${b.tope_periodo}` : ""}
          </span>
        )}
        {b.n_sucursales > 0 && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {b.n_sucursales}{" "}
            {b.n_sucursales === 1 ? "local" : "locales"}
          </span>
        )}
      </div>
    </article>
  );
}
