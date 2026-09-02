"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ResultadoBusqueda } from "@/lib/consultas";

/**
 * "¿Dónde vas a pagar?": el usuario escribe un comercio y le decimos con cuál
 * de sus tarjetas conviene.
 */
export function Buscador({
  params,
  onElegir,
}: {
  params: URLSearchParams;
  onElegir: (r: ResultadoBusqueda) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    const control = new AbortController();
    // Esperamos a que deje de tipear: una consulta por tecla no sirve a nadie.
    const t = setTimeout(async () => {
      const url = new URLSearchParams(params);
      url.set("q", q.trim());
      try {
        const res = await fetch(`/api/buscar?${url}`, { signal: control.signal });
        const datos = (await res.json()) as { resultados?: ResultadoBusqueda[] };
        setResultados(datos.resultados ?? []);
        setAbierto(true);
      } catch {
        // Búsqueda cancelada o caída: dejamos lo que había.
      }
    }, 250);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [q, params]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  return (
    <div ref={caja} className="relative">
      <Search className="text-humo pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        placeholder="¿Dónde vas a pagar?"
        aria-label="Buscar comercio"
        className="border-linea bg-card focus-visible:ring-ring h-10 w-full rounded-md border pl-9 pr-3 text-sm outline-none focus-visible:ring-2"
      />
      {abierto && resultados.length > 0 && (
        <ul className="border-linea bg-card absolute z-1000 mt-1 w-full overflow-hidden rounded-md border shadow-lg">
          {resultados.map((r) => (
            <li key={r.comercio_key}>
              <button
                type="button"
                onClick={() => {
                  onElegir(r);
                  setAbierto(false);
                }}
                className="hover:bg-secondary flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.comercio}</span>
                  <span className="text-humo block truncate text-xs">
                    {r.mejor_fuente} · {r.mejor_titulo}
                  </span>
                </span>
                {r.best_pct != null && (
                  <span className="num text-cielo shrink-0 text-lg font-bold">
                    {Math.round(r.best_pct)}%
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
