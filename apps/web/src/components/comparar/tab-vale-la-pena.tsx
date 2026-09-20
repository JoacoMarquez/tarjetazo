"use client";

import { useMemo, useState } from "react";
import { PRODUCTOS } from "@tarjetazo/core";
import { ChevronDown } from "lucide-react";
import {
  RUBROS_COMPARAR,
  ahorroDe,
  ahorroPropio,
  fmt,
  mejorOferta,
  type Matriz,
} from "@/lib/comparar-tarjetas";
import { PRODUCTO_POR_ID, colorFuente, nombreCorto } from "@/lib/marca";
import { ColumnaGasto } from "./columna-gasto";
import { MiniTarjeta } from "./tab-tarjetas";

/** Cuál de tus tarjetas es la mejor en ese rubro, y cuánto te ahorra. */
function mejorTuya(
  matriz: Matriz,
  mis: string[],
  rubro: string,
  dias: number[],
  gasto: number,
) {
  let mejor: { pid: string; ahorro: number; pct: number } | null = null;
  for (const pid of mis) {
    const o = mejorOferta(matriz, pid, rubro, dias);
    const a = ahorroDe(o, gasto);
    if (o && (!mejor || a > mejor.ahorro)) mejor = { pid, ahorro: a, pct: o.p };
  }
  return mejor;
}

export function TabValeLaPena({
  matriz,
  mis,
  dias,
  gasto,
  onGasto,
  onReset,
  candidata,
  onCandidata,
  onTarjetero,
}: {
  matriz: Matriz;
  mis: string[];
  dias: number[];
  gasto: Record<string, number>;
  onGasto: (rubro: string, v: number) => void;
  onReset: () => void;
  candidata: string | null;
  onCandidata: (pid: string) => void;
  onTarjetero: (pid: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");

  const pc = candidata ? PRODUCTO_POR_ID[candidata] : undefined;

  const filas = RUBROS_COMPARAR.map((r) => {
    const g = gasto[r.slug] ?? 0;
    const tuya = mejorTuya(matriz, mis, r.slug, dias, g);
    const oCand = candidata
      ? mejorOferta(matriz, candidata, r.slug, dias)
      : null;
    return {
      rubro: r,
      gasto: g,
      tuya,
      cand: oCand,
      ahorroCand: ahorroDe(oCand, g),
    };
  });

  const maxBarra = Math.max(
    1,
    ...filas.flatMap((f) => [f.tuya?.ahorro ?? 0, f.ahorroCand]),
  );
  const totalTuyo = filas.reduce((s, f) => s + (f.tuya?.ahorro ?? 0), 0);
  // Con la candidata te quedás con lo mejor de cada rubro, no con la suma.
  const totalCon = filas.reduce(
    (s, f) => s + Math.max(f.tuya?.ahorro ?? 0, f.ahorroCand),
    0,
  );
  const suma = totalCon - totalTuyo;
  const ganaEn = filas.filter(
    (f) => f.ahorroCand > (f.tuya?.ahorro ?? 0),
  ).length;
  const conviene = suma > 0;

  // Todas las que no tenés, ordenadas por lo que sumarían.
  const opciones = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return PRODUCTOS.filter((p) => !mis.includes(p.id))
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .map((p) => {
        const delta = RUBROS_COMPARAR.reduce((s, r) => {
          const g = gasto[r.slug] ?? 0;
          const propio = ahorroPropio(matriz, mis, r.slug, dias, g);
          const suyo = ahorroDe(mejorOferta(matriz, p.id, r.slug, dias), g);
          return s + Math.max(0, suyo - propio);
        }, 0);
        return { p, delta };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [q, mis, matriz, dias, gasto]);

  return (
    <div className="flex gap-3.5">
      <ColumnaGasto
        gasto={gasto}
        onGasto={onGasto}
        onReset={onReset}
        subtitulo="Movelo para ver cuánto sumaría la candidata."
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div
          className="overflow-hidden rounded-[18px] bg-white"
          style={{ border: "2px solid #e4e0d6" }}
        >
          <div className="bg-papel h-1.5" />

          <div
            className="grid h-[146px] items-center gap-3 px-4"
            style={{ gridTemplateColumns: "1fr 150px 1fr" }}
          >
            <div className="flex items-center gap-2.5">
              <MiniTarjeta
                fuenteId={
                  mis[0]
                    ? (PRODUCTO_POR_ID[mis[0]]?.fuente_id ?? "brou")
                    : "brou"
                }
                tuya
                ancho={40}
                alto={27}
              />
              <div className="min-w-0">
                <p className="font-display m-0 text-[17px] font-bold">
                  Tus tarjetas
                </p>
                <p className="text-humo m-0 text-[13px]">
                  {mis.length} tarjeta{mis.length === 1 ? "" : "s"} ·{" "}
                  <strong className="text-tinta">{fmt(totalTuyo)}/mes</strong>
                </p>
              </div>
            </div>

            <p className="font-display text-humo-claro m-0 text-center text-[18px] font-extrabold">
              vs
            </p>

            <div className="relative flex items-center justify-end gap-2.5">
              {pc && (
                <MiniTarjeta
                  fuenteId={pc.fuente_id}
                  tuya={false}
                  ancho={40}
                  alto={27}
                />
              )}
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setAbierto((v) => !v)}
                  aria-expanded={abierto}
                  className="flex h-[34px] items-center gap-1.5"
                >
                  <span className="font-display truncate text-[17px] font-bold">
                    {pc ? nombreCorto(pc) : "Elegí una tarjeta"}
                  </span>
                  <ChevronDown className="size-4 shrink-0" />
                </button>
                <p className="text-humo m-0 text-[13px]">Candidata</p>
              </div>

              {abierto && (
                <div
                  className="bg-tinta absolute top-full right-0 z-30 mt-1 flex max-h-80 w-[340px] flex-col rounded-[14px] p-2 text-white"
                  style={{ boxShadow: "0 20px 50px rgba(20,32,44,.35)" }}
                >
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar"
                    aria-label="Buscar una tarjeta"
                    className="bg-pizarra h-9 shrink-0 rounded-[10px] px-3 text-[13px] text-white outline-none placeholder:text-[#8a97a6]"
                  />
                  <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
                    {opciones.map(({ p, delta }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onCandidata(p.id);
                          setAbierto(false);
                        }}
                        className="flex h-10 w-full items-center gap-2 rounded-lg px-1.5 text-left hover:bg-white/10"
                      >
                        <MiniTarjeta
                          fuenteId={p.fuente_id}
                          tuya={false}
                          ancho={22}
                          alto={15}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {p.nombre}
                        </span>
                        <span
                          className="num shrink-0 text-[12px] font-bold"
                          style={{
                            color:
                              delta > 0
                                ? "#0fae9c"
                                : delta < 0
                                  ? "#f6c2b9"
                                  : "#8a97a6",
                          }}
                        >
                          {delta > 0 ? `+${fmt(delta)}` : fmt(delta)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {filas.map((f) => {
            const aTuya = f.tuya?.ahorro ?? 0;
            const pierde = f.ahorroCand > aTuya;
            const ptuya = f.tuya ? PRODUCTO_POR_ID[f.tuya.pid] : undefined;
            const cc = pc ? colorFuente(pc.fuente_id) : null;
            return (
              <div
                key={f.rubro.slug}
                className="border-linea grid h-[59px] items-center gap-3 border-t px-4"
                style={{ gridTemplateColumns: "1fr 150px 1fr" }}
              >
                {/* tuya: barra hacia la izquierda */}
                <div className="flex items-center justify-end gap-2">
                  <div className="min-w-0 text-right">
                    <span className="num block text-[14px] font-bold">
                      {fmt(aTuya)}
                    </span>
                    <span className="text-humo block truncate text-[11px]">
                      {ptuya
                        ? `${nombreCorto(ptuya)} · ${f.tuya!.pct}%`
                        : "Sin beneficio"}
                    </span>
                  </div>
                  <span
                    className="h-[18px] shrink-0"
                    style={{
                      width: `${(aTuya / maxBarra) * 100}%`,
                      maxWidth: 110,
                      borderRadius: "5px 0 0 5px",
                      background: pierde ? "#d3d8de" : "#14202c",
                      transition: "width .35s cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                </div>

                <div className="text-center">
                  <span className="block text-[13px] font-semibold">
                    {f.rubro.label}
                  </span>
                  <span className="text-humo num block text-[11px]">
                    {fmt(f.gasto)}
                  </span>
                </div>

                {/* candidata: barra hacia la derecha */}
                <div className="flex items-center gap-2">
                  <span
                    className="h-[18px] shrink-0"
                    style={{
                      width: `${(f.ahorroCand / maxBarra) * 100}%`,
                      maxWidth: 110,
                      borderRadius: "0 5px 5px 0",
                      background: !cc
                        ? "#eeebe3"
                        : pierde
                          ? cc.color
                          : f.cand
                            ? cc.soft
                            : "#eeebe3",
                      transition: "width .35s cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                  <div className="min-w-0">
                    <span className="num block text-[14px] font-bold">
                      {fmt(f.ahorroCand)}
                    </span>
                    <span className="text-humo block truncate text-[11px]">
                      {f.cand
                        ? `${pc ? nombreCorto(pc) : ""} · ${f.cand.p}%`
                        : "Sin beneficio"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {pc && (
          <div
            className="flex flex-wrap items-center gap-4 rounded-[18px] px-5 py-4 text-white"
            style={{ background: conviene ? "#0a7267" : "#9c2f1e" }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-display m-0 text-[24px] font-extrabold">
                {conviene ? "Sí, te conviene" : "No hace falta"}
              </p>
              <p className="m-0 mt-1 text-[13px] opacity-90">
                {conviene
                  ? `Sumaría ${fmt(suma)} por mes en ${ganaEn} categoría${ganaEn === 1 ? "" : "s"}, con el gasto que marcaste.`
                  : "Tus tarjetas ya cubren igual o mejor todas las categorías con el gasto que marcaste."}
              </p>
            </div>
            <div className="flex shrink-0 gap-6">
              <div>
                <p className="m-0 text-[11px] tracking-[.08em] uppercase opacity-75">
                  Hoy ahorrás
                </p>
                <p className="num m-0 text-[22px] font-bold">
                  {fmt(totalTuyo)}
                </p>
              </div>
              <div>
                <p className="m-0 text-[11px] tracking-[.08em] uppercase opacity-75">
                  Con ella
                </p>
                <p className="num m-0 text-[22px] font-bold">{fmt(totalCon)}</p>
              </div>
            </div>
            {conviene && (
              <button
                type="button"
                onClick={() => onTarjetero(pc.id)}
                className="text-tinta h-10 shrink-0 rounded-[10px] bg-white px-4 text-[14px] font-bold"
              >
                Sumar a mi billetera
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
