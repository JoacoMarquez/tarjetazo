import type { Metadata } from "next";
import { Suspense } from "react";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior, PieSitio } from "@/components/nav";
import { TarjetaCatalogoCard } from "@/components/tarjeta/tarjeta-catalogo";
import { leerCatalogo, ordenarCatalogo } from "@/lib/catalogo-publico";
import { TarjetasCliente } from "./tarjetas-cliente";

// Los conteos salen de los beneficios, que cambian con el cron diario.
export const revalidate = 3600;

const BASE = "https://tarjetazo.uy";

export const metadata: Metadata = {
  title: "Todas las tarjetas de Uruguay: costo, requisitos y beneficios",
  description:
    "Catálogo de tarjetas de crédito, débito y prepagas de BROU, Santander, Itaú, Scotiabank, BBVA, OCA y Prex: costo anual, ingreso mínimo, millas o puntos y cuántos descuentos tiene cada una hoy.",
  // Los filtros van en la query pero la página indexable es una sola.
  alternates: { canonical: "/tarjetas" },
  openGraph: { title: "Todas las tarjetas de Uruguay", url: "/tarjetas" },
};

export default async function PaginaTarjetas() {
  const { tarjetas, conDatos } = await leerCatalogo();
  const ordenadas = ordenarCatalogo(tarjetas, "beneficios");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Tarjetas de Uruguay",
    numberOfItems: ordenadas.length,
    itemListElement: ordenadas.slice(0, 20).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.nombre,
      url: `${BASE}/tarjeta/${t.id}`,
    })),
  };

  return (
    <>
      <EncabezadoSitio />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:pb-12">
        <p className="text-humo text-xs font-semibold tracking-widest uppercase">Catálogo</p>
        <h1 className="mt-2 text-3xl md:text-4xl">Todas las tarjetas de Uruguay</h1>
        <p className="text-humo mt-2 max-w-2xl">
          Para elegir cuál sacarte: qué cuesta, qué pide y cuántos descuentos tiene cada una hoy.
          Ordenadas por beneficios vigentes; los que valen para todas las tarjetas de un banco cuentan para cada una.
        </p>
        {!conDatos ? (
          <p className="text-humo border-linea mt-4 rounded-xl border border-dashed px-4 py-3 text-sm">
            No pudimos leer costos ni beneficios en este momento; la lista sale sin esos datos.
          </p>
        ) : null}

        {/* useSearchParams necesita Suspense en una página estática: mientras
            tanto se ve la grilla sin filtros, en el orden por defecto. */}
        <Suspense
          fallback={
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ordenadas.map((t) => <li key={t.id}><TarjetaCatalogoCard t={t} /></li>)}
            </ul>
          }
        >
          <TarjetasCliente tarjetas={ordenadas} />
        </Suspense>

        <p className="text-humo mt-10 text-xs">
          Costos y condiciones salen de la página oficial de cada banco y cambian: la publicación del banco es la que vale.
          El orden es por cantidad de beneficios publicados, no una recomendación financiera.
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
