"use client";

import Link from "next/link";
import type { MejorDelRubro } from "@/lib/stats";
import { useBilletera } from "@/lib/billetera";
import { cifraBeneficio, tarjetaSugerida } from "@/lib/formato";
import { colorFuente } from "@/lib/marca";

/**
 * "Hoy sábado, pagá así": el mejor beneficio del día en cada rubro. Las cards
 * de tarjetas que el usuario no tiene se apagan y ofrecen agregarla, con el
 * banco ya elegido en el panel de alta.
 */
export function Hoy({ rubros, dia }: { rubros: MejorDelRubro[]; dia: string }) {
  const { mis, abrir } = useBilletera();
  if (rubros.length === 0) return null;

  return (
    <section className="pt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display m-0 text-[28px] font-bold tracking-tight text-tinta">
          Hoy {dia}, pagá así
        </h2>
        <Link href="/app?dia=hoy" className="text-sm font-medium text-cielo hover:text-cielo-ink">
          Ver todos →
        </Link>
      </div>

      <div
        className="mt-5 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
      >
        {rubros.map(({ rubro, beneficio }) => {
          const { producto, laTengo } = tarjetaSugerida(beneficio, mis);
          const c = colorFuente(beneficio.fuente_id);
          const donde =
            beneficio.n_sucursales > 1
              ? `${beneficio.comercio} · ${beneficio.n_sucursales} locales`
              : beneficio.comercio;
          return (
            <div
              key={rubro}
              className="border-linea grid items-center gap-x-4 gap-y-2 rounded-2xl border bg-white p-5"
              style={{ gridTemplateColumns: "minmax(0, 1fr) auto", opacity: laTengo ? 1 : 0.7 }}
            >
              <div className="text-xs font-semibold uppercase tracking-[.08em] text-tinta">
                {rubro}
              </div>
              <span
                className="num self-start whitespace-nowrap text-[40px] font-bold leading-none"
                style={{ gridRow: "1 / 3", gridColumn: 2, color: laTengo ? c.ink : "#6b7683" }}
              >
                {cifraBeneficio(beneficio)}
              </span>
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-[22px] w-[34px] flex-none rounded"
                  style={{
                    background: laTengo ? c.color : "transparent",
                    border: `1.5px dashed ${laTengo ? "transparent" : c.color}`,
                    boxSizing: "border-box",
                  }}
                />
                <span className="font-display min-w-0 break-words text-[17px] font-bold leading-[1.15]">
                  {producto?.nombre ?? beneficio.fuente_nombre}
                </span>
              </div>
              <div className="col-span-2 flex justify-between gap-3 text-[13px] text-tinta">
                <span className="min-w-0 truncate">{donde}</span>
                {!laTengo && producto && (
                  <button
                    type="button"
                    onClick={() => abrir({ agregar: true, banco: producto.fuente_id })}
                    className="cursor-pointer whitespace-nowrap font-medium text-cielo hover:text-cielo-ink"
                  >
                    Agregar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
