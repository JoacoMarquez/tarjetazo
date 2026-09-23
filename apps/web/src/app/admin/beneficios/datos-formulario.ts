import "server-only";

import { CATEGORIAS, FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { createSupabaseAdmin } from "@/lib/admin";

/** Opciones del formulario de carga manual. */
export async function opcionesFormulario() {
  const nombres: string[] = [];
  const db = createSupabaseAdmin();
  // Paginado: hay ~1.100 comercios y PostgREST corta en 1.000.
  for (let desde = 0; ; desde += 1000) {
    const { data } = await db.from("comercio").select("nombre").order("nombre").range(desde, desde + 999);
    for (const c of data ?? []) nombres.push(c.nombre as string);
    if ((data ?? []).length < 1000) break;
  }
  return {
    fuentes: FUENTES.map((f) => ({ id: f.id as string, nombre: f.nombre })),
    productos: PRODUCTOS.filter((p) => p.activo !== false).map((p) => ({ id: p.id, fuente_id: p.fuente_id, nombre: p.nombre })),
    categorias: CATEGORIAS.map((c) => ({ id: c.slug as string, nombre: c.label })),
    comercios: nombres,
  };
}
