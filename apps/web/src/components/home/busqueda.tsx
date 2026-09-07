"use client";

import { useEffect, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS } from "@tarjetazo/core";
import type { ResultadoBusqueda } from "@/lib/consultas";
import { useBilletera } from "@/lib/billetera";

const LABEL_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.slug, c.label]));

function cifra(r: ResultadoBusqueda): string {
  if (r.best_pct != null) return `${Math.round(r.best_pct)}%`;
  if (r.max_cuotas) return `${r.max_cuotas}c`;
  return "—";
}

/**
 * El buscador "¿dónde vas a pagar?", compartido por el hero y la lupa del
 * header: texto, resultados de `/api/buscar` y el salto a /app con Enter.
 */
export function useBusqueda(caja: RefObject<HTMLElement | null>) {
  const router = useRouter();
  const { misBancos } = useBilletera();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);

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
  }, [caja]);

  const buscar = () => {
    const texto = q.trim();
    router.push(texto ? `/app?q=${encodeURIComponent(texto)}` : "/app");
  };

  return { q, setQ, resultados, buscar };
}

/** El dropdown de comercios: nombre, con qué conviene pagar y la cifra. */
export function ListaResultados({
  resultados,
  className,
}: {
  resultados: ResultadoBusqueda[];
  className?: string;
}) {
  if (resultados.length === 0) return null;
  return (
    <ul
      className={`border-linea m-0 list-none rounded-2xl border bg-white p-1.5 text-tinta shadow-[0_12px_32px_rgba(20,32,44,.12)] ${className ?? ""}`}
    >
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
  );
}
