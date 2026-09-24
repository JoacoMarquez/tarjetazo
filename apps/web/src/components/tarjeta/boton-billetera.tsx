"use client";

import { Check, Plus } from "lucide-react";
import { FAMILIA_POR_ID } from "@tarjetazo/core";
import { useBilletera } from "@/lib/billetera";
import { cn } from "@/lib/utils";

/**
 * Agregar la tarjeta a la billetera desde su página. Se agregan todos los
 * plásticos de la familia, igual que en el selector de "Mis tarjetas".
 */
export function BotonBilletera({ familiaId, className }: { familiaId: string; className?: string }) {
  const { mis, cargado, alternarFamilia } = useBilletera();
  const ids = FAMILIA_POR_ID[familiaId]?.productos.map((p) => p.id) ?? [familiaId];
  const laTengo = cargado && ids.every((id) => mis.includes(id));
  return (
    <button
      type="button"
      onClick={() => alternarFamilia(familiaId)}
      aria-pressed={laTengo}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-medium",
        laTengo ? "border-menta-ln bg-menta-s text-menta-ink border" : "bg-primary text-primary-foreground hover:opacity-90",
        className,
      )}
    >
      {laTengo ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      {laTengo ? "Está en mis tarjetas" : "Agregar a mis tarjetas"}
    </button>
  );
}
