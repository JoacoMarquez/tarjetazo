"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useBilletera } from "@/lib/billetera";
import { BotonCuenta } from "./boton-cuenta";
import { GRADIENTE, PRODUCTO_POR_ID } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { ListaResultados, useBusqueda } from "./home/busqueda";
import { PilaTarjetas } from "./home/pila-tarjetas";

const PIZARRA = "#2b3a4a";

/** Wordmark: "Tarjeta" en blanco y "zo" pintado con el gradiente de marca. */
export function Wordmark({ tamano = 22 }: { tamano?: number }) {
  return (
    <Link
      href="/"
      className="font-display inline-flex shrink-0 items-center font-extrabold text-white"
      style={{ fontSize: tamano, lineHeight: 1, letterSpacing: "-0.03em" }}
    >
      Tarjeta
      <span
        style={{
          backgroundImage: GRADIENTE,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        zo
      </span>
    </Link>
  );
}

/** El botón que abre la billetera: pila de mini tarjetas + cuántas tenés. */
export function BotonBilletera() {
  const { mis, misBancos, abrir } = useBilletera();
  const etiqueta =
    mis.length === 0
      ? "Mis tarjetas"
      : mis.length === 1
        ? (PRODUCTO_POR_ID[mis[0]!]?.nombre ?? "1 tarjeta")
        : `${mis.length} tarjetas`;

  return (
    <button
      type="button"
      data-abanico
      onClick={() => abrir()}
      aria-label={etiqueta}
      className="inline-flex h-10 min-w-0 cursor-pointer items-center gap-2.5 rounded-pill pl-2.5 pr-1.5 text-sm font-medium text-white"
      style={{ background: PIZARRA }}
    >
      <PilaTarjetas bancos={misBancos} fondo={PIZARRA} />
      {/* En el celular no entra junto a la lupa y la cuenta, y la barra de abajo ya dice "Mis tarjetas". */}
      <span className="hidden min-w-0 max-w-40 truncate sm:inline">{etiqueta}</span>
      <span
        className="pila-mas inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base font-bold"
        style={{ backgroundImage: GRADIENTE, color: "#14202c", lineHeight: 1 }}
        aria-hidden
      >
        +
      </span>
    </button>
  );
}

/**
 * La lupa del header. Cerrada es un círculo; al tocarla se estira hacia la
 * izquierda y deja escribir ahí mismo, con el mismo dropdown que el hero.
 * Escape o un clic afuera la vuelven a cerrar. En el celular no hay lugar al
 * lado: abierta ocupa todo el ancho del header, por encima del resto.
 */
function BuscadorHeader() {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { q, setQ, resultados, buscar } = useBusqueda(caja);

  useEffect(() => {
    if (!abierto) return;
    input.current?.focus();
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div
      ref={caja}
      className={cn(
        "relative",
        abierto && "max-sm:fixed max-sm:inset-x-3 max-sm:top-3 max-sm:z-50",
      )}
    >
      <div
        className={cn(
          "flex h-10 items-center overflow-hidden rounded-pill text-white transition-[width] duration-300",
          abierto ? "w-full sm:w-[260px]" : "w-10",
        )}
        style={{ background: PIZARRA, transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)" }}
      >
        <button
          type="button"
          aria-label={abierto ? "Buscar" : "Abrir el buscador"}
          aria-expanded={abierto}
          onClick={() => (abierto ? buscar() : setAbierto(true))}
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center"
        >
          <Search className="size-[18px]" strokeWidth={2} />
        </button>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="¿Dónde vas a pagar?"
          aria-label="¿Dónde vas a pagar?"
          tabIndex={abierto ? 0 : -1}
          className="h-full min-w-0 flex-1 border-0 bg-transparent pr-4 text-sm text-white outline-none placeholder:text-[#b9c3cf]"
          style={{ opacity: abierto ? 1 : 0, transition: "opacity .2s" }}
        />
        {abierto && (
          <button
            type="button"
            aria-label="Cerrar el buscador"
            onClick={() => setAbierto(false)}
            className="inline-flex size-10 shrink-0 items-center justify-center sm:hidden"
          >
            <X className="size-[18px]" strokeWidth={2} />
          </button>
        )}
      </div>
      {abierto && (
        <ListaResultados
          resultados={resultados}
          className="absolute right-0 top-12 z-40 w-[340px] max-sm:w-full"
        />
      )}
    </div>
  );
}

const NAV = [
  { label: "Inicio", href: "/" },
  { label: "Explorar", href: "/app" },
  { label: "Tarjetas", href: "/tarjetas" },
  { label: "Comparar", href: "/comparar" },
  { label: "Favoritos", href: "/favoritos" },
] as const;

/**
 * Header común de Home, Explorar y Comparar. La pestaña activa va en blanco
 * 600 con un subrayado de 2px pintado con el gradiente de marca; las demás en
 * humo-claro y se pintan con el gradiente al pasar por encima.
 */
export function EncabezadoSitio() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-30" style={{ background: "#14202c" }}>
      <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 py-3 sm:px-5 md:gap-8">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-[15px] md:flex">
          {NAV.map((i) => {
            const activo = i.href === "/" ? ruta === "/" : ruta.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={activo ? "page" : undefined}
                className={
                  activo
                    ? "border-b-2 border-transparent pb-0.5 font-semibold text-white"
                    : "link-marca text-humo-claro font-medium"
                }
                style={
                  activo
                    ? { borderImage: `${GRADIENTE} 1`, borderImageSlice: 1 }
                    : undefined
                }
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
          <BotonBilletera />
          <BuscadorHeader />
          <BotonCuenta />
        </div>
      </div>
    </header>
  );
}
