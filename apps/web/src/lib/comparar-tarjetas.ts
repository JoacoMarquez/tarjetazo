import { PRODUCTOS_ACTIVOS } from "@tarjetazo/core";
import type { BeneficioListado } from "./consultas";
import { listarBeneficios } from "./consultas";
import { FILTROS_VACIOS } from "./filtros";

/**
 * Modelo de la pestaña Comparar, portado de `comparar-data.js` del handoff.
 * Es aparte de `comparar.ts`, que resuelve el ranking de bancos de /banco y
 * /api/comparar y no tiene nada que ver con esto.
 */

export const RUBROS_COMPARAR = [
  { slug: "supermercados", label: "Supermercados", gasto: 18000 },
  { slug: "restaurantes", label: "Restaurantes", gasto: 6000 },
  { slug: "combustible", label: "Combustible", gasto: 8000 },
  { slug: "farmacias", label: "Farmacias", gasto: 3000 },
  { slug: "entretenimiento", label: "Entretenimiento", gasto: 2000 },
  { slug: "delivery", label: "Delivery", gasto: 3000 },
] as const;

export type SlugRubro = (typeof RUBROS_COMPARAR)[number]["slug"];

export const GASTO_DEF: Record<string, number> = Object.fromEntries(
  RUBROS_COMPARAR.map((r) => [r.slug, r.gasto]),
);

/** Un 2x1 equivale a la mitad, que es lo que efectivamente te ahorrás. */
export function pctDe(
  b: Pick<BeneficioListado, "tipo" | "porcentaje" | "cuotas">,
): number {
  if (b.tipo === "2x1") return 50;
  if (b.porcentaje != null) return Math.round(b.porcentaje);
  return 0;
}

/** Lo que el cliente necesita de un beneficio, ya reducido a lo mínimo. */
export interface Oferta {
  /** Descuento equivalente, 0–100. */
  p: number;
  /** Tope mensual en pesos, o `null` si no tiene. */
  t: number | null;
  /** Comercio del mejor beneficio de ese día. */
  c: string;
  /** Cuántos comercios más dan beneficio ese día (para el "+N"). */
  o: number;
}

/** producto → rubro → día (0 domingo … 6 sábado) → mejor oferta. */
export type Matriz = Record<string, Record<string, (Oferta | null)[]>>;

const PRODUCTOS_POR_FUENTE = new Map<string, string[]>();
for (const p of PRODUCTOS_ACTIVOS) {
  const xs = PRODUCTOS_POR_FUENTE.get(p.fuente_id) ?? [];
  xs.push(p.id);
  PRODUCTOS_POR_FUENTE.set(p.fuente_id, xs);
}

/**
 * Arma la matriz en el servidor. Mandarle al cliente los ~1.400 beneficios de
 * los seis rubros sería medio mega de HTML; acá quedan reducidos a la mejor
 * oferta por tarjeta, rubro y día, que es todo lo que la pantalla dibuja.
 */
export async function matrizComparar(): Promise<Matriz> {
  const { beneficios } = await listarBeneficios(
    { ...FILTROS_VACIOS, categorias: RUBROS_COMPARAR.map((r) => r.slug) },
    0,
    3000,
  );

  const matriz: Matriz = {};
  // Comercios distintos por tarjeta/rubro/día, para el contador "+N".
  const comercios = new Map<string, Set<string>>();

  for (const b of beneficios) {
    const p = pctDe(b);
    if (p <= 0) continue;
    // Sin productos explícitos el beneficio vale para todas las del banco.
    const productos = b.productos_elegibles.length
      ? b.productos_elegibles
      : (PRODUCTOS_POR_FUENTE.get(b.fuente_id) ?? []);
    const dias = b.dias_semana.length ? b.dias_semana : [0, 1, 2, 3, 4, 5, 6];

    for (const pid of productos) {
      const porRubro = (matriz[pid] ??= {});
      const porDia = (porRubro[b.categoria] ??= Array(7).fill(null));
      for (const d of dias) {
        const clave = `${pid}|${b.categoria}|${d}`;
        const set = comercios.get(clave) ?? new Set<string>();
        set.add(b.comercio_key);
        comercios.set(clave, set);

        const actual = porDia[d];
        if (!actual || p > actual.p) {
          porDia[d] = { p, t: b.tope_monto, c: b.comercio, o: 0 };
        }
      }
    }
  }

  for (const [clave, set] of comercios) {
    const [pid, rubro, dia] = clave.split("|");
    const celda = matriz[pid!]?.[rubro!]?.[Number(dia)];
    if (celda) celda.o = set.size - 1;
  }

  return matriz;
}

/** La mejor oferta de una tarjeta en un rubro entre los días elegidos. */
export function mejorOferta(
  matriz: Matriz,
  pid: string,
  rubro: string,
  dias: number[],
): Oferta | null {
  const porDia = matriz[pid]?.[rubro];
  if (!porDia) return null;
  let mejor: Oferta | null = null;
  for (const d of dias) {
    const o = porDia[d];
    if (o && (!mejor || o.p > mejor.p)) mejor = o;
  }
  return mejor;
}

/** Lo que te ahorrás por mes con esa oferta, acotado por el tope. */
export function ahorroDe(o: Oferta | null, gasto: number): number {
  if (!o) return 0;
  const bruto = (gasto * o.p) / 100;
  return o.t != null ? Math.min(bruto, o.t) : bruto;
}

export function fmt(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-UY")}`;
}

export interface Celda {
  oferta: Oferta | null;
  ahorro: number;
  gana: boolean;
}

export interface Columna {
  pid: string;
  celdas: Celda[];
  total: number;
  gana: number;
}

/** La matriz rubro × tarjeta de la pestaña 1, ya ordenada por total. */
export function construirColumnas(
  matriz: Matriz,
  seleccion: string[],
  dias: number[],
  gasto: Record<string, number>,
): Columna[] {
  const columnas: Columna[] = seleccion.map((pid) => ({
    pid,
    celdas: RUBROS_COMPARAR.map((r) => {
      const oferta = mejorOferta(matriz, pid, r.slug, dias);
      return {
        oferta,
        ahorro: ahorroDe(oferta, gasto[r.slug] ?? 0),
        gana: false,
      };
    }),
    total: 0,
    gana: 0,
  }));

  RUBROS_COMPARAR.forEach((_, i) => {
    const max = Math.max(
      0,
      ...columnas.map((c) => c.celdas[i]?.oferta?.p ?? 0),
    );
    for (const c of columnas) {
      const celda = c.celdas[i]!;
      celda.gana = (celda.oferta?.p ?? 0) > 0 && celda.oferta!.p === max;
    }
  });

  for (const c of columnas) {
    c.total = c.celdas.reduce((s, x) => s + x.ahorro, 0);
    c.gana = c.celdas.filter((x) => x.gana).length;
  }

  return columnas.sort((a, b) => b.total - a.total);
}

/** Lo que ya te ahorrás en un rubro con las tarjetas que tenés. */
export function ahorroPropio(
  matriz: Matriz,
  mis: string[],
  rubro: string,
  dias: number[],
  gasto: number,
): number {
  return Math.max(
    0,
    ...mis.map((id) => ahorroDe(mejorOferta(matriz, id, rubro, dias), gasto)),
  );
}

export interface Candidata {
  pid: string;
  /** Rubros donde le gana a todas las tuyas. */
  rubros: string[];
  /** Cuánto sumaría por mes sobre lo que ya te ahorrás. */
  extra: number;
}

/** Las tarjetas que no tenés, ordenadas por lo que sumarían. */
export function candidatas(
  matriz: Matriz,
  mis: string[],
  dias: number[],
  gasto: Record<string, number>,
): Candidata[] {
  const propio = Object.fromEntries(
    RUBROS_COMPARAR.map((r) => [
      r.slug,
      ahorroPropio(matriz, mis, r.slug, dias, gasto[r.slug] ?? 0),
    ]),
  );
  return PRODUCTOS_ACTIVOS.filter((p) => !mis.includes(p.id))
    .map((p) => {
      const rubros: string[] = [];
      let extra = 0;
      for (const r of RUBROS_COMPARAR) {
        const a = ahorroDe(
          mejorOferta(matriz, p.id, r.slug, dias),
          gasto[r.slug] ?? 0,
        );
        if (a > (propio[r.slug] ?? 0)) {
          rubros.push(r.label);
          extra += a - (propio[r.slug] ?? 0);
        }
      }
      return { pid: p.id, rubros, extra };
    })
    .filter((c) => c.extra > 0)
    .sort((a, b) => b.extra - a.extra);
}
