"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { FUENTES } from "@tarjetazo/core";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TarjetaCatalogoCard } from "@/components/tarjeta/tarjeta-catalogo";
import {
  COSTOS,
  INGRESOS,
  ORDENES_CATALOGO,
  PROGRAMAS,
  REDES_TARJETA,
  TIPOS_TARJETA,
  escribirFiltrosCatalogo,
  filtrarCatalogo,
  hayFiltrosCatalogo,
  leerFiltrosCatalogo,
  ordenarCatalogo,
  type FiltrosCatalogo,
  type OrdenCatalogo,
  type TarjetaCatalogo,
} from "@/lib/catalogo-publico";
import { monto } from "@/lib/fichas";
import { cn } from "@/lib/utils";

function alternar<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "rounded-pill border px-3 py-1 text-sm transition-colors",
        activo ? "border-cielo bg-cielo text-white" : "border-linea bg-card hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

/** Una fila de chips que en mobile se desplaza de a uno en vez de apilarse. */
function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={etiqueta} className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden">
      <span className="text-humo w-14 text-xs font-semibold tracking-widest uppercase">{etiqueta}</span>
      {children}
    </div>
  );
}

function Select({ etiqueta, valor, onCambiar, opciones }: { etiqueta: string; valor: string; onCambiar: (v: string) => void; opciones: { valor: string; label: string }[] }) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      className="border-linea bg-card focus-visible:ring-ring h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
    >
      {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
    </select>
  );
}

/**
 * Filtros y grilla del catálogo (#70). Los filtros viven en la URL, así un
 * link `/tarjetas?banco=brou&tipo=credito` se puede compartir; el filtrado es
 * en el cliente porque son menos de cien tarjetas.
 */
export function TarjetasCliente({ tarjetas }: { tarjetas: TarjetaCatalogo[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const filtros = useMemo(() => leerFiltrosCatalogo(new URLSearchParams(params.toString())), [params]);

  function cambiar(parcial: Partial<FiltrosCatalogo>) {
    const q = escribirFiltrosCatalogo({ ...filtros, ...parcial }).toString();
    router.replace(q ? `/tarjetas?${q}` : "/tarjetas", { scroll: false });
  }

  const visibles = useMemo(() => ordenarCatalogo(filtrarCatalogo(tarjetas, filtros), filtros.orden), [tarjetas, filtros]);
  const hayFiltros = hayFiltrosCatalogo(filtros);

  return (
    <>
      <div className="mt-6 space-y-2">
        <Fila etiqueta="Banco">
          {FUENTES.map((f) => (
            <Chip key={f.id} activo={filtros.bancos.includes(f.id)} onClick={() => cambiar({ bancos: alternar(filtros.bancos, f.id) })}>
              {f.nombre}
            </Chip>
          ))}
        </Fila>
        <Fila etiqueta="Tipo">
          {TIPOS_TARJETA.map((t) => (
            <Chip key={t.valor} activo={filtros.tipos.includes(t.valor)} onClick={() => cambiar({ tipos: alternar(filtros.tipos, t.valor) })}>
              {t.label}
            </Chip>
          ))}
          <span aria-hidden className="bg-linea mx-1 h-5 w-px" />
          {REDES_TARJETA.map((r) => (
            <Chip key={r.valor} activo={filtros.redes.includes(r.valor)} onClick={() => cambiar({ redes: alternar(filtros.redes, r.valor) })}>
              {r.label}
            </Chip>
          ))}
        </Fila>
        <Fila etiqueta="Ficha">
          {COSTOS.map((c) => (
            <Chip key={c.valor} activo={filtros.costo === c.valor} onClick={() => cambiar({ costo: filtros.costo === c.valor ? null : c.valor })}>
              {c.label}
            </Chip>
          ))}
          {PROGRAMAS.map((p) => (
            <Chip key={p.valor} activo={filtros.programa === p.valor} onClick={() => cambiar({ programa: filtros.programa === p.valor ? null : p.valor })}>
              {p.label}
            </Chip>
          ))}
          <Select
            etiqueta="Ingreso mínimo"
            valor={filtros.ingresoHasta ? String(filtros.ingresoHasta) : ""}
            onCambiar={(v) => cambiar({ ingresoHasta: v ? Number(v) : null })}
            opciones={[
              { valor: "", label: "Cualquier ingreso" },
              ...INGRESOS.map((n) => ({ valor: String(n), label: `Ingreso hasta ${monto(n)}` })),
            ]}
          />
        </Fila>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-humo text-sm">
          <span className="num text-tinta font-semibold">{visibles.length}</span> {visibles.length === 1 ? "tarjeta" : "tarjetas"}
          {hayFiltros ? (
            <Button variant="ghost" size="sm" className="ml-2 h-7 px-2" onClick={() => cambiar({ bancos: [], tipos: [], redes: [], costo: null, ingresoHasta: null, programa: null })}>
              <X /> Limpiar filtros
            </Button>
          ) : null}
        </p>
        <Select
          etiqueta="Orden"
          valor={filtros.orden}
          onCambiar={(v) => cambiar({ orden: v as OrdenCatalogo })}
          opciones={ORDENES_CATALOGO}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="text-humo border-linea mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          Ninguna tarjeta cumple con todo eso. Los filtros de costo, ingreso y programa solo encuentran tarjetas con la ficha cargada.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((t) => <li key={t.id}><TarjetaCatalogoCard t={t} /></li>)}
        </ul>
      )}
    </>
  );
}
