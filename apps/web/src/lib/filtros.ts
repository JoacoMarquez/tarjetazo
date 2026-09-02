import { CATEGORIAS, Departamento, TipoBeneficio } from "@tarjetazo/core";

export type Orden = "relevancia" | "porcentaje" | "cuotas";
/** "hoy" y "manana" se resuelven en el cliente contra la fecha de Uruguay. */
export type Dia = "hoy" | "manana" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | null;

export interface Filtros {
  bancos: string[];
  productos: string[];
  categorias: string[];
  departamentos: string[];
  tipos: string[];
  dia: Dia;
  orden: Orden;
  soloMisTarjetas: boolean;
  /** Fija la lista a un comercio, cuando el usuario elige uno del buscador. */
  comercio: string | null;
  q: string;
}

export const FILTROS_VACIOS: Filtros = {
  bancos: [],
  productos: [],
  categorias: [],
  departamentos: [],
  tipos: [],
  dia: null,
  orden: "relevancia",
  soloMisTarjetas: false,
  comercio: null,
  q: "",
};

const ORDENES: Orden[] = ["relevancia", "porcentaje", "cuotas"];
const DIAS: Exclude<Dia, null>[] = ["hoy", "manana", "0", "1", "2", "3", "4", "5", "6"];

const CATS = new Set(CATEGORIAS.map((c) => c.slug));
const DEPTOS = new Set<string>(Departamento.options);
const TIPOS = new Set<string>(TipoBeneficio.options);

function lista(v: string | null, valido?: Set<string>): string[] {
  if (!v) return [];
  const partes = v.split(",").map((x) => x.trim()).filter(Boolean);
  return valido ? partes.filter((x) => valido.has(x)) : partes;
}

export function leerFiltros(params: URLSearchParams): Filtros {
  const dia = params.get("dia");
  const orden = params.get("orden");
  return {
    bancos: lista(params.get("bancos")),
    productos: lista(params.get("productos")),
    categorias: lista(params.get("cat"), CATS),
    departamentos: lista(params.get("depto"), DEPTOS),
    tipos: lista(params.get("tipo"), TIPOS),
    dia: DIAS.includes(dia as Exclude<Dia, null>) ? (dia as Dia) : null,
    orden: ORDENES.includes(orden as Orden) ? (orden as Orden) : "relevancia",
    soloMisTarjetas: params.get("mias") === "1",
    comercio: params.get("comercio"),
    q: params.get("q") ?? "",
  };
}

/** Solo escribimos lo que difiere del default: las URLs quedan compartibles. */
export function escribirFiltros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  if (f.bancos.length) p.set("bancos", f.bancos.join(","));
  if (f.productos.length) p.set("productos", f.productos.join(","));
  if (f.categorias.length) p.set("cat", f.categorias.join(","));
  if (f.departamentos.length) p.set("depto", f.departamentos.join(","));
  if (f.tipos.length) p.set("tipo", f.tipos.join(","));
  if (f.dia) p.set("dia", f.dia);
  if (f.orden !== "relevancia") p.set("orden", f.orden);
  if (f.soloMisTarjetas) p.set("mias", "1");
  if (f.comercio) p.set("comercio", f.comercio);
  if (f.q) p.set("q", f.q);
  return p;
}

/**
 * Uruguay no tiene horario de verano, así que el día "de hoy" es siempre
 * UTC-3 y se puede calcular sin librería de zonas horarias.
 */
export function diaEnUruguay(base = new Date()): number {
  return new Date(base.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
}

/** El día que hay que mandar a la base: 0=domingo … 6=sábado, o null. */
export function diaNumerico(dia: Dia): number | null {
  if (dia === null) return null;
  if (dia === "hoy") return diaEnUruguay();
  if (dia === "manana") return (diaEnUruguay() + 1) % 7;
  return Number(dia);
}

export const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
