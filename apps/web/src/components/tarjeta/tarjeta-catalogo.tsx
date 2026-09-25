import Link from "next/link";
import { PROPORCION_TARJETA } from "@/components/tarjeta-3d";
import { CaraGenerica } from "@/components/tarjeta/cara-generica";
import type { TarjetaCatalogo } from "@/lib/catalogo-publico";
import { costoAnual } from "@/lib/fichas";
import { colorFuente } from "@/lib/marca";

/**
 * Una tarjeta en la grilla del catálogo (#70): foto, banco, nombre y dos
 * datos. La foto va plana (la 3D queda para la ficha: 80 tarjetas inclinándose
 * a la vez marean); ya viene horizontal y recortada a la tarjeta (#72).
 */
export function TarjetaCatalogoCard({ t }: { t: TarjetaCatalogo }) {
  const costo = costoAnual(t);
  const c = colorFuente(t.fuente_id);
  return (
    <Link
      href={`/tarjeta/${t.id}`}
      className="group border-linea bg-card hover:bg-secondary focus-visible:ring-ring flex h-full flex-col rounded-xl border p-3 transition-colors outline-none focus-visible:ring-2"
    >
      <div className="bg-papel-2 overflow-hidden rounded-[4%/6.3%]" style={{ aspectRatio: PROPORCION_TARJETA }}>
        {t.frente ? (
          // Fotos del bucket de Supabase: sin optimizador de Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.frente}
            alt={`${t.nombre} de ${t.banco}`}
            loading="lazy"
            draggable={false}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <CaraGenerica fuenteId={t.fuente_id} banco={t.banco} nombre={t.nombre} pie={t.pie} />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-pill px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase" style={{ background: c.soft, color: c.ink }}>
          {t.banco}
        </span>
        <span className="text-humo truncate text-xs">{t.pie}</span>
      </div>
      <h3 className="mt-1 leading-tight font-semibold">{t.nombre}</h3>

      <dl className="mt-auto grid grid-cols-2 gap-2 pt-3 text-sm">
        <div>
          <dt className="text-humo text-xs">Costo anual</dt>
          <dd className={costo ? "" : "text-humo"}>{costo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-humo text-xs">Beneficios vigentes</dt>
          <dd>
            <span className="num text-cielo font-bold">{t.vigentes}</span>
            {t.exclusivos > 0 ? <span className="text-humo text-xs"> · {t.exclusivos} solo con esta</span> : null}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
