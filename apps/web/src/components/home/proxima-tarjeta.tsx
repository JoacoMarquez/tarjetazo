import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FAMILIAS_TARJETA, FUENTES } from "@tarjetazo/core";
import { GRADIENTE } from "@/lib/marca";

/**
 * Entrada al catálogo (#70) desde la home: la barra inferior queda en cuatro
 * tabs, así que "quiero sacarme una tarjeta" arranca acá o en /banco.
 */
export function ProximaTarjeta() {
  return (
    <section className="mt-16">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white md:p-8" style={{ background: GRADIENTE }}>
        <p className="text-xs font-semibold tracking-widest uppercase opacity-90">¿Pensando en sacarte una?</p>
        <h2 className="mt-2 max-w-xl text-2xl md:text-3xl">
          Las {FAMILIAS_TARJETA.length} tarjetas de {FUENTES.length} bancos y emisores, una al lado de la otra
        </h2>
        <p className="mt-2 max-w-xl text-sm opacity-90">
          Costo anual, ingreso mínimo, millas o puntos y cuántos descuentos tiene cada una hoy. Filtrá por banco, tipo o red.
        </p>
        <Link
          href="/tarjetas"
          className="text-tinta mt-5 inline-flex h-10 items-center gap-1.5 rounded-md bg-white px-4 text-sm font-medium hover:bg-white/90"
        >
          Ver el catálogo <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
