import type { Metadata } from "next";
import { Suspense } from "react";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";
import { Comparador } from "@/components/comparador";

export const metadata: Metadata = {
  title: "Qué banco te conviene según dónde gastás",
  description:
    "Elegí los rubros donde más gastás y comparamos los beneficios de cada banco, emisor y billetera de Uruguay: cantidad, porcentaje, días y topes. Con la fórmula a la vista.",
  alternates: { canonical: "/comparar" },
};

export default function PaginaComparar() {
  return (
    <>
      <EncabezadoSitio />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:pb-12">
        <h1 className="text-3xl md:text-4xl">¿Qué banco te conviene?</h1>
        <p className="text-humo mt-2">
          Elegí en qué gastás y comparamos lo que publica cada fuente. Es una cuenta sobre datos
          públicos, no un consejo financiero: pesá también costos, límites y cómo te tratan.
        </p>
        <Suspense fallback={<div className="bg-papel mt-8 h-64 animate-pulse rounded-lg" />}>
          <Comparador />
        </Suspense>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
