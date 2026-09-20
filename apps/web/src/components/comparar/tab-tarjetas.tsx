"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  RUBROS_COMPARAR,
  construirColumnas,
  candidatas,
  fmt,
  type Matriz,
} from "@/lib/comparar-tarjetas";
import { PRODUCTO_POR_ID, colorFuente, nombreCorto } from "@/lib/marca";
import { ColumnaGasto } from "./columna-gasto";

const SUAVE = "cubic-bezier(.2,.8,.2,1)";

/**
 * Reordena las columnas con FLIP: se mide dónde estaba cada una, se la deja
 * donde estaba y se la suelta. Sin esto el reordenamiento por total sería un
 * salto seco cada vez que se mueve un slider.
 */
function useFlip(orden: string[]) {
  const refs = useRef(new Map<string, HTMLElement>());
  const previas = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    for (const [id, el] of refs.current) {
      const x = el.getBoundingClientRect().left;
      const antes = previas.current.get(id);
      if (antes != null && antes !== x) {
        el.style.transition = "none";
        el.style.transform = `translateX(${antes - x}px)`;
        // Forzar el reflow antes de soltar: si no, el navegador junta los dos
        // estilos en uno solo y no hay animación.
        void el.offsetWidth;
        el.style.transition = `transform .42s ${SUAVE}`;
        el.style.transform = "";
      }
      previas.current.set(id, x);
    }
  }, [orden]);

  return (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };
}

/** Contador que corre hasta el valor nuevo en vez de saltar. */
function useContador(valor: number, ms = 380) {
  const [v, setV] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    const inicio = performance.now();
    const de = desde.current;
    let raf = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / ms);
      // easeOutCubic
      const e = 1 - Math.pow(1 - k, 3);
      setV(de + (valor - de) * e);
      if (k < 1) raf = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, ms]);
  return v;
}

function MiniTarjeta({
  fuenteId,
  tuya,
  ancho = 30,
  alto = 20,
}: {
  fuenteId: string;
  tuya: boolean;
  ancho?: number;
  alto?: number;
}) {
  const c = colorFuente(fuenteId).color;
  return (
    <span
      className="inline-block shrink-0 rounded-[4px]"
      style={{
        width: ancho,
        height: alto,
        ...(tuya ? { background: c } : { border: `1.5px dashed ${c}` }),
      }}
    />
  );
}

function ColumnaTarjeta({
  pid,
  celdas,
  total,
  gana,
  mejor,
  delta,
  mis,
  onQuitar,
}: {
  pid: string;
  celdas: ReturnType<typeof construirColumnas>[number]["celdas"];
  total: number;
  gana: number;
  mejor: boolean;
  delta: number;
  mis: string[];
  onQuitar: () => void;
}) {
  const p = PRODUCTO_POR_ID[pid];
  const animado = useContador(total);
  if (!p) return null;
  const c = colorFuente(p.fuente_id);
  const tuya = mis.includes(pid);

  return (
    <div
      className="w-[250px] shrink-0 overflow-hidden rounded-[18px] bg-white"
      style={{
        border: `2px solid ${mejor ? "#f7b500" : "transparent"}`,
        scrollSnapAlign: "start",
        boxShadow: "0 4px 14px rgba(20,32,44,.06)",
      }}
    >
      <div className="h-1.5" style={{ background: c.color }} />

      <div className="flex h-[146px] flex-col justify-center px-3.5">
        <div className="flex items-center gap-2">
          <MiniTarjeta fuenteId={p.fuente_id} tuya={tuya} />
          <span className="text-humo min-w-0 flex-1 truncate text-[12px]">
            {tuya ? "La tuya" : `${p.instrumento} · no la tenés`}
          </span>
          {mejor && (
            <span className="bg-sol text-tinta shrink-0 rounded-[4px] px-1 text-[10px] font-bold tracking-[.06em] uppercase">
              Más rinde
            </span>
          )}
          <button
            type="button"
            aria-label={`Sacar ${p.nombre} de la comparación`}
            onClick={onQuitar}
            className="text-humo hover:text-tinta shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="font-display m-0 mt-1.5 truncate text-[19px] font-bold">
          {nombreCorto(p)}
        </p>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="num text-[32px] leading-none font-bold">
            {fmt(animado)}
          </span>
          {delta !== 0 && (
            <span
              className="text-[12px] font-bold"
              style={{ color: delta < 0 ? "#0a7267" : "#9c2f1e" }}
            >
              {delta < 0 ? "↑" : "↓"} {Math.abs(delta)}
            </span>
          )}
        </div>
        <p className="text-humo m-0 text-[11px]">
          por mes ·{" "}
          {gana === 0
            ? "No gana en ninguna"
            : `Gana en ${gana} categoría${gana > 1 ? "s" : ""}`}
        </p>
      </div>

      {RUBROS_COMPARAR.map((r, i) => {
        const celda = celdas[i]!;
        const hay = Boolean(celda.oferta);
        return (
          <div
            key={r.slug}
            className="border-linea flex h-[59px] items-center gap-2 border-t px-3.5"
            style={celda.gana ? { background: c.soft } : undefined}
          >
            <span className="min-w-0 flex-1">
              <span className="text-humo block text-[12px]">{r.label}</span>
              <span className="block truncate text-[13px] font-medium">
                {hay ? celda.oferta!.c : "Sin beneficio"}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className="num block text-[20px] leading-none font-bold"
                style={{
                  color: celda.gana ? c.ink : hay ? "#14202c" : "#b9c3cf",
                }}
              >
                {hay ? `${celda.oferta!.p}%` : "—"}
              </span>
              {hay && (
                <span className="text-humo block text-[11px]">
                  {fmt(celda.ahorro)}/mes
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TabTarjetas({
  matriz,
  seleccion,
  onSeleccion,
  mis,
  dias,
  gasto,
  onGasto,
  onReset,
  onAbrirModal,
  onVerSiVale,
  onTarjetero,
}: {
  matriz: Matriz;
  seleccion: string[];
  onSeleccion: (s: string[]) => void;
  mis: string[];
  dias: number[];
  gasto: Record<string, number>;
  onGasto: (rubro: string, v: number) => void;
  onReset: () => void;
  onAbrirModal: () => void;
  onVerSiVale: (pid: string) => void;
  onTarjetero: (pid: string) => void;
}) {
  const [plegada, setPlegada] = useState(false);
  const columnas = construirColumnas(matriz, seleccion, dias, gasto);
  const orden = columnas.map((c) => c.pid);
  const refFlip = useFlip(orden);

  // Cuánto se movió cada tarjeta respecto del orden anterior.
  const ordenPrevio = useRef<string[]>(orden);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  useEffect(() => {
    const previo = ordenPrevio.current;
    const nuevos: Record<string, number> = {};
    orden.forEach((id, i) => {
      const antes = previo.indexOf(id);
      if (antes !== -1 && antes !== i) nuevos[id] = i - antes;
    });
    ordenPrevio.current = orden;
    if (Object.keys(nuevos).length === 0) return;
    setDeltas(nuevos);
    const t = setTimeout(() => setDeltas({}), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden.join()]);

  const mejor = columnas.find((c) => c.total > 0) ?? null;
  const falta = candidatas(matriz, mis, dias, gasto)[0] ?? null;
  const pFalta = falta ? PRODUCTO_POR_ID[falta.pid] : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-3.5">
        <ColumnaGasto
          gasto={gasto}
          onGasto={onGasto}
          onReset={onReset}
          plegada={plegada}
          onPlegar={setPlegada}
          subtitulo="Movelo para ver cuánto ahorra cada tarjeta."
        />

        <div
          className="flex min-w-0 flex-1 gap-3.5 overflow-x-auto pb-2"
          style={{ scrollSnapType: "x proximity" }}
        >
          {columnas.map((c) => (
            <div key={c.pid} ref={refFlip(c.pid)}>
              <ColumnaTarjeta
                pid={c.pid}
                celdas={c.celdas}
                total={c.total}
                gana={c.gana}
                mejor={mejor?.pid === c.pid}
                delta={deltas[c.pid] ?? 0}
                mis={mis}
                onQuitar={() =>
                  onSeleccion(seleccion.filter((x) => x !== c.pid))
                }
              />
            </div>
          ))}

          <button
            type="button"
            onClick={onAbrirModal}
            className="text-humo hover:text-tinta flex w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#e4e0d6] text-[13px] font-semibold"
          >
            <Plus className="size-5" />
            Agregar tarjeta
          </button>
        </div>
      </div>

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))" }}
      >
        {mejor && <CardMasRinde columnas={columnas} mejor={mejor} mis={mis} />}
        {falta && pFalta && (
          <div
            className="rounded-[18px] bg-white p-5"
            style={{ border: "1.5px dashed #f7b500" }}
          >
            <p className="text-sol-ink m-0 text-[11px] font-bold tracking-[.08em] uppercase">
              Te falta una
            </p>
            <div className="mt-2 flex items-center gap-3">
              <MiniTarjeta
                fuenteId={pFalta.fuente_id}
                tuya={false}
                ancho={64}
                alto={42}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display m-0 truncate text-[19px] font-bold">
                  {nombreCorto(pFalta)}
                </p>
                <p className="text-humo m-0 text-[13px]">
                  Sumaría{" "}
                  <strong className="text-tinta">
                    +{fmt(falta.extra)}/mes
                  </strong>
                  {falta.rubros.length > 0 &&
                    ` · gana en ${falta.rubros.join(", ")}`}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onVerSiVale(falta.pid)}
                className="bg-tinta hover:bg-pizarra h-9 rounded-[10px] px-3.5 text-[13px] font-semibold text-white"
              >
                ¿Vale la pena?
              </button>
              <button
                type="button"
                onClick={() =>
                  onSeleccion(
                    seleccion.includes(falta.pid)
                      ? seleccion
                      : [...seleccion, falta.pid],
                  )
                }
                className="border-linea h-9 rounded-[10px] border px-3.5 text-[13px] font-semibold"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => onTarjetero(falta.pid)}
                className="border-linea h-9 rounded-[10px] border px-3.5 text-[13px] font-semibold"
              >
                + Tarjetero
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CardMasRinde({
  columnas,
  mejor,
  mis,
}: {
  columnas: ReturnType<typeof construirColumnas>;
  mejor: ReturnType<typeof construirColumnas>[number];
  mis: string[];
}) {
  const p = PRODUCTO_POR_ID[mejor.pid];
  if (!p) return null;
  return (
    <div className="bg-tinta rounded-[18px] p-5 text-white">
      <div className="flex items-center gap-3">
        <MiniTarjeta
          fuenteId={p.fuente_id}
          tuya={mis.includes(mejor.pid)}
          ancho={64}
          alto={42}
        />
        <div className="min-w-0 flex-1">
          <p className="text-humo-oscuro m-0 text-[11px] font-bold tracking-[.08em] uppercase">
            La que más rinde
          </p>
          <p className="font-display m-0 truncate text-[20px] font-bold">
            {nombreCorto(p)}
          </p>
          <p className="text-humo-claro m-0 text-[13px]">
            {fmt(mejor.total)}/mes · gana en {mejor.gana}
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-white/10">
        {RUBROS_COMPARAR.map((r, i) => {
          const ganadora = columnas.find((c) => c.celdas[i]?.gana);
          const pg = ganadora ? PRODUCTO_POR_ID[ganadora.pid] : undefined;
          return (
            <div
              key={r.slug}
              className="flex h-8 items-center gap-2 text-[13px]"
            >
              <span className="text-humo-claro min-w-0 flex-1 truncate">
                {r.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-right">
                {pg ? nombreCorto(pg) : "—"}
              </span>
              <span className="num text-sol w-16 shrink-0 text-right font-bold">
                {ganadora?.celdas[i]?.oferta
                  ? `${ganadora.celdas[i]!.oferta!.p}%`
                  : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { MiniTarjeta };
