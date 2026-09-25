"use client";

import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior } from "@/components/nav";
import type { MejorDelRubro } from "@/lib/stats";
import { CercaTuyo } from "./cerca-tuyo";
import { ComoFunciona } from "./como-funciona";
import { Faq } from "./faq";
import { FooterHome } from "./footer-home";
import { Hero } from "./hero";
import { Hoy } from "./hoy";
import { ProximaTarjeta } from "./proxima-tarjeta";

/**
 * El estado de la billetera vive en el layout raíz porque lo comparten todas
 * las páginas. Acá solo se arma la home; los datos llegan ya resueltos desde
 * el servidor.
 */
export function HomeCliente({ rubros, dia }: { rubros: MejorDelRubro[]; dia: string }) {
  return (
    <>
      <EncabezadoSitio />
      <Hero />
      <main className="mx-auto max-w-[1120px] px-5 pb-20">
        <Hoy rubros={rubros} dia={dia} />
        <ComoFunciona rubros={rubros} />
        <ProximaTarjeta />
        <CercaTuyo />
      </main>
      <Faq />
      <FooterHome />
      <NavInferior />
    </>
  );
}
