import { createSupabaseClient } from "./supabase";
import { diaEnUruguay } from "./filtros";
import type { BeneficioListado } from "./consultas";

export interface Resumen {
  beneficios: number;
  comercios: number;
  fuentes: number;
  sucursales: number;
}

/** Un beneficio cuenta si no venció; los sin fecha no vencen nunca. */
function vigentes(hoy: string) {
  return `vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`;
}

export async function resumen(): Promise<Resumen> {
  const db = createSupabaseClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const cuenta = { count: "exact" as const, head: true };

  const [beneficios, comercios, fuentes, sucursales] = await Promise.all([
    db.from("beneficio").select("*", cuenta).eq("estado_revision", "ok").or(vigentes(hoy)),
    db.from("comercio").select("*", cuenta).gt("n_beneficios", 0),
    db.from("fuente").select("*", cuenta).eq("activa", true),
    db.from("sucursal").select("*", cuenta).not("geom", "is", null),
  ]);

  return {
    beneficios: beneficios.count ?? 0,
    comercios: comercios.count ?? 0,
    fuentes: fuentes.count ?? 0,
    sucursales: sucursales.count ?? 0,
  };
}

/** Lo mejor que hay hoy: es el ejemplo real que muestra la home. */
export async function hoyTeConviene(cantidad = 6): Promise<BeneficioListado[]> {
  const db = createSupabaseClient();
  const { data, error } = await db.rpc("beneficios_filtrados", {
    p_dia: diaEnUruguay(),
    p_orden: "porcentaje",
    p_limit: cantidad,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as BeneficioListado[];
}
