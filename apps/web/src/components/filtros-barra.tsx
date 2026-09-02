"use client";

import { CATEGORIAS, Departamento } from "@tarjetazo/core";
import { CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { NOMBRES_DIA, type Filtros, type Orden, type Dia } from "@/lib/filtros";

const DIAS: { valor: Dia; label: string }[] = [
  { valor: null, label: "Cualquier día" },
  { valor: "hoy", label: "Hoy" },
  { valor: "manana", label: "Mañana" },
  ...NOMBRES_DIA.map((n, i) => ({ valor: String(i) as Dia, label: n[0]!.toUpperCase() + n.slice(1) })),
];

const TIPOS = [
  { valor: "porcentaje", label: "Descuento" },
  { valor: "cuotas", label: "Cuotas" },
  { valor: "reintegro", label: "Reintegro" },
  { valor: "2x1", label: "2x1" },
];

const ORDENES: { valor: Orden; label: string }[] = [
  { valor: "relevancia", label: "Relevancia" },
  { valor: "porcentaje", label: "Mayor %" },
  { valor: "cuotas", label: "Más cuotas" },
];

function Select({
  valor,
  onCambiar,
  opciones,
  etiqueta,
}: {
  valor: string;
  onCambiar: (v: string) => void;
  opciones: { valor: string; label: string }[];
  etiqueta: string;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      className="border-linea bg-card focus-visible:ring-ring h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function alternar(xs: string[], x: string): string[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

export function FiltrosBarra({
  filtros,
  onCambiar,
  onAbrirTarjetas,
  tieneTarjetas,
  total,
}: {
  filtros: Filtros;
  onCambiar: (f: Partial<Filtros>) => void;
  onAbrirTarjetas: () => void;
  tieneTarjetas: boolean;
  total: number;
}) {
  const hayFiltros =
    filtros.categorias.length > 0 ||
    filtros.tipos.length > 0 ||
    filtros.departamentos.length > 0 ||
    filtros.dia !== null ||
    filtros.comercio !== null ||
    filtros.soloMisTarjetas;

  return (
    <div className="space-y-3">
      {/* En mobile los filtros se desplazan de a uno en vez de apilarse: si
          envuelven, el header se come media pantalla. */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&>*]:shrink-0">
        <Button variant={tieneTarjetas ? "secondary" : "default"} size="sm" onClick={onAbrirTarjetas}>
          <CreditCard />
          {tieneTarjetas
            ? `${filtros.bancos.length} ${filtros.bancos.length === 1 ? "banco" : "bancos"}`
            : "Mis tarjetas"}
        </Button>

        {tieneTarjetas && (
          <label className="border-linea bg-card flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <Switch
              checked={filtros.soloMisTarjetas}
              onCheckedChange={(v) => onCambiar({ soloMisTarjetas: v })}
              aria-label="Solo mis tarjetas"
            />
            Solo mis tarjetas
          </label>
        )}

        <Select
          etiqueta="Día"
          valor={filtros.dia ?? ""}
          onCambiar={(v) => onCambiar({ dia: (v || null) as Dia })}
          opciones={DIAS.map((d) => ({ valor: d.valor ?? "", label: d.label }))}
        />

        <Select
          etiqueta="Departamento"
          valor={filtros.departamentos[0] ?? ""}
          onCambiar={(v) => onCambiar({ departamentos: v ? [v] : [] })}
          opciones={[
            { valor: "", label: "Todo el país" },
            ...Departamento.options.map((d) => ({
              valor: d,
              label: d.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            })),
          ]}
        />

        <Select
          etiqueta="Orden"
          valor={filtros.orden}
          onCambiar={(v) => onCambiar({ orden: v as Orden })}
          opciones={ORDENES}
        />

        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onCambiar({
                categorias: [],
                tipos: [],
                departamentos: [],
                dia: null,
                comercio: null,
                soloMisTarjetas: false,
              })
            }
          >
            <X /> Limpiar
          </Button>
        )}

        {filtros.comercio && (
          <button
            type="button"
            onClick={() => onCambiar({ comercio: null })}
            className="border-cielo-ln bg-cielo-s text-cielo-ink rounded-pill inline-flex items-center gap-1 border px-2.5 py-1 text-xs font-medium"
          >
            {filtros.comercio.replace(/-/g, " ")} <X className="size-3" />
          </button>
        )}

        <span className="text-humo ml-auto whitespace-nowrap text-sm">
          <span className="num font-semibold">{total}</span>{" "}
          {total === 1 ? "beneficio" : "beneficios"}
        </span>
      </div>

      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&>li]:shrink-0">
        {TIPOS.map((t) => {
          const activo = filtros.tipos.includes(t.valor);
          return (
            <li key={t.valor}>
              <button
                type="button"
                aria-pressed={activo}
                onClick={() => onCambiar({ tipos: alternar(filtros.tipos, t.valor) })}
                className={cn(
                  "rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
                  activo
                    ? "border-sol-ln bg-sol-s text-sol-ink"
                    : "border-linea bg-card text-humo hover:bg-secondary",
                )}
              >
                {t.label}
              </button>
            </li>
          );
        })}
        <li aria-hidden className="border-linea mx-1 self-stretch border-l" />
        {CATEGORIAS.map((c) => {
          const activo = filtros.categorias.includes(c.slug);
          return (
            <li key={c.slug}>
              <button
                type="button"
                aria-pressed={activo}
                onClick={() => onCambiar({ categorias: alternar(filtros.categorias, c.slug) })}
                className={cn(
                  "rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
                  activo
                    ? "border-cielo-ln bg-cielo-s text-cielo-ink"
                    : "border-linea bg-card text-humo hover:bg-secondary",
                )}
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>

      {!tieneTarjetas && (
        <p className="border-cielo-ln bg-cielo-s text-cielo-ink rounded-md border px-3 py-2 text-xs">
          Decinos qué tarjetas tenés y filtramos todo por lo que te sirve. Nunca te pedimos
          el número. <button className="font-semibold underline" onClick={onAbrirTarjetas}>Elegir</button>
        </p>
      )}
    </div>
  );
}
