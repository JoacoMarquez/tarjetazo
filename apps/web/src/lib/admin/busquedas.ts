/** Búsquedas sin resultado agrupadas (#24). Lógica pura. */

export type BusquedaDia = { q: string; dia: string; veces: number };
export type Termino = { q: string; veces: number; dias: number; ultima: string };

/**
 * Suma por término y saca los prefijos: el buscador consulta mientras se
 * escribe, así que "farmas" y "farmasho" llegan antes que "farmashopp". Un
 * término que es el comienzo de otro de la lista es ese mismo intento a medio
 * escribir.
 */
export function agruparBusquedas(filas: BusquedaDia[]): Termino[] {
  const por = new Map<string, Termino>();
  for (const f of filas) {
    const t = por.get(f.q) ?? { q: f.q, veces: 0, dias: 0, ultima: f.dia };
    t.veces += f.veces;
    t.dias += 1;
    if (f.dia > t.ultima) t.ultima = f.dia;
    por.set(f.q, t);
  }
  const todos = [...por.values()];
  return todos
    .filter((t) => !todos.some((o) => o.q !== t.q && o.q.startsWith(t.q)))
    .sort((a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima) || a.q.localeCompare(b.q));
}
