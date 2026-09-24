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
      <Cara src={frente} alt={alt} brillo={giro.brillo} />
      {dorso ? (
        <Cara src={dorso} alt={`${alt} (dorso)`} brillo={100 - giro.brillo} className="[transform:rotateY(180deg)]" />
      ) : null}
    </div>
  );

  const clase = cn("block w-full [perspective:1000px]", className);
  const estilo = { aspectRatio: PROPORCION_TARJETA };
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
      className={cn(clase, "cursor-pointer rounded-[4%/6.3%] focus-visible:outline-2 focus-visible:outline-offset-4")}
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
  className,
}: {
  src: string | null;
  alt: string;
  brillo: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-papel-2 absolute inset-0 overflow-hidden rounded-[4%/6.3%] shadow-lg [backface-visibility:hidden]",
        className,
      )}
    >
      {src ? (
        // Fotos del bucket de Supabase o del banco: sin optimizador de Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" draggable={false} />
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
