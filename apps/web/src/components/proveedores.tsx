"use client";

import type { ReactNode } from "react";
import { ProveedorBilletera } from "@/lib/billetera";
import { Billetera } from "./home/billetera";

/**
 * La billetera es estado de toda la app (Home, Explorar y Comparar leen qué
 * tarjetas tenés y cualquiera puede abrir el overlay), así que el proveedor y
 * el overlay viven en el layout raíz y no en la home.
 */
export function Proveedores({ children }: { children: ReactNode }) {
  return (
    <ProveedorBilletera>
      {children}
      <Billetera />
    </ProveedorBilletera>
  );
}
