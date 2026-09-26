/**
 * Catálogo público de tarjetas (#70): todas las familias con su ficha y
 * cuántos beneficios vigentes les aplican. La página `/tarjetas` filtra y
 * ordena en el cliente sobre esta lista; acá vive todo lo que no toca React
 * (lectura de la base, clasificación del programa, filtros en la URL).
 */
import { FAMILIAS_TARJETA, FUENTES, type Familia, type Red } from "@tarjetazo/core";
import { COLUMNAS_FICHA, urlImagen, type Ficha } from "@/lib/fichas";
import { pieDeFamilia } from "@/lib/marca";
import { createSupabaseClient } from "@/lib/supabase";

export type TipoTarjeta = "credito" | "debito" | "prepaga";
export type Programa = "millas" | "puntos";
export type CostoFiltro = "sin_costo" | "bonificable";
export type OrdenCatalogo = "beneficios" | "costo" | "ingreso";

export interface TarjetaCatalogo {
  /** Id de familia: la ruta es `/tarjeta/[id]`. */
  id: string;
  fuente_id: string;
  banco: string;
  nombre: string;
  /** "Visa Infinite + Mastercard Black + Débito". */
  pie: string;
  tipos: TipoTarjeta[];
  redes: Red[];
  costo_anual: number | null;
  costo_moneda: Ficha["costo_moneda"];
  costo_bonificado: string | null;
  ingreso_minimo: number | null;
  programa: Programa | null;
  /** URL pública de la foto del frente, si hay. */
  frente: string | null;
  /** Beneficios vigentes que aplican (incluye los "para todas las tarjetas del banco"). */
  vigentes: number;
  /** Los que nombran únicamente plásticos de esta familia. */
  exclusivos: number;
}

export interface FiltrosCatalogo {
  bancos: string[];
  tipos: TipoTarjeta[];
  redes: Red[];
  costo: CostoFiltro | null;
  /** En pesos; null = cualquiera. */
  ingresoHasta: number | null;
  programa: Programa | null;
  orden: OrdenCatalogo;
}

export const FILTROS_CATALOGO_VACIOS: FiltrosCatalogo = {
  bancos: [],
  tipos: [],
  redes: [],
  costo: null,
  ingresoHasta: null,
  programa: null,
  orden: "beneficios",
};

export const TIPOS_TARJETA: { valor: TipoTarjeta; label: string }[] = [
  { valor: "credito", label: "Crédito" },
  { valor: "debito", label: "Débito" },
  { valor: "prepaga", label: "Prepaga" },
];

export const REDES_TARJETA: { valor: Red; label: string }[] = [
  { valor: "visa", label: "Visa" },
  { valor: "mastercard", label: "Mastercard" },
  { valor: "amex", label: "Amex" },
  { valor: "propia", label: "Propia" },
];

export const COSTOS: { valor: CostoFiltro; label: string }[] = [
  { valor: "sin_costo", label: "Sin costo" },
  { valor: "bonificable", label: "Bonificable" },
];

export const PROGRAMAS: { valor: Programa; label: string }[] = [
  { valor: "millas", label: "Millas" },
  { valor: "puntos", label: "Puntos" },
];

/** Topes de ingreso mínimo para el selector, en pesos. */
export const INGRESOS = [30000, 50000, 80000, 120000];

export const ORDENES_CATALOGO: { valor: OrdenCatalogo; label: string }[] = [
  { valor: "beneficios", label: "Más beneficios" },
  { valor: "costo", label: "Menor costo anual" },
  { valor: "ingreso", label: "Menor ingreso mínimo" },
];

const MILLAS = /\b(millas?|aadvantage|latam|smiles|volar)\b/i;

/**
 * El programa de la ficha es texto libre ("Scotia Puntos (1 punto cada $100)",
 * "Volar: 1 milla Itaú por dólar"). Millas si nombra un programa aéreo; todo
 * lo demás que exista son puntos (Metraje de OCA, Recompensa de BROU).
 */
export function clasificarPrograma(texto: string | null | undefined): Programa | null {
  const t = texto?.trim();
  if (!t) return null;
  return MILLAS.test(t) ? "millas" : "puntos";
}

const BANCOS = new Set(FUENTES.map((f) => f.id));
const TIPOS = new Set<string>(TIPOS_TARJETA.map((t) => t.valor));
const REDES = new Set<string>(REDES_TARJETA.map((r) => r.valor));
const ORDENES = new Set<string>(ORDENES_CATALOGO.map((o) => o.valor));

function lista<T extends string>(v: string | null, valido: Set<string>): T[] {
  if (!v) return [];
  return v.split(",").map((x) => x.trim()).filter((x) => valido.has(x)) as T[];
}

export function leerFiltrosCatalogo(params: URLSearchParams): FiltrosCatalogo {
  const costo = params.get("costo");
  const programa = params.get("programa");
  const orden = params.get("orden");
  const ingreso = Number(params.get("ingreso"));
  return {
    bancos: lista(params.get("banco"), BANCOS),
    tipos: lista(params.get("tipo"), TIPOS),
    redes: lista(params.get("red"), REDES),
    costo: costo === "sin_costo" || costo === "bonificable" ? costo : null,
    ingresoHasta: Number.isFinite(ingreso) && ingreso > 0 ? ingreso : null,
    programa: programa === "millas" || programa === "puntos" ? programa : null,
    orden: ORDENES.has(orden ?? "") ? (orden as OrdenCatalogo) : "beneficios",
  };
}

/** Solo lo que difiere del default, para que `/tarjetas` sin filtros quede limpia. */
export function escribirFiltrosCatalogo(f: FiltrosCatalogo): URLSearchParams {
  const p = new URLSearchParams();
  if (f.bancos.length) p.set("banco", f.bancos.join(","));
  if (f.tipos.length) p.set("tipo", f.tipos.join(","));
  if (f.redes.length) p.set("red", f.redes.join(","));
  if (f.costo) p.set("costo", f.costo);
  if (f.ingresoHasta) p.set("ingreso", String(f.ingresoHasta));
  if (f.programa) p.set("programa", f.programa);
  if (f.orden !== "beneficios") p.set("orden", f.orden);
  return p;
}

export function hayFiltrosCatalogo(f: FiltrosCatalogo): boolean {
  return (
    f.bancos.length > 0 ||
    f.tipos.length > 0 ||
    f.redes.length > 0 ||
    f.costo !== null ||
    f.ingresoHasta !== null ||
    f.programa !== null
  );
}

/**
 * Banco, tipo y red valen para todas las tarjetas. Costo, ingreso y programa
 * solo existen en las fichas cargadas: una tarjeta sin el dato se muestra
 * siempre, salvo que el usuario filtre justamente por ese dato.
 */
export function filtrarCatalogo(tarjetas: TarjetaCatalogo[], f: FiltrosCatalogo): TarjetaCatalogo[] {
  return tarjetas.filter((t) => {
    if (f.bancos.length && !f.bancos.includes(t.fuente_id)) return false;
    if (f.tipos.length && !t.tipos.some((x) => f.tipos.includes(x))) return false;
    if (f.redes.length && !t.redes.some((x) => f.redes.includes(x))) return false;
    if (f.costo === "sin_costo" && t.costo_anual !== 0) return false;
    if (f.costo === "bonificable" && !t.costo_bonificado) return false;
    if (f.ingresoHasta !== null && (t.ingreso_minimo === null || t.ingreso_minimo > f.ingresoHasta)) return false;
    if (f.programa && t.programa !== f.programa) return false;
    return true;
  });
}

/**
 * Cotizaciones aproximadas para ordenar costos en monedas distintas (hoy las
 * fichas están en UI o en pesos). Solo comparan: nunca se muestran.
 */
const A_PESOS: Record<string, number> = { UYU: 1, UI: 6.6, USD: 42 };

function costoEnPesos(t: TarjetaCatalogo): number | null {
  if (t.costo_anual === null) return null;
  return t.costo_anual * (A_PESOS[t.costo_moneda ?? "UYU"] ?? 1);
}

/** Menor primero; sin dato al fondo. */
function ascendente(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function ordenarCatalogo(tarjetas: TarjetaCatalogo[], orden: OrdenCatalogo): TarjetaCatalogo[] {
  const porBeneficios = (a: TarjetaCatalogo, b: TarjetaCatalogo) =>
    b.vigentes - a.vigentes || b.exclusivos - a.exclusivos || a.nombre.localeCompare(b.nombre, "es");
  const xs = [...tarjetas];
  switch (orden) {
    case "costo":
      return xs.sort((a, b) => ascendente(costoEnPesos(a), costoEnPesos(b)) || porBeneficios(a, b));
    case "ingreso":
      return xs.sort((a, b) => ascendente(a.ingreso_minimo, b.ingreso_minimo) || porBeneficios(a, b));
    default:
      return xs.sort(porBeneficios);
  }
}

const NOMBRE_FUENTE = Object.fromEntries(FUENTES.map((f) => [f.id, f.nombre]));

/** Una fila de `beneficios_por_familia`. */
type Conteo = { familia_id: string; vigentes: number; exclusivos: number };

function tiposDe(f: Familia): TipoTarjeta[] {
  const out = new Set<TipoTarjeta>();
  for (const p of f.productos) {
    // El "saldo" de una billetera se usa como una prepaga; una membresía no
    // está en el catálogo (esTarjeta) y no cuenta como tipo.
    if (p.instrumento === "membresia") continue;
    out.add(p.instrumento === "saldo" ? "prepaga" : p.instrumento);
  }
  return [...out];
}

function armar(f: Familia, ficha: Ficha | undefined, conteo: { vigentes: number; exclusivos: number } | undefined): TarjetaCatalogo {
  return {
    id: f.id,
    fuente_id: f.fuente_id,
    banco: NOMBRE_FUENTE[f.fuente_id] ?? f.fuente_id,
    nombre: f.nombre,
    pie: pieDeFamilia(f),
    tipos: tiposDe(f),
    redes: [...new Set(f.productos.map((p) => p.red))],
    costo_anual: ficha?.costo_anual ?? null,
    costo_moneda: ficha?.costo_moneda ?? null,
    costo_bonificado: ficha?.costo_bonificado ?? null,
    ingreso_minimo: ficha?.ingreso_minimo ?? null,
    programa: clasificarPrograma(ficha?.programa),
    frente: urlImagen(ficha?.imagen_frente),
    vigentes: conteo?.vigentes ?? 0,
    exclusivos: conteo?.exclusivos ?? 0,
  };
}

/**
 * Todas las familias activas que son tarjetas (sin el saldo de las
 * billeteras ni TuApp) con ficha y conteos. Si la base no responde
 * (build sin credenciales) sale igual: nombres y fotos genéricas, cero
 * beneficios, y la página avisa que faltan datos.
 */
export async function leerCatalogo(): Promise<{ tarjetas: TarjetaCatalogo[]; conDatos: boolean }> {
  try {
    const db = createSupabaseClient();
    const [fichas, conteos] = await Promise.all([
      db.from("producto_ficha").select(COLUMNAS_FICHA).returns<Ficha[]>(),
      db.rpc("beneficios_por_familia", {
        p_familias: FAMILIAS_TARJETA.map((f) => ({ id: f.id, fuente_id: f.fuente_id, productos: f.productos.map((p) => p.id) })),
      }),
    ]);
    if (fichas.error) throw fichas.error;
    if (conteos.error) throw conteos.error;
    const fichaPor = new Map((fichas.data ?? []).map((x) => [x.familia_id, x]));
    const conteoPor = new Map(((conteos.data ?? []) as Conteo[]).map((x) => [x.familia_id, x]));
    return { tarjetas: FAMILIAS_TARJETA.map((f) => armar(f, fichaPor.get(f.id), conteoPor.get(f.id))), conDatos: true };
  } catch {
    return { tarjetas: FAMILIAS_TARJETA.map((f) => armar(f, undefined, undefined)), conDatos: false };
  }
}
