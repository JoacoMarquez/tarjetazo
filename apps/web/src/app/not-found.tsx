import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior, PieSitio } from "@/components/nav";

export const metadata: Metadata = {
  title: "No encontramos esa página",
  robots: { index: false },
};

/** El 404 de todo el sitio (comercio, tarjeta o banco que no existe, links viejos). */
export default function NoEncontrada() {
  return (
    <>
      <EncabezadoSitio />
      <main className="mx-auto max-w-xl px-5 pt-16 pb-24 text-center md:pb-16">
        <p className="text-humo text-sm font-semibold tracking-widest uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl md:text-4xl">No encontramos esa página</h1>
        <p className="text-humo mt-3">
          Puede que el comercio o la tarjeta ya no tenga beneficios publicados, o que el link
          esté mal escrito.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/app"
            className="bg-tinta inline-flex h-11 items-center rounded-pill px-5 text-sm font-semibold text-white"
          >
            Ver los beneficios
          </Link>
          <Link
            href="/"
            className="border-linea inline-flex h-11 items-center rounded-pill border bg-white px-5 text-sm font-semibold"
          >
            Ir al inicio
          </Link>
        </div>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
