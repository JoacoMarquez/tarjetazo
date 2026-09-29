import type { Metadata } from "next";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior, PieSitio } from "@/components/nav";
import { FavoritosCliente } from "./favoritos-cliente";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus comercios guardados, con sus descuentos de hoy.",
  // Depende de lo que guardó cada uno en su navegador: no tiene sentido indexarla.
  robots: { index: false },
};

export default function PaginaFavoritos() {
  return (
    <>
      <EncabezadoSitio />
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-24 md:pb-12">
        <h1 className="text-3xl md:text-4xl">Favoritos</h1>
        <p className="text-humo mt-2">
          Tus comercios guardados, con los descuentos que tienen hoy. Quedan en este navegador.
        </p>
        <FavoritosCliente />
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
