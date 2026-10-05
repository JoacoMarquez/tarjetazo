"use client";

import { ChevronDown } from "lucide-react";
import { CATEGORIAS } from "@tarjetazo/core";
import { BotonFavorito } from "@/components/boton-favorito";
import { LogoComercio } from "@/components/logo-comercio";
import type { BeneficioListado } from "@/lib/consultas";
import { NOMBRES_DIA } from "@/lib/filtros";
import { alcanceCorto } from "@/lib/formato";
import { colorFuente } from "@/lib/marca";
import { topeCorto } from "@/lib/tope";
import { cn } from "@/lib/utils";
import { Hasta } from "@/components/hasta";

const SUAVE = "cubic-bezier(.2,.8,.2,1)";

export type Orden = "relevancia" | "porcentaje" | "locales";

const ORDENES: { valor: Orden; label: string }[] = [
  { valor: "relevancia", label: "Para vos" },
  { valor: "porcentaje", label: "Mayor descuento" },
  { valor: "locales", label: "Más locales" },
];

const LABEL_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.slug, c.label]));

/**
 * "BBVA" o "BBVA · solo Nacional BBVA Mastercard Platinum": sin el alcance,
 * un beneficio de una sola tarjeta se lee como de todas las del banco.
 */
export function conAlcance(b: Pick<BeneficioListado, "fuente_id" | "fuente_nombre" | "productos_elegibles">): string {
  const alcance = alcanceCorto(b.fuente_id, b.productos_elegibles);
  return alcance ? `${b.fuente_nombre} · solo ${alcance}` : b.fuente_nombre;
}

/** "25%" / "6c" / "2x1": la cifra que va grande en la card. */
export function cifraDe(b: BeneficioListado): string {
  if (b.tipo === "2x1") return "2x1";
  if (b.porcentaje != null) return `${Math.round(b.porcentaje)}%`;
  if (b.cuotas != null) return `${b.cuotas}c`;
  return "—";
}

/** "Todos los días" / "Mar, Jue". */
export function diasDe(b: BeneficioListado): string {
  if (b.dias_semana.length === 0 || b.dias_semana.length === 7)
    return "Todos los días";
  return b.dias_semana
    .map((d) => (NOMBRES_DIA[d] ?? "").slice(0, 3))
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join(", ");
}



export function PanelLista({
  beneficios,
  total,
  cargando,
  izquierda,
  abierta,
  onAbrir,
  orden,
  onOrden,
  seleccion,
  onElegir,
  esParaVos,
  tieneTarjetas,
  abajo = false,
}: {
  beneficios: BeneficioListado[];
  total: number;
  cargando: boolean;
  izquierda: number;
  abierta: boolean;
  onAbrir: (v: boolean) => void;
  orden: Orden;
  onOrden: (v: Orden) => void;
  seleccion: string | null;
  onElegir: (b: BeneficioListado) => void;
  esParaVos: (b: BeneficioListado) => boolean;
  tieneTarjetas: boolean;
  /** Celular: hoja de ancho completo abajo del mapa, en vez de columna. */
  abajo?: boolean;
}) {
  const n = beneficios.length;
  return (
    <div
      className={cn("absolute z-20 flex flex-col gap-2", abajo
          // Abierta, alto fijo: con max-h la hoja crecía al llegar la lista y
          // el encabezado saltaba hacia arriba (CLS).
          ? cn("right-3 bottom-3 left-3", abierta ? "h-[46%]" : "max-h-[46%]")
          : "top-4 bottom-4")}
      style={
        abajo
          ? undefined
          : {
              left: izquierda,
              width: `min(100% - ${izquierda + 16}px, 380px)`,
              transition: `left .3s ${SUAVE}`,
            }
      }
    >
      {/* cabecera */}
      <div
        className="flex shrink-0 items-center gap-2 rounded-[18px] bg-white p-4"
        style={{ boxShadow: "0 12px 32px rgba(20,32,44,.12)" }}
      >
        <button
          type="button"
          onClick={() => onAbrir(!abierta)}
          className={cn("font-display min-w-0 flex-1 text-left font-bold", abajo ? "text-[16px] leading-tight" : "text-[18px]")}
        >
          {cargando ? "Buscando…" : abajo ? `${n} de ${total}` : `${n} de ${total} descuentos`}
        </button>
        <select
          value={orden}
          onChange={(e) => onOrden(e.target.value as Orden)}
          aria-label="Ordenar"
          className="border-linea h-[34px] shrink-0 rounded-[10px] border bg-white px-2 text-[13px]"
        >
          {ORDENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={abierta ? "Plegar la lista" : "Abrir la lista"}
          onClick={() => onAbrir(!abierta)}
          className="bg-papel inline-flex size-[30px] shrink-0 items-center justify-center rounded-full"
          style={{
            transform: `rotate(${abierta ? 180 : 0}deg)`,
            transition: `transform .4s ${SUAVE}`,
          }}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* lista */}
      <div
        className="grid min-h-0"
        style={{
          gridTemplateRows: abierta ? "1fr" : "0fr",
          transition: `grid-template-rows .4s ${SUAVE}`,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="flex h-full flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 28px), transparent 100%)",
            }}
          >
            {!cargando && n === 0 && (
              <div className="rounded-2xl bg-white p-5 text-center">
                <p className="font-display m-0 text-base font-bold">
                  Nada con esos filtros
                </p>
                <p className="text-humo m-0 mt-1 text-[13px]">
                  Probá otro rubro o sumá una tarjeta.
                </p>
              </div>
            )}
            {beneficios.map((b, i) => {
              const tuya = esParaVos(b);
              const c = colorFuente(b.fuente_id);
              return (
                // Un div con rol de botón y no un <button>: adentro va el
                // corazón, y un botón no puede contener otro.
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onElegir(b)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onElegir(b);
                    }
                  }}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left transition-[transform,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2",
                    "hover:-translate-y-px",
                    seleccion === b.comercio_key && "ring-2",
                  )}
                  style={{
                    boxShadow: "0 4px 14px rgba(20,32,44,.06)",
                    opacity: tuya || !tieneTarjetas ? 1 : 0.75,
                    // Cascada: al plegar salen de abajo hacia arriba y al abrir
                    // vuelven en el orden de lectura.
                    transform: abierta ? undefined : "translateY(-8px)",
                    transitionDelay: abierta
                      ? `${0.1 + i * 0.05}s`
                      : `${(n - i) * 0.04}s`,
                    ...(seleccion === b.comercio_key
                      ? { boxShadow: `0 10px 28px rgba(20,32,44,.12)` }
                      : {}),
                  }}
                >
                  <LogoComercio nombre={b.comercio} logo={b.logo_url} className="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-[17px] font-bold">
                      {b.comercio}
                    </span>
                    <span className="text-humo block truncate text-[13px]">
                      {LABEL_CATEGORIA.get(b.categoria) ?? b.categoria}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block h-[18px] w-[26px] shrink-0 rounded-[4px]"
                        style={
                          tuya
                            ? { background: c.color }
                            : { border: `1.5px dashed ${c.color}` }
                        }
                      />
                      {tuya ? (
                        <span
                          className="inline-flex h-[26px] items-center rounded-[8px] px-2 text-xs font-semibold"
                          style={{ background: c.soft, color: c.ink }}
                        >
                          ✓ Para vos
                        </span>
                      ) : (
                        <span className="text-humo truncate text-xs" title={conAlcance(b)}>
                          {conAlcance(b)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="w-[86px] shrink-0 text-right">
                    <span className="flex justify-end">
                      <BotonFavorito comercioKey={b.comercio_key} nombre={b.comercio} compacto className="-mt-1 -mr-1 mb-1 size-7 border-0" />
                    </span>
                    <span
                      className="num block text-[32px] leading-none font-bold"
                      style={{ color: tuya ? c.ink : "#6b7683" }}
                    >
                      <Hasta b={b} apilado />
                      {cifraDe(b)}
                    </span>
                    {b.tope_monto != null && (
                      <span className="text-humo block text-[10px] leading-tight">tope {topeCorto(b)}</span>
                    )}
                    <span className="text-humo mt-0.5 block text-[10px] leading-tight text-balance">
                      {diasDe(b)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
