import { NextResponse } from "next/server";

/**
 * El 500 de las rutas de /api: el detalle (mensajes de PostgREST, con nombres
 * de tablas y funciones) queda en el log del servidor y no vuelve al navegador.
 */
export function errorInterno(ruta: string, e: unknown) {
  console.error(`${ruta}:`, e);
  return NextResponse.json({ error: "No se pudo completar el pedido." }, { status: 500 });
}
