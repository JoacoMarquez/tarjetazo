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

/** Los seis rubros que muestra la grilla "Hoy … pagá así" de la home. */
export const RUBROS_DE_HOY = [
  { slug: "supermercados", label: "Supermercado" },
  { slug: "restaurantes", label: "Restaurantes" },
  { slug: "combustible", label: "Combustible" },
  { slug: "entretenimiento", label: "Cines" },
  { slug: "farmacias", label: "Farmacias" },
  { slug: "delivery", label: "Delivery" },
] as const;

export interface MejorDelRubro {
  rubro: string;
  slug: string;
  beneficio: BeneficioListado;
}

/**
 * El mejor beneficio de hoy en cada rubro de la home. Una consulta por rubro:
 * `beneficios_filtrados` ya ordena y recorta, así que pedir el primero de cada
 * uno sale más barato que traer todo y agrupar acá.
 */
export async function mejorPorRubro(): Promise<MejorDelRubro[]> {
  const db = createSupabaseClient();
  const dia = diaEnUruguay();
  const filas = await Promise.all(
    RUBROS_DE_HOY.map(async (r) => {
      const { data, error } = await db.rpc("beneficios_filtrados", {
        p_categorias: [r.slug],
        p_dia: dia,
        p_orden: "porcentaje",
        p_limit: 1,
      });
      if (error) throw new Error(error.message);
      const b = ((data ?? []) as BeneficioListado[])[0];
      return b ? ({ rubro: r.label, slug: r.slug, beneficio: b } as MejorDelRubro) : null;
    }),
  );
  return filas.filter((f): f is MejorDelRubro => f !== null);
}
