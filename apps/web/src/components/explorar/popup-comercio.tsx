"use client";

import Link from "next/link";
import type { Route } from "next";
import { Send, X } from "lucide-react";
import type { BeneficioListado } from "@/lib/consultas";
import { colorFuente } from "@/lib/marca";
import { cifraDe } from "./panel-lista";

const ANCHO = 320;

/**
 * Ficha del comercio anclada al pin: va debajo si el pin está en la mitad
 * superior del mapa y arriba si no. Se clampa horizontalmente para no quedar
 * tapada por el panel de lista ni salirse del mapa, y la flecha sigue al pin.
 */
export function PopupComercio({
  comercio,
  beneficios,
  punto,
  area,
  minX,
  onCerrar,
  esParaVos,
  onAgregar,
}: {
  comercio: string;
  beneficios: BeneficioListado[];
  /** Posición del pin dentro del área del mapa, en píxeles. */
  punto: { x: number; y: number };
  area: { ancho: number; alto: number };
  /** Borde izquierdo libre (a la derecha del panel de lista). */
  minX: number;
  onCerrar: () => void;
  esParaVos: (b: BeneficioListado) => boolean;
  /** Abre la billetera en alta con el banco de esa fila preseleccionado. */
  onAgregar: (fuenteId: string) => void;
}) {
  const primero = beneficios[0];
  if (!primero) return null;

  const debajo = punto.y < area.alto * 0.45;
  const sinClamp = punto.x - ANCHO / 2;
  const izquierda = Math.max(minX, Math.min(sinClamp, area.ancho - ANCHO - 16));
  const flechaX = Math.max(16, Math.min(punto.x - izquierda, ANCHO - 16)) - 9;

  const ordenados = [...beneficios].sort(
    (a, b) => Number(esParaVos(b)) - Number(esParaVos(a)),
  );
  const c0 = colorFuente(primero.fuente_id);

  return (
    <div
      className="absolute z-30 rounded-[18px] bg-white p-4"
      style={{
        width: ANCHO,
        left: izquierda,
        top: debajo ? punto.y + 34 : undefined,
        bottom: debajo ? undefined : area.alto - punto.y + 34,
        boxShadow: "0 20px 50px rgba(20,32,44,.22)",
      }}
    >
      <span
        aria-hidden
        className="absolute size-[18px] rotate-45 bg-white"
        style={{
          left: flechaX,
          top: debajo ? -7 : undefined,
          bottom: debajo ? undefined : -7,
        }}
      />

      <div className="relative flex items-start gap-3">
        <span
          className="font-display inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-extrabold text-white"
          style={{ background: c0.color }}
          aria-hidden
        >
          {comercio.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[18px] font-bold">
            {comercio}
          </span>
          <span className="text-humo block text-[13px]">
            {primero.categoria} · {primero.n_sucursales}{" "}
            {primero.n_sucursales === 1 ? "local" : "locales"}
          </span>
        </span>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onCerrar}
          className="bg-papel inline-flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {ordenados.map((b) => {
          const tuya = esParaVos(b);
          const c = colorFuente(b.fuente_id);
          return (
            <div
              key={b.id}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
              style={
                tuya
                  ? { background: c.soft }
                  : { background: "#fff", border: "1px solid #e4e0d6" }
              }
            >
              <span
                className="inline-block h-[18px] w-[26px] shrink-0 rounded-[4px]"
                style={
                  tuya
                    ? { background: c.color }
                    : { border: `1.5px dashed ${c.color}` }
                }
              />
              <span
                className="num shrink-0 text-xl font-bold"
                style={{ color: tuya ? c.ink : "#6b7683" }}
              >
                {cifraDe(b)}
              </span>
              <span className="text-humo min-w-0 flex-1 truncate text-[13px]">
                {b.fuente_nombre}
              </span>
              {tuya ? (
                <span
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: c.ink }}
                >
                  ✓ La tuya
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAgregar(b.fuente_id)}
                  className="text-cielo shrink-0 text-xs font-semibold"
                >
                  Agregar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-linea mt-3 flex items-center justify-between border-t pt-3 text-[13px] font-medium">
        <span className="text-humo inline-flex items-center gap-1.5">
          <Send className="size-4" /> Cómo llegar
        </span>
        <Link
          href={`/comercio/${primero.comercio_key}` as Route}
          className="text-cielo"
        >
          Ver comercio →
        </Link>
      </div>
    </div>
  );
}
