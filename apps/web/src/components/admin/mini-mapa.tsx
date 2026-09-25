"use client";

import dynamic from "next/dynamic";
import type { PuntoMini } from "./mini-mapa-interno";

// Leaflet toca `window` al importarse: solo en el cliente.
const Interno = dynamic(() => import("./mini-mapa-interno"), {
  ssr: false,
  loading: () => <div className="bg-papel-1 border-linea h-72 w-full animate-pulse rounded-xl border" />,
});

export function MiniMapa({ puntos }: { puntos: PuntoMini[] }) {
  if (puntos.length === 0) {
    return (
      <div className="bg-papel-1 border-linea text-humo-oscuro grid h-40 w-full place-items-center rounded-xl border text-sm">
        Sin puntos para mostrar todavía.
      </div>
    );
  }
  return <Interno puntos={puntos} />;
}
