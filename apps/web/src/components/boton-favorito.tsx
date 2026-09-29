"use client";

import { Heart } from "lucide-react";
import { useFavoritos } from "@/lib/favoritos";
import { cn } from "@/lib/utils";

/**
 * El corazón de un comercio (#115). Guarda o saca el comercio de Favoritos.
 * `compacto` es el ícono solo (listas, popup del mapa); si no, con texto.
 */
export function BotonFavorito({
  comercioKey,
  nombre,
  compacto = false,
  className,
}: {
  comercioKey: string;
  nombre: string;
  compacto?: boolean;
  className?: string;
}) {
  const { esFavorito, alternar, cargado } = useFavoritos();
  const activo = cargado && esFavorito(comercioKey);
  const etiqueta = activo ? `Sacar ${nombre} de favoritos` : `Guardar ${nombre} en favoritos`;
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={(e) => {
        // Suele ir adentro de una tarjeta clickeable.
        e.stopPropagation();
        e.preventDefault();
        alternar(comercioKey);
      }}
      className={cn(
        "border-linea inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border bg-white transition-colors",
        compacto ? "size-9" : "h-9 px-3 text-sm font-medium",
        activo ? "border-coral-ln bg-coral-s text-coral-ink" : "text-humo hover:text-tinta hover:bg-secondary",
        className,
      )}
    >
      <Heart className="size-4" fill={activo ? "currentColor" : "none"} strokeWidth={2} />
      {!compacto && (activo ? "Guardado" : "Guardar")}
    </button>
  );
}
