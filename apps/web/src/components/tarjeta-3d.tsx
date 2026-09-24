"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Proporción de una tarjeta ISO/IEC 7810 ID-1: 85,60 × 53,98 mm. */
export const PROPORCION_TARJETA = 85.6 / 53.98;
const INCLINACION_MAX = 12;

/**
 * Foto de tarjeta con inclinación que sigue al puntero y, si hay dorso, se da
 * vuelta con un click. Solo CSS 3D (decisión de #26: nada de modelos .glb).
 * La usa el backoffice como vista previa y la página pública de #11.
 */
export function Tarjeta3D({
  frente,
  dorso,
  alt,
  className,
}: {
  frente: string | null;
  dorso?: string | null;
  alt: string;
  className?: string;
}) {
  const [girada, setGirada] = useState(false);
  const [giro, setGiro] = useState({ x: 0, y: 0, brillo: 50 });
  // Itaú diseña sus tarjetas en vertical: se mira la foto del frente al cargar
  // y la tarjeta toma esa orientación en vez de recortarla.
  const [vertical, setVertical] = useState(false);
  const puedeGirar = Boolean(frente && dorso);

  function mover(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setGiro({ x: -py * 2 * INCLINACION_MAX, y: px * 2 * INCLINACION_MAX, brillo: (px + 0.5) * 100 });
  }

  const cuerpo = (
    <div
      className="relative size-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
      style={{ transform: `rotateX(${giro.x}deg) rotateY(${giro.y + (girada ? 180 : 0)}deg)` }}
    >
      <Cara src={frente} alt={alt} brillo={giro.brillo} vertical={vertical} alCargar={setVertical} />
      {dorso ? (
        <Cara src={dorso} alt={`${alt} (dorso)`} brillo={100 - giro.brillo} vertical={vertical} className="[transform:rotateY(180deg)]" />
      ) : null}
    </div>
  );

  const clase = cn("block [perspective:1000px]", vertical ? "mx-auto w-[63%]" : "w-full", className);
  const estilo = { aspectRatio: vertical ? 1 / PROPORCION_TARJETA : PROPORCION_TARJETA };
  const alSalir = () => setGiro({ x: 0, y: 0, brillo: 50 });

  if (!puedeGirar) {
    return (
      <div className={clase} style={estilo} onPointerMove={mover} onPointerLeave={alSalir}>
        {cuerpo}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(clase, "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4", vertical ? "rounded-[6.3%/4%]" : "rounded-[4%/6.3%]")}
      style={estilo}
      onPointerMove={mover}
      onPointerLeave={alSalir}
      onClick={() => setGirada((g) => !g)}
      aria-label={girada ? "Ver el frente" : "Ver el dorso"}
      aria-pressed={girada}
    >
      {cuerpo}
    </button>
  );
}

function Cara({
  src,
  alt,
  brillo,
  vertical,
  alCargar,
  className,
}: {
  src: string | null;
  alt: string;
  brillo: number;
  vertical: boolean;
  /** Avisa si la foto es más alta que ancha. */
  alCargar?: (vertical: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden [backface-visibility:hidden]",
        vertical ? "rounded-[6.3%/4%]" : "rounded-[4%/6.3%]",
        // Una foto vertical de banco ya trae la tarjeta con su sombra y fondo
        // transparente: se muestra entera, sin marco propio.
        vertical ? "" : "bg-papel-2 shadow-lg",
        className,
      )}
    >
      {src ? (
        // Fotos del bucket de Supabase o del banco: sin optimizador de Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("size-full", vertical ? "object-contain" : "object-cover")}
          draggable={false}
          onLoad={(e) => alCargar?.(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth)}
          // Si la foto ya estaba en caché, cargó antes de hidratar y onLoad no llega.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) alCargar?.(el.naturalHeight > el.naturalWidth);
          }}
        />
      ) : (
        <span className="text-humo-oscuro grid size-full place-items-center text-sm">Sin foto</span>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{
          background: `linear-gradient(105deg, transparent ${brillo - 30}%, rgb(255 255 255 / 0.45) ${brillo}%, transparent ${brillo + 30}%)`,
        }}
      />
    </div>
  );
}
