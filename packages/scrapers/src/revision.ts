import type { SupabaseClient } from "@supabase/supabase-js";
import { mapearProductos } from "./normalizador.js";

/**
 * La cola de revisión acumula entradas de corridas viejas que las reglas de
 * mapeo actuales ya resuelven. Esto las vuelve a evaluar y da por resueltas las
 * que dejaron de ser un problema, para que lo que queda sea lo que de verdad
 * hay que mirar a mano.
 */
export async function revalidarRevisiones(db: SupabaseClient): Promise<{
  revisadas: number;
  resueltas: number;
  pendientes: { fuente_id: string; motivo: string }[];
}> {
  const { data, error } = await db
    .from("beneficio_revision")
    .select("id, fuente_id, motivo")
    .eq("resuelto", false);
  if (error) throw new Error(`leyendo revisiones: ${error.message}`);

  const resueltas: string[] = [];
  const pendientes: { fuente_id: string; motivo: string }[] = [];

  for (const r of data ?? []) {
    const nombres = String(r.motivo)
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    // Los motivos que no son nombres de tarjeta (errores de validación) no se
    // pueden reevaluar así: quedan pendientes.
    const esDeProductos = nombres.length > 0 && !nombres.some((n) => n.startsWith("tramo "));
    const { desconocidos } = esDeProductos
      ? mapearProductos(r.fuente_id as string, nombres)
      : { desconocidos: nombres };

    if (esDeProductos && desconocidos.length === 0) resueltas.push(r.id as string);
    else pendientes.push({ fuente_id: r.fuente_id as string, motivo: String(r.motivo) });
  }

  if (resueltas.length > 0) {
    const { error: e } = await db
      .from("beneficio_revision")
      .update({ resuelto: true })
      .in("id", resueltas);
    if (e) throw new Error(`resolviendo revisiones: ${e.message}`);
  }

  return { revisadas: data?.length ?? 0, resueltas: resueltas.length, pendientes };
}
