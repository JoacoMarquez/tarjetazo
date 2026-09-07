"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MejorDelRubro } from "@/lib/stats";
import { useBilletera } from "@/lib/billetera";
import { CANASTA_SEMANAL, PASOS } from "@/lib/contenido-home";
import { tarjetaSugerida } from "@/lib/formato";
import { GRADIENTE } from "@/lib/marca";

/**
 * Ahorro mensual estimado: el porcentaje real de hoy en super, combustible y
 * delivery aplicado a una canasta semanal supuesta, cuatro veces al mes y
 * respetando el tope que publica cada beneficio. Solo cuenta lo que se puede
 * pagar con las tarjetas que el usuario tiene.
 */
function estimar(rubros: MejorDelRubro[], mis: string[]): number {
  let total = 0;
  for (const { slug, beneficio } of rubros) {
    const canasta = CANASTA_SEMANAL[slug];
    if (!canasta || beneficio.porcentaje == null) continue;
    if (!tarjetaSugerida(beneficio, mis).laTengo) continue;
    const porSemana = (canasta * beneficio.porcentaje) / 100;
    const mensual = porSemana * 4;
    total += beneficio.tope_periodo === "mes" && beneficio.tope_monto
      ? Math.min(mensual, beneficio.tope_monto)
      : mensual;
  }
  return Math.round(total);
}

/**
 * Contador animado. Cuando cambia el destino (agregaste o sacaste una tarjeta)
 * va del valor que estaba mostrando al nuevo, para que se vea qué cambió. Con
 * `replay()` arranca de cero, que es el efecto "cae la plata" del hover.
 */
function useConteo(destino: number, ms = 1400) {
  const [v, setV] = useState(0);
  const actual = useRef(0);
  const raf = useRef(0);

  const animar = useCallback(
    (desde: number) => {
      cancelAnimationFrame(raf.current);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        actual.current = destino;
        setV(destino);
        return;
      }
      const t0 = performance.now();
      const paso = (ahora: number) => {
        const p = Math.min(1, (ahora - t0) / ms);
        const valor = Math.round(desde + (destino - desde) * (1 - Math.pow(1 - p, 3)));
        actual.current = valor;
        setV(valor);
        if (p < 1) raf.current = requestAnimationFrame(paso);
      };
      raf.current = requestAnimationFrame(paso);
    },
    [destino, ms],
  );

  useEffect(() => {
    animar(actual.current);
    return () => cancelAnimationFrame(raf.current);
  }, [animar]);

  return { valor: v, replay: () => animar(0) };
}

export function ComoFunciona({ rubros }: { rubros: MejorDelRubro[] }) {
  const { mis, abrir } = useBilletera();
  const { valor: ahorro, replay } = useConteo(estimar(rubros, mis));

  return (
    <section
      className="mt-18 grid items-center gap-8 rounded-[20px] bg-papel p-8"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
    >
      <div>
        <h2 className="font-display m-0 text-[26px] font-bold tracking-tight">Cómo funciona</h2>
        <ol className="m-0 mt-5 flex list-none flex-col gap-4 p-0">
          {PASOS.map((p) => (
            <li key={p.n} className="flex gap-3.5">
              <span className="num flex size-8 flex-none items-center justify-center rounded-full bg-tinta text-sm font-bold text-white">
                {p.n}
              </span>
              <div>
                <h3 className="font-display mt-1 text-base font-bold">{p.titulo}</h3>
                <p className="mt-1 text-sm leading-normal text-humo">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div
        className="rounded-2xl p-7 text-center text-white"
        style={{ background: "#14202c" }}
        onMouseEnter={replay}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-[.1em]" style={{ color: "#b9c3cf" }}>
          Ahorro estimado por mes
        </p>
        <p
          className="num m-0 mt-2.5 text-[60px] font-bold leading-none"
          style={{
            backgroundImage: GRADIENTE,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          $ {ahorro.toLocaleString("es-UY")}
        </p>
        <p className="m-0 mt-3 text-sm leading-normal" style={{ color: "#b9c3cf" }}>
          {mis.length === 0 ? (
            <>Agregá tus tarjetas y calculamos cuánto te ahorrás con lo que hay hoy.</>
          ) : (
            <>
              Con tus {mis.length} {mis.length === 1 ? "tarjeta" : "tarjetas"}, usando el mejor
              beneficio en super, combustible y delivery una vez por semana.
            </>
          )}
        </p>
        {mis.length === 0 ? (
          <button
            type="button"
            onClick={() => abrir({ agregar: true })}
            className="mt-4.5 inline-flex h-11 cursor-pointer items-center rounded-[10px] bg-sol px-[18px] text-[15px] font-semibold text-tinta"
          >
            Elegir mis tarjetas
          </button>
        ) : (
          <Link
            href="/app?mias=1"
            className="mt-4.5 inline-flex h-11 items-center rounded-[10px] bg-sol px-[18px] text-[15px] font-semibold text-tinta"
          >
            Ver mis beneficios
          </Link>
        )}
      </div>
    </section>
  );
}
