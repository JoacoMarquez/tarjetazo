"use client";

import Link from "next/link";
import { Search, User } from "lucide-react";
import { useBilletera } from "@/lib/billetera";
import { GRADIENTE, PRODUCTO_POR_ID } from "@/lib/marca";
import { PilaTarjetas } from "./pila-tarjetas";

const PIZARRA = "#2b3a4a";

/** Wordmark: "Tarjeta" en blanco y "zo" pintado con el gradiente de marca. */
export function Wordmark({ tamano = 22 }: { tamano?: number }) {
  return (
    <Link
      href="/"
      className="font-display inline-flex items-center font-extrabold text-white"
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
      className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-pill pl-2.5 pr-1.5 text-sm font-medium text-white"
      style={{ background: PIZARRA }}
    >
      <PilaTarjetas bancos={misBancos} fondo={PIZARRA} />
      <span className="max-w-40 truncate">{etiqueta}</span>
      <span
        className="pila-mas inline-flex size-7 items-center justify-center rounded-full text-base font-bold"
        style={{ backgroundImage: GRADIENTE, color: "#14202c", lineHeight: 1 }}
        aria-hidden
      >
        +
      </span>
    </button>
  );
}

const NAV = [
  { label: "Inicio", href: "/" },
  { label: "Explorar", href: "/app" },
  { label: "Comparar", href: "/comparar" },
] as const;

export function HeaderHome() {
  return (
    <header className="sticky top-0 z-30" style={{ background: "#14202c" }}>
      <div className="mx-auto flex max-w-[1120px] items-center gap-8 px-5 py-3">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-[15px] md:flex">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} className="link-marca font-medium text-white">
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center justify-end gap-2.5">
          <BotonBilletera />
          <Link
            href="/app"
            aria-label="Buscar"
            className="hidden size-10 items-center justify-center rounded-full text-white sm:inline-flex"
            style={{ background: PIZARRA }}
          >
            <Search className="size-[18px]" strokeWidth={2} />
          </Link>
          <Link
            href="/ayuda"
            aria-label="Ayuda"
            className="hidden size-10 items-center justify-center rounded-full text-white sm:inline-flex"
            style={{ background: PIZARRA }}
          >
            <User className="size-[18px]" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </header>
  );
}
