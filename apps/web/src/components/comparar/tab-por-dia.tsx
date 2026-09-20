"use client";

import { useState } from "react";
import { PRODUCTOS } from "@tarjetazo/core";
import { ChevronDown, Search } from "lucide-react";
import {
  RUBROS_COMPARAR,
  fmt,
  type Matriz,
  type Oferta,
} from "@/lib/comparar-tarjetas";
import { PRODUCTO_POR_ID, colorFuente, nombreCorto } from "@/lib/marca";
import { diaEnUruguay } from "@/lib/filtros";
import { cn } from "@/lib/utils";
import { MiniTarjeta } from "./tab-tarjetas";

const DIAS = [
  { i: 1, label: "Lunes" },
  { i: 2, label: "Martes" },
  { i: 3, label: "Miércoles" },
  { i: 4, label: "Jueves" },
  { i: 5, label: "Viernes" },
  { i: 6, label: "Sábado" },
  { i: 0, label: "Domingo" },
];

function Celda({
  oferta,
  mejorDelDia,
  tuya,
}: {
  oferta: Oferta | null;
  mejorDelDia: boolean;
  tuya: boolean;
}) {
  const [tip, setTip] = useState(false);
  if (!oferta) return <span className="h-[30px] rounded-[7px]" />;

  const fondo = mejorDelDia ? "#f7b500" : tuya ? "#14202c" : "#eeebe3";
  const texto = mejorDelDia ? "#14202c" : tuya ? "#fff" : "#6b7683";

  return (
    <span
      className="relative inline-flex h-[30px] items-center justify-center rounded-[7px] transition-transform"
      style={{
        background: fondo,
        color: texto,
        transform: tip ? "scale(1.06)" : undefined,
      }}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      <span className="num text-[10.5px] font-bold">{oferta.p}%</span>
      {oferta.o > 0 && (
        <span
          className="text-humo absolute -top-1 -right-1 rounded-full bg-white px-0.5 text-[8px] font-bold"
          aria-hidden
        >
          +{oferta.o}
        </span>
      )}
      {tip && (
        <span
          className="bg-tinta pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-[220px] -translate-x-1/2 rounded-[10px] p-2.5 text-left text-white"
          style={{ boxShadow: "0 20px 50px rgba(20,32,44,.35)" }}
        >
          <span className="text-sol block text-[12px] font-bold">
            {oferta.p}% · {oferta.c}
          </span>
          {oferta.t != null && (
            <span className="text-humo-claro block text-[11px]">
              Tope {fmt(oferta.t)}
            </span>
          )}
          {oferta.o > 0 && (
            <span className="text-humo-claro block text-[11px]">
              y {oferta.o} comercio{oferta.o > 1 ? "s" : ""} más
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function Fila({
  pid,
  porDia,
  mejores,
  tuya,
  onComparar,
  onTarjetero,
}: {
  pid: string;
  porDia: (Oferta | null)[];
  mejores: number[];
  tuya: boolean;
  onComparar: () => void;
  onTarjetero: () => void;
}) {
  const p = PRODUCTO_POR_ID[pid];
  if (!p) return null;
  const mejorOferta = porDia.reduce<Oferta | null>(
    (a, b) => (b && (!a || b.p > a.p) ? b : a),
    null,
  );

  return (
    <div
      className="border-linea grid h-[59px] items-center gap-2 border-t px-4"
      style={{
        gridTemplateColumns: "30px minmax(110px,.8fr) minmax(0,1.6fr) 190px",
      }}
    >
      <MiniTarjeta fuenteId={p.fuente_id} tuya={tuya} />
      <div className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">
          {nombreCorto(p)}
        </span>
        <span className="text-humo block truncate text-[12px]">
          {mejorOferta ? mejorOferta.c : "Sin beneficio"}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d) => (
          <Celda
            key={d.i}
            oferta={porDia[d.i] ?? null}
            mejorDelDia={
              (porDia[d.i]?.p ?? 0) > 0 && porDia[d.i]!.p === mejores[d.i]
            }
            tuya={tuya}
          />
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        {tuya ? (
          <span className="text-menta-ink text-[12px] font-semibold">
            ✓ La tuya
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onComparar}
              className="border-linea h-[30px] rounded-[8px] border bg-white px-2.5 text-[12px] font-semibold"
            >
              Comparar
            </button>
            <button
              type="button"
              onClick={onTarjetero}
              className="bg-tinta h-[30px] rounded-[8px] px-2.5 text-[12px] font-semibold text-white"
            >
              + Tarjetero
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function TabPorDia({
  matriz,
  mis,
  rubro,
  onRubro,
  gasto,
  onComparar,
  onTarjetero,
}: {
  matriz: Matriz;
  mis: string[];
  rubro: string;
  onRubro: (r: string) => void;
  gasto: Record<string, number>;
  onComparar: (pid: string) => void;
  onTarjetero: (pid: string) => void;
}) {
  const [q, setQ] = useState("");
  const [masOtras, setMasOtras] = useState(false);
  const hoy = diaEnUruguay();

  const conBeneficio = PRODUCTOS.filter((p) => matriz[p.id]?.[rubro]).map(
    (p) => p.id,
  );
  const tuyas = conBeneficio.filter((id) => mis.includes(id));
  const otras = conBeneficio.filter((id) => !mis.includes(id));

  // La mejor cifra de cada día en la categoría: la que se pinta en sol.
  const mejores = Array.from({ length: 7 }, (_, d) =>
    Math.max(0, ...conBeneficio.map((id) => matriz[id]?.[rubro]?.[d]?.p ?? 0)),
  );
  const mejorGlobal = Math.max(0, ...mejores);

  const texto = q.trim().toLowerCase();
  const rubros = RUBROS_COMPARAR.filter(
    (r) => !texto || r.label.toLowerCase().includes(texto),
  );
  const actual = RUBROS_COMPARAR.find((r) => r.slug === rubro);
  const visiblesOtras = masOtras ? otras : otras.slice(0, 5);
  const color = colorFuente(
    PRODUCTO_POR_ID[conBeneficio[0] ?? ""]?.fuente_id ?? "brou",
  ).color;

  return (
    <div className="flex gap-3.5">
      <div
        className="bg-tinta w-[210px] shrink-0 overflow-hidden rounded-[18px] text-white"
        style={{ boxShadow: "0 20px 50px rgba(20,32,44,.25)" }}
      >
        <div className="p-3">
          <div className="bg-pizarra flex h-9 items-center gap-2 rounded-[10px] px-2.5">
            <Search className="size-4 shrink-0" strokeWidth={2} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar categoría"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8a97a6]"
            />
          </div>
          <p className="text-humo-oscuro m-0 mt-3 text-[11px] font-bold tracking-[.1em] uppercase">
            Mejor descuento por categoría
          </p>
        </div>
        {rubros.map((r) => {
          const ids = PRODUCTOS.filter((p) => matriz[p.id]?.[r.slug]).map(
            (p) => p.id,
          );
          const mejor = Math.max(
            0,
            ...ids.flatMap((id) =>
              (matriz[id]?.[r.slug] ?? []).map((o) => o?.p ?? 0),
            ),
          );
          return (
            <button
              key={r.slug}
              type="button"
              aria-pressed={r.slug === rubro}
              onClick={() => onRubro(r.slug)}
              className={cn(
                "flex h-[59px] w-full items-center gap-2 border-t border-white/10 px-3.5 text-left",
                r.slug === rubro ? "bg-pizarra" : "hover:bg-white/5",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">
                  {r.label}
                </span>
                <span className="text-humo-oscuro block text-[11px]">
                  {ids.length} tarjeta{ids.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="num text-sol shrink-0 text-[15px] font-bold">
                {mejor ? `${mejor}%` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="min-w-0 flex-1 overflow-hidden rounded-[18px] bg-white"
        style={{ border: "2px solid #e4e0d6" }}
      >
        <div className="h-1.5" style={{ background: color }} />

        <div className="flex h-[146px] flex-col justify-center px-4">
          <p className="text-humo m-0 text-[12px]">
            {conBeneficio.length} tarjeta{conBeneficio.length === 1 ? "" : "s"}{" "}
            con beneficio
          </p>
          <p className="font-display m-0 text-[19px] font-bold">
            {actual?.label}
          </p>
          <p className="m-0 mt-1 flex items-baseline gap-2">
            <span className="num text-[32px] leading-none font-bold">
              {mejorGlobal ? `${mejorGlobal}%` : "—"}
            </span>
            <span className="text-humo text-[12px]">
              el mejor descuento · gastás{" "}
              <strong className="text-tinta">{fmt(gasto[rubro] ?? 0)}</strong>
              /mes
            </span>
          </p>
        </div>

        <div
          className="bg-hueso grid items-center gap-2 px-4 py-2"
          style={{
            gridTemplateColumns:
              "30px minmax(110px,.8fr) minmax(0,1.6fr) 190px",
          }}
        >
          <span />
          <span className="text-humo flex items-center gap-1.5 text-[10px] font-bold">
            <span className="bg-sol inline-block size-2 rounded-[2px]" /> Mejor
            del día
          </span>
          <span className="grid grid-cols-7 gap-1">
            {DIAS.map((d) => (
              <span
                key={d.i}
                className={cn(
                  "text-center text-[10px] font-bold",
                  d.i === hoy ? "text-tinta" : "text-humo-oscuro",
                )}
                style={
                  d.i === hoy
                    ? { borderBottom: "2px solid #f7b500" }
                    : undefined
                }
              >
                {d.label.slice(0, 3)}
              </span>
            ))}
          </span>
          <span />
        </div>

        {conBeneficio.length === 0 && (
          <p className="text-humo m-0 px-4 py-8 text-center text-[13px]">
            Sin beneficios en esta categoría.
          </p>
        )}

        {tuyas.length > 0 && (
          <>
            <p className="text-humo-oscuro bg-hueso m-0 px-4 py-1 text-[10px] font-bold tracking-[.1em] uppercase">
              Tuyas
            </p>
            {tuyas.map((id) => (
              <Fila
                key={id}
                pid={id}
                porDia={matriz[id]?.[rubro] ?? []}
                mejores={mejores}
                tuya
                onComparar={() => onComparar(id)}
                onTarjetero={() => onTarjetero(id)}
              />
            ))}
          </>
        )}

        {otras.length > 0 && (
          <>
            <p className="text-humo-oscuro bg-hueso m-0 px-4 py-1 text-[10px] font-bold tracking-[.1em] uppercase">
              No las tenés
            </p>
            {visiblesOtras.map((id) => (
              <Fila
                key={id}
                pid={id}
                porDia={matriz[id]?.[rubro] ?? []}
                mejores={mejores}
                tuya={false}
                onComparar={() => onComparar(id)}
                onTarjetero={() => onTarjetero(id)}
              />
            ))}
            {otras.length > 5 && (
              <button
                type="button"
                onClick={() => setMasOtras((v) => !v)}
                className="border-linea text-humo flex h-[46px] w-full items-center justify-center gap-1.5 border-t text-[13px] font-semibold"
              >
                {masOtras
                  ? "Ver menos"
                  : `Ver las ${otras.length - 5} restantes`}
                <ChevronDown
                  className="size-4"
                  style={{
                    transform: masOtras ? "rotate(180deg)" : undefined,
                    transition: "transform .2s",
                  }}
                />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
