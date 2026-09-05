import { CATEGORIAS, FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { createSupabaseClient } from "./supabase";
import { diaEnUruguay } from "./filtros";

export interface Comercio {
  key: string;
  nombre: string;
  categoria: string;
  logo_url: string | null;
  best_pct: number | null;
  max_cuotas: number | null;
  n_beneficios: number;
  n_fuentes: number;
}

/** Fila completa de `beneficio`, con todo lo que la ficha necesita mostrar. */
export interface BeneficioFicha {
  id: string;
  fuente_id: string;
  comercio_key: string;
  titulo: string;
  descuento_raw: string;
  porcentaje: number | null;
  cuotas: number | null;
  tipo: "porcentaje" | "cuotas" | "reintegro" | "2x1";
  dias_semana: number[];
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  departamentos: string[];
  productos_elegibles: string[];
  tope_monto: number | null;
  tope_periodo: string | null;
  canal: "presencial" | "online" | "ambos";
  mecanica: string[];
  acumulable: boolean | null;
  compra_minima: number | null;
  requiere_activacion: boolean;
  legales_raw: string | null;
  como_usarlo: string[];
  url_fuente: string;
  fetched_at: string;
}

export interface Sucursal {
  id: string;
  nombre: string | null;
  direccion: string;
  localidad: string | null;
  departamento: string;
  lat: number;
  lng: number;
  precision: string;
}

const LABEL_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.slug, c.label]));
const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id, f.nombre]));
const NOMBRE_PRODUCTO = new Map(PRODUCTOS.map((p) => [p.id, p.nombre]));

export const labelCategoria = (slug: string) => LABEL_CATEGORIA.get(slug) ?? slug;
export const nombreFuente = (id: string) => NOMBRE_FUENTE.get(id) ?? id;
export const nombreProducto = (id: string) => NOMBRE_PRODUCTO.get(id) ?? id;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Un beneficio está vigente si no venció y ya empezó; los sin fecha no vencen. */
export function vigente(b: Pick<BeneficioFicha, "vigencia_desde" | "vigencia_hasta">, hoy = hoyISO()) {
  return (!b.vigencia_desde || b.vigencia_desde <= hoy) && (!b.vigencia_hasta || b.vigencia_hasta >= hoy);
}

/** Aplica hoy: no restringe días o incluye el de hoy (en Uruguay). */
export function aplicaHoy(b: Pick<BeneficioFicha, "dias_semana">) {
  return b.dias_semana.length === 0 || b.dias_semana.includes(diaEnUruguay());
}

export async function fichaComercio(key: string): Promise<{
  comercio: Comercio;
  beneficios: BeneficioFicha[];
  sucursales: Sucursal[];
} | null> {
  const db = createSupabaseClient();
  const [c, b, s] = await Promise.all([
    db.from("comercio").select("*").eq("key", key).maybeSingle(),
    db
      .from("beneficio")
      .select("*")
      .eq("comercio_key", key)
      .eq("estado_revision", "ok")
      .order("porcentaje", { ascending: false, nullsFirst: false })
      .order("cuotas", { ascending: false, nullsFirst: false }),
    db.rpc("sucursales_de_comercio", { p_key: key }),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  if (b.error) throw new Error(b.error.message);
  // Sin la función en la base (migración pendiente) la página igual sirve:
  // los locales son un extra, no el contenido.
  const sucursales = s.error ? [] : ((s.data ?? []) as Sucursal[]);

  const hoy = hoyISO();
  return {
    comercio: c.data as Comercio,
    beneficios: ((b.data ?? []) as BeneficioFicha[]).filter((x) => vigente(x, hoy)),
    sucursales,
  };
}

/** Otros comercios del mismo rubro con beneficios, para enlazar entre páginas. */
export async function comerciosDelRubro(categoria: string, excluir: string, limite = 8): Promise<Comercio[]> {
  const db = createSupabaseClient();
  const { data, error } = await db
    .from("comercio")
    .select("*")
    .eq("categoria", categoria)
    .neq("key", excluir)
    .gt("n_beneficios", 0)
    .order("best_pct", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as Comercio[];
}

/** Todas las claves de comercios con beneficios: sitemap y rutas estáticas. */
export async function clavesDeComercios(): Promise<{ key: string; updated_at: string }[]> {
  const db = createSupabaseClient();
  const { data, error } = await db
    .from("comercio")
    .select("key, updated_at")
    .gt("n_beneficios", 0)
    .order("key")
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as { key: string; updated_at: string }[];
}

/** Un porcentaje o "N cuotas" o "2x1", para títulos y JSON-LD. */
export function cifra(b: Pick<BeneficioFicha, "tipo" | "porcentaje" | "cuotas">): string {
  if (b.tipo === "2x1") return "2x1";
  if (b.tipo === "cuotas" && b.cuotas) return `${b.cuotas} cuotas`;
  if (b.porcentaje != null) return `${Math.round(b.porcentaje)}%`;
  return b.tipo;
}

export function pesos(n: number): string {
  return `$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}
