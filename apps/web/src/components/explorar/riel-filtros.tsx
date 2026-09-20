"use client";

import { useState } from "react";
import { FUENTES } from "@tarjetazo/core";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  CreditCard,
  Cross,
  Fuel,
  Menu,
  Search,
  ShoppingCart,
  Truck,
  Utensils,
} from "lucide-react";
import {
  NOMBRES_DIA,
  diaEnUruguay,
  type Dia,
  type Filtros,
} from "@/lib/filtros";
import { colorFuente } from "@/lib/marca";
import { cn } from "@/lib/utils";

const SUAVE = "cubic-bezier(.2,.8,.2,1)";

/** Los seis rubros del riel, con el ícono que les da el handoff. */
const RUBROS = [
  { slug: null, label: "Todos", icono: Menu },
  { slug: "supermercados", label: "Supermercados", icono: ShoppingCart },
  { slug: "restaurantes", label: "Restaurantes", icono: Utensils },
  { slug: "combustible", label: "Combustible", icono: Fuel },
  { slug: "farmacias", label: "Farmacias", icono: Cross },
  { slug: "entretenimiento", label: "Entretenimiento", icono: Clapperboard },
  { slug: "delivery", label: "Delivery", icono: Truck },
] as const;

function Toggle({
  activo,
  onClick,
  icono: Icono,
  children,
  plegado,
  ...resto
}: {
  activo: boolean;
  onClick: () => void;
  icono: typeof Check;
  children: React.ReactNode;
  plegado: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-2.5 text-[13px] font-semibold transition-colors",
        activo
          ? "border-sol bg-sol text-tinta"
          : "border-white/30 bg-transparent text-white hover:bg-white/10",
      )}
      {...resto}
    >
      <Icono className="size-4 shrink-0" strokeWidth={2} />
      <span
        className="min-w-0 flex-1 truncate text-left"
        style={{ opacity: plegado ? 0 : 1, transition: "opacity .2s" }}
      >
        {children}
      </span>
    </button>
  );
}

export function RielFiltros({
  filtros,
  onCambiar,
  abierto,
  onPlegar,
  misBancos,
  q,
  onQ,
}: {
  filtros: Filtros;
  onCambiar: (parcial: Partial<Filtros>) => void;
  abierto: boolean;
  onPlegar: (v: boolean) => void;
  misBancos: string[];
  q: string;
  onQ: (v: string) => void;
}) {
  const [tarjOpen, setTarjOpen] = useState(false);
  // Dirección de la animación del nombre del día al cambiarlo.
  const [dirDia, setDirDia] = useState<"next" | "prev">("next");

  const hoy = diaEnUruguay();
  const diaActual =
    filtros.dia === null
      ? hoy
      : Number(filtros.dia === "hoy" ? hoy : filtros.dia);
  const nombreDia = NOMBRES_DIA[diaActual] ?? "";

  function moverDia(paso: 1 | -1) {
    setDirDia(paso === 1 ? "next" : "prev");
    const siguiente = (diaActual + paso + 7) % 7;
    onCambiar({ dia: String(siguiente) as Dia });
  }

  const bancosFiltrados = filtros.bancos;
  const etiquetaTarjetas =
    bancosFiltrados.length === 0
      ? "Tarjetas"
      : bancosFiltrados.length === 1
        ? "1 banco"
        : `${bancosFiltrados.length} bancos`;

  return (
    <aside
      className="absolute top-4 bottom-4 left-4 z-21 flex flex-col gap-3.5 rounded-[18px] px-2.5 py-3.5"
      style={{
        width: abierto ? 200 : 56,
        background: "#14202c",
        boxShadow: "0 20px 50px rgba(20,32,44,.25)",
        transition: `width .3s ${SUAVE}`,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* buscador */}
        <div
          className="bg-pizarra flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-2.5"
          onClick={() => !abierto && onPlegar(true)}
        >
          <Search className="size-4 shrink-0 text-white" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar comercio"
            tabIndex={abierto ? 0 : -1}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-white outline-none placeholder:text-[#8a97a6]"
            style={{ opacity: abierto ? 1 : 0, transition: "opacity .2s" }}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <Toggle
            activo={filtros.soloMisTarjetas}
            onClick={() =>
              onCambiar({ soloMisTarjetas: !filtros.soloMisTarjetas })
            }
            icono={Check}
            plegado={!abierto}
          >
            Solo mis tarjetas
          </Toggle>

          {/* día: ‹ nombre › */}
          <div
            className={cn(
              "flex h-9 shrink-0 items-center rounded-[10px] border text-[13px] font-semibold",
              filtros.dia !== null
                ? "border-sol bg-sol text-tinta"
                : "border-white/30 text-white",
            )}
          >
            {abierto ? (
              <>
                <button
                  type="button"
                  aria-label="Día anterior"
                  onClick={() => moverDia(-1)}
                  className="inline-flex size-8 shrink-0 items-center justify-center"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCambiar({
                      dia: filtros.dia === null ? (String(hoy) as Dia) : null,
                    })
                  }
                  className="min-w-0 flex-1 overflow-hidden capitalize"
                >
                  <span
                    key={`${diaActual}-${dirDia}`}
                    className={`dia-entra-${dirDia} block truncate`}
                  >
                    {nombreDia}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Día siguiente"
                  onClick={() => moverDia(1)}
                  className="inline-flex size-8 shrink-0 items-center justify-center"
                >
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="Filtrar por día"
                onClick={() => onPlegar(true)}
                className="inline-flex size-9 items-center justify-center"
              >
                <Calendar className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>

          <Toggle
            activo={bancosFiltrados.length > 0}
            onClick={() => (abierto ? setTarjOpen((v) => !v) : onPlegar(true))}
            icono={CreditCard}
            plegado={!abierto}
            aria-expanded={tarjOpen}
          >
            {etiquetaTarjetas}
          </Toggle>

          {/* acordeón de bancos */}
          <div
            className="grid"
            style={{
              gridTemplateRows: abierto && tarjOpen ? "1fr" : "0fr",
              opacity: abierto && tarjOpen ? 1 : 0,
              transition: "grid-template-rows .35s " + SUAVE + ", opacity .35s",
            }}
          >
            <div className="overflow-hidden">
              <div className="rounded-xl p-2" style={{ background: "#1b2937" }}>
                <p className="text-humo-oscuro m-0 px-1 pb-1 text-[11px] font-bold tracking-[.1em] uppercase">
                  Tarjeta / banco
                </p>
                {FUENTES.map((f) => {
                  const elegido = bancosFiltrados.includes(f.id);
                  const tuya = misBancos.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() =>
                        onCambiar({
                          bancos: elegido
                            ? bancosFiltrados.filter((x) => x !== f.id)
                            : [...bancosFiltrados, f.id],
                        })
                      }
                      className="flex h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-[13px] text-white hover:bg-white/10"
                    >
                      <span
                        className="size-[15px] w-[22px] shrink-0 rounded-[3px]"
                        style={{ background: colorFuente(f.id).color }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {f.nombre}
                      </span>
                      {tuya && (
                        <span className="bg-sol text-tinta shrink-0 rounded-[3px] px-1 text-[10px] font-bold">
                          TUYA
                        </span>
                      )}
                      {elegido && (
                        <Check
                          className="text-sol size-4 shrink-0"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* rubros */}
        <div className="flex shrink-0 flex-col gap-0.5">
          <p
            className="text-humo-oscuro m-0 px-1 pb-1 text-[11px] font-bold tracking-[.1em] uppercase"
            style={{ opacity: abierto ? 1 : 0, transition: "opacity .2s" }}
          >
            Rubro
          </p>
          {RUBROS.map((r) => {
            const activo =
              r.slug === null
                ? filtros.categorias.length === 0
                : filtros.categorias.includes(r.slug);
            const Icono = r.icono;
            return (
              <button
                key={r.label}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  onCambiar({ categorias: r.slug === null ? [] : [r.slug] })
                }
                className={cn(
                  "flex h-[34px] shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                  activo ? "bg-sol text-tinta" : "hover:bg-pizarra text-white",
                )}
              >
                <Icono className="size-4 shrink-0" strokeWidth={2} />
                <span
                  className="min-w-0 flex-1 truncate text-left"
                  style={{
                    opacity: abierto ? 1 : 0,
                    transition: "opacity .2s",
                  }}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label={abierto ? "Plegar los filtros" : "Abrir los filtros"}
        onClick={() => {
          if (abierto) setTarjOpen(false);
          onPlegar(!abierto);
        }}
        className="bg-pizarra mt-auto inline-flex h-8 shrink-0 items-center justify-center rounded-[10px] text-white"
      >
        {abierto ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
    </aside>
  );
}
