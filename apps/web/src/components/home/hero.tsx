"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { FUENTES } from "@tarjetazo/core";
import { useBilletera } from "@/lib/billetera";
import { PRODUCTO_POR_ID, nombreCorto } from "@/lib/marca";
import { ListaResultados, useBusqueda } from "./busqueda";
import { HeroLoop } from "./hero-loop";
import { PilaTarjetas } from "./pila-tarjetas";

export function Hero() {
  const { mis, misBancos, abrir } = useBilletera();
  const caja = useRef<HTMLDivElement>(null);
  const { q, setQ, resultados, buscar } = useBusqueda(caja);

  const etiquetaSelector =
    mis.length === 0
      ? "Elegí tus tarjetas"
      : mis.length === 1
        ? nombreCorto(PRODUCTO_POR_ID[mis[0]!]!)
        : `${mis.length} tarjetas`;

  return (
    <section style={{ background: "#14202c", color: "#fff", padding: "40px 20px 64px" }}>
      <div className="mx-auto flex max-w-[860px] flex-col items-center text-center">
        <div className="w-full max-w-[720px] overflow-hidden rounded-2xl">
          <HeroLoop />
        </div>
        <h1
          className="font-display max-w-[720px] text-pretty font-bold"
          style={{ margin: "-8px 0 0", fontSize: "clamp(32px, 4.2vw, 46px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
        >
          Pagá con la tarjeta que más te devuelve.
        </h1>

        <div ref={caja} className="relative mt-7 w-full max-w-[720px] text-left">
          <div
            className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white py-2 pl-5 pr-2.5 text-tinta sm:h-16 sm:flex-nowrap sm:py-0"
            style={{ boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}
          >
            <Search className="size-[22px] shrink-0 text-humo" strokeWidth={2} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="¿Dónde vas a pagar?"
              aria-label="¿Dónde vas a pagar?"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-lg outline-none"
            />
            <button
              type="button"
              onClick={() => abrir()}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] bg-papel px-3 text-sm font-medium text-tinta"
            >
              <PilaTarjetas bancos={misBancos} fondo="#f2efe7" ancho={24} alto={16} />
              {etiquetaSelector}
              <span className="text-xs text-humo" aria-hidden>
                ▾
              </span>
            </button>
            <button
              type="button"
              onClick={buscar}
              className="inline-flex h-[46px] shrink-0 cursor-pointer items-center rounded-[10px] bg-cielo px-[18px] text-[15px] font-medium text-white"
            >
              Buscar
            </button>
          </div>

          <ListaResultados
            resultados={resultados}
            className="absolute inset-x-0 top-[72px] z-20"
          />
        </div>

        <p className="mt-4 text-sm" style={{ color: "#b9c3cf" }}>
          Sin cuenta · sin pedirte el número · {FUENTES.length} bancos y billeteras
        </p>
      </div>
    </section>
  );
}
