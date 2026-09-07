"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CATEGORIAS, FUENTES } from "@tarjetazo/core";
import type { ResultadoBusqueda } from "@/lib/consultas";
import { useBilletera } from "@/lib/billetera";
import { PRODUCTO_POR_ID, nombreCorto } from "@/lib/marca";
import { HeroLoop } from "./hero-loop";
import { PilaTarjetas } from "./pila-tarjetas";

const LABEL_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.slug, c.label]));

function cifra(r: ResultadoBusqueda): string {
  if (r.best_pct != null) return `${Math.round(r.best_pct)}%`;
  if (r.max_cuotas) return `${r.max_cuotas}c`;
  return "—";
}

export function Hero() {
  const router = useRouter();
  const { mis, misBancos, abrir } = useBilletera();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const caja = useRef<HTMLDivElement>(null);

  // Desde dos caracteres consultamos el buscador; el debounce evita una
  // llamada por tecla y el AbortController descarta las respuestas viejas.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: texto });
        if (misBancos.length) params.set("bancos", misBancos.join(","));
        const r = await fetch(`/api/buscar?${params}`, { signal: ctrl.signal });
        const json = (await r.json()) as { resultados?: ResultadoBusqueda[] };
        setResultados((json.resultados ?? []).slice(0, 4));
      } catch {
        // Abortos y errores de red: el dropdown simplemente no aparece.
      }
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, misBancos]);

  // Un clic fuera de la caja cierra el dropdown de resultados.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setResultados([]);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const etiquetaSelector =
    mis.length === 0
      ? "Elegí tus tarjetas"
      : mis.length === 1
        ? nombreCorto(PRODUCTO_POR_ID[mis[0]!]!)
        : `${mis.length} tarjetas`;

  const buscar = () => {
    const texto = q.trim();
    router.push(texto ? `/app?q=${encodeURIComponent(texto)}` : "/app");
  };

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

          {resultados.length > 0 && (
            <ul className="border-linea absolute inset-x-0 top-[72px] z-20 m-0 list-none rounded-2xl border bg-white p-1.5 text-tinta shadow-[0_12px_32px_rgba(20,32,44,.12)]">
              {resultados.map((r) => (
                <li key={r.comercio_key}>
                  <a
                    href={`/comercio/${r.comercio_key}`}
                    className="hover:bg-papel flex items-center justify-between gap-3 rounded-[10px] px-3.5 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{r.comercio}</span>
                      <span className="block text-[13px] text-humo">
                        Te conviene {r.mejor_fuente} · {LABEL_CATEGORIA[r.categoria] ?? r.categoria}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xl font-bold text-cielo">{cifra(r)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-sm" style={{ color: "#b9c3cf" }}>
          Sin cuenta · sin pedirte el número · {FUENTES.length} bancos y billeteras
        </p>
      </div>
    </section>
  );
}
