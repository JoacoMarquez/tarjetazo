"use client";

import { NavInferior } from "@/components/nav";
import { ProveedorBilletera } from "@/lib/billetera";
import type { MejorDelRubro } from "@/lib/stats";
import { Billetera } from "./billetera";
import { CercaTuyo } from "./cerca-tuyo";
import { ComoFunciona } from "./como-funciona";
import { Faq } from "./faq";
import { FooterHome } from "./footer-home";
import { HeaderHome } from "./header-home";
import { Hero } from "./hero";
import { Hoy } from "./hoy";

/**
 * Toda la home comparte el estado de la billetera (qué tarjetas tenés, si el
 * overlay está abierto), así que vive bajo un solo proveedor. Los datos llegan
 * ya resueltos desde el servidor.
 */
export function HomeCliente({ rubros, dia }: { rubros: MejorDelRubro[]; dia: string }) {
  return (
    <ProveedorBilletera>
      <HeaderHome />
      <Hero />
      <main className="mx-auto max-w-[1120px] px-5 pb-20">
        <Hoy rubros={rubros} dia={dia} />
        <ComoFunciona rubros={rubros} />
        <CercaTuyo />
      </main>
      <Faq />
      <FooterHome />
      <NavInferior />
      <Billetera />
    </ProveedorBilletera>
  );
}
