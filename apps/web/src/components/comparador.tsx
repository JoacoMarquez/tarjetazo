"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Info } from "lucide-react";
import { Departamento } from "@tarjetazo/core";
import { LinkSaliente } from "@/components/link-saliente";
import { RUBROS, type Ranking } from "@/lib/comparar";
import { capturar } from "@/lib/analitica";
import { cn } from "@/lib/utils";

const LABEL_RUBRO = new Map(RUBROS.map((r) => [r.slug, r.label]));
const DEPTOS = Departamento.options;

function alternar(xs: string[], x: string) {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

export function Comparador() {
  const router = useRouter();
  const params = useSearchParams();
  const categorias = useMemo(() => (params.get("cat") ?? "").split(",").filter(Boolean), [params]);
  const depto = params.get("depto") ?? "";

  const [ranking, setRanking] = useState<Ranking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  function actualizar(cats: string[], d: string) {
    const p = new URLSearchParams();
    if (cats.length) p.set("cat", cats.join(","));
    if (d) p.set("depto", d);
    router.replace(`/comparar?${p}`, { scroll: false });
    capturar("filtro_aplicado", { donde: "comparar", rubros: cats.length, depto: d || null });
  }

  useEffect(() => {
    const control = new AbortController();
    setError(null);
    fetch(`/api/comparar?${params}`, { signal: control.signal })
      .then((r) => r.json())
      .then((d: { ranking?: Ranking[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRanking(d.ranking ?? []);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError("No pudimos armar la comparación.");
      });
    return () => control.abort();
  }, [params]);

  const maximo = ranking?.[0]?.puntos || 1;

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">¿En qué gastás?</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {RUBROS.map((r) => {
            const activo = categorias.includes(r.slug);
            return (
              <li key={r.slug}>
                <button
                  type="button"
                  aria-pressed={activo}
                  onClick={() => actualizar(alternar(categorias, r.slug), depto)}
                  className={cn(
                    "rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
                    activo ? "border-cielo-ln bg-cielo-s text-cielo-ink" : "border-linea bg-card text-humo hover:bg-secondary",
                  )}
                >
                  {r.label}
                </button>
              </li>
            );
          })}
        </ul>
        <label className="text-humo mt-4 flex items-center gap-2 text-sm">
          Departamento
          <select
            value={depto}
            onChange={(e) => actualizar(categorias, e.target.value)}
            className="border-linea bg-card h-9 rounded-md border px-2 text-sm"
          >
            <option value="">Todo el país</option>
            {DEPTOS.map((d) => (
              <option key={d} value={d}>{d.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        </label>
        {categorias.length === 0 && (
          <p className="text-humo mt-2 text-xs">Sin rubros elegidos, la comparación es sobre todos los beneficios.</p>
        )}
      </section>

      <section>
        <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Ranking</h2>
        {error && <p className="border-coral-ln bg-coral-s text-coral-ink mt-3 rounded-md border px-3 py-2 text-sm">{error}</p>}
        {!ranking && !error && <div className="bg-papel mt-3 h-40 animate-pulse rounded-lg" />}
        {ranking && ranking.length === 0 && (
          <p className="text-humo mt-3 text-sm">Ninguna fuente publica beneficios con esos filtros.</p>
        )}
        <ol className="mt-3 space-y-3">
          {ranking?.map((r, i) => (
            <li key={r.fuente_id} className="border-linea bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">
                    <span className="text-humo mr-2 text-sm">{i + 1}.</span>
                    <Link href={`/banco/${r.fuente_id}`} className="hover:text-cielo hover:underline">{r.fuente_nombre}</Link>
                  </p>
                  <p className="text-humo text-xs">
                    {r.n_beneficios} beneficios en {r.n_comercios} comercios
                    {r.mejor_pct != null && ` · hasta ${Math.round(r.mejor_pct)}%`}
                  </p>
                </div>
                <span className="num text-cielo text-2xl font-bold">{r.puntos.toLocaleString("es-UY")}</span>
              </div>
              <div className="bg-papel mt-3 h-2 overflow-hidden rounded-pill">
                <div className="bg-marca h-full rounded-pill" style={{ width: `${Math.max(4, (r.puntos / maximo) * 100)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <button type="button" className="text-cielo inline-flex items-center gap-1 underline underline-offset-4" onClick={() => setAbierto(abierto === r.fuente_id ? null : r.fuente_id)}>
                  <Info className="size-3.5" /> {abierto === r.fuente_id ? "Ocultar el porqué" : "¿Por qué este puntaje?"}
                </button>
                <LinkSaliente href={r.url} fuente={r.fuente_id} desde="comparar" className="text-humo inline-flex items-center gap-1 underline underline-offset-4">
                  Ver en el sitio de {r.fuente_nombre} <ExternalLink className="size-3" />
                </LinkSaliente>
              </div>
              {abierto === r.fuente_id && (
                <table className="mt-3 w-full text-xs">
                  <thead className="text-humo">
                    <tr className="text-left"><th className="py-1 font-medium">Rubro</th><th className="font-medium">Benef.</th><th className="font-medium">Comercios</th><th className="font-medium">Mejor %</th><th className="font-medium">Sin tope</th><th className="font-medium">Todos los días</th><th className="text-right font-medium">Puntos</th></tr>
                  </thead>
                  <tbody>
                    {r.rubros.map((f) => (
                      <tr key={f.categoria} className="border-linea border-t">
                        <td className="py-1">{LABEL_RUBRO.get(f.categoria) ?? f.categoria}</td>
                        <td className="num">{f.n_beneficios}</td>
                        <td className="num">{f.n_comercios}</td>
                        <td className="num">{f.mejor_pct != null ? `${Math.round(f.mejor_pct)}%` : "—"}</td>
                        <td className="num">{Number(f.n_beneficios) - Number(f.con_tope)}</td>
                        <td className="num">{f.todos_los_dias}</td>
                        <td className="num text-right font-semibold">{Number(f.puntos).toLocaleString("es-UY")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-linea bg-card rounded-lg border p-4 text-sm">
        <h2 className="font-display text-base font-bold">Cómo se calcula</h2>
        <p className="text-humo mt-2">
          Cada beneficio vigente de los rubros elegidos suma <strong>valor × días × tope</strong>:
        </p>
        <ul className="text-humo mt-2 list-disc space-y-1 pl-5">
          <li><strong>valor</strong>: el porcentaje de descuento o reintegro (25% = 0,25); las cuotas valen cuotas/12 × 0,6, porque financiar no es ahorrar; un 2x1 vale 0,5.</li>
          <li><strong>días</strong>: la fracción de la semana en que aplica (solo martes y jueves = 2/7).</li>
          <li><strong>tope</strong>: 0,85 si tiene tope de monto, 1 si no.</li>
        </ul>
        <p className="text-humo mt-2">
          Es una medida de cuánto y qué tan bueno publica cada fuente, no de cuánto vas a ahorrar vos: eso depende de dónde compres y con qué tarjeta. No mide costos de la tarjeta, intereses ni atención.
        </p>
      </section>
    </div>
  );
}
