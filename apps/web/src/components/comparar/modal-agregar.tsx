"use client";

import { useMemo, useState } from "react";
import { FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { X } from "lucide-react";
import {
  RUBROS_COMPARAR,
  mejorOferta,
  fmt,
  candidatas,
  type Matriz,
} from "@/lib/comparar-tarjetas";
import { colorFuente, pieDeTarjeta } from "@/lib/marca";
import { MiniTarjeta } from "./tab-tarjetas";

export function ModalAgregar({
  matriz,
  seleccion,
  onSeleccion,
  mis,
  dias,
  gasto,
  onCerrar,
}: {
  matriz: Matriz;
  seleccion: string[];
  onSeleccion: (s: string[]) => void;
  mis: string[];
  dias: number[];
  gasto: Record<string, number>;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState("");

  const extraPorId = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of candidatas(matriz, mis, dias, gasto)) m.set(c.pid, c.extra);
    return m;
  }, [matriz, mis, dias, gasto]);

  const texto = q.trim().toLowerCase();
  const visibles = PRODUCTOS.filter(
    (p) => !texto || p.nombre.toLowerCase().includes(texto),
  );

  const nCategorias = (pid: string) =>
    RUBROS_COMPARAR.filter((r) => mejorOferta(matriz, pid, r.slug, dias))
      .length;

  const falta = visibles
    .filter((p) => (extraPorId.get(p.id) ?? 0) > 0)
    .sort((a, b) => (extraPorId.get(b.id) ?? 0) - (extraPorId.get(a.id) ?? 0))
    .slice(0, 4);
  const tuyas = visibles.filter((p) => mis.includes(p.id));
  const idsArriba = new Set([
    ...falta.map((p) => p.id),
    ...tuyas.map((p) => p.id),
  ]);

  const grupos: { titulo: string; productos: typeof PRODUCTOS }[] = [
    ...(falta.length ? [{ titulo: "Te falta una", productos: falta }] : []),
    ...(tuyas.length ? [{ titulo: "Tus tarjetas", productos: tuyas }] : []),
    ...FUENTES.map((f) => ({
      titulo: f.nombre,
      productos: visibles.filter(
        (p) => p.fuente_id === f.id && !idsArriba.has(p.id),
      ),
    })).filter((g) => g.productos.length > 0),
  ];

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-1100 flex items-center justify-center p-5"
      style={{ background: "rgba(20,32,44,.45)" }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Agregar tarjetas"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[560px] max-w-full flex-col rounded-[22px] bg-white p-5"
        style={{ boxShadow: "0 30px 80px rgba(20,32,44,.35)" }}
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display m-0 flex-1 text-[20px] font-bold">
            Agregar tarjetas
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="bg-papel inline-flex size-8 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar una tarjeta"
          aria-label="Buscar una tarjeta"
          className="bg-papel-1 mt-3 h-[42px] shrink-0 rounded-[10px] px-3.5 text-[14px] outline-none"
        />

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {grupos.map((g) => (
            <div key={g.titulo} className="mb-2">
              <p className="text-humo-oscuro m-0 py-1 text-[11px] font-bold tracking-[.1em] uppercase">
                {g.titulo}
              </p>
              {g.productos.map((p) => {
                const elegida = seleccion.includes(p.id);
                const extra = extraPorId.get(p.id) ?? 0;
                const n = nCategorias(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() =>
                      onSeleccion(
                        elegida
                          ? seleccion.filter((x) => x !== p.id)
                          : [...seleccion, p.id],
                      )
                    }
                    className="hover:bg-hueso flex h-[50px] w-full items-center gap-3 rounded-lg px-1.5 text-left"
                    style={{ opacity: n ? 1 : 0.5 }}
                  >
                    <span
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2 text-[11px] font-bold text-white"
                      style={{
                        borderColor: elegida
                          ? colorFuente(p.fuente_id).color
                          : "#e4e0d6",
                        background: elegida
                          ? colorFuente(p.fuente_id).color
                          : "#fff",
                      }}
                      aria-hidden
                    >
                      {elegida ? "✓" : ""}
                    </span>
                    <MiniTarjeta
                      fuenteId={p.fuente_id}
                      tuya={mis.includes(p.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {p.nombre}
                      </span>
                      <span className="text-humo block text-[12px]">
                        {pieDeTarjeta(p)} ·{" "}
                        {n
                          ? `${n} categoría${n > 1 ? "s" : ""}`
                          : "Sin beneficios"}
                      </span>
                    </span>
                    {mis.includes(p.id) ? (
                      <span className="bg-sol text-tinta shrink-0 rounded-[4px] px-1 text-[10px] font-bold">
                        TUYA
                      </span>
                    ) : extra > 0 ? (
                      <span className="text-sol-ink bg-sol-s shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold">
                        +{fmt(extra)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
