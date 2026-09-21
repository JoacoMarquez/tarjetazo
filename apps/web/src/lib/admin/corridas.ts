/**
 * Lectura del registro de corridas para el dashboard. Lógica pura: las queries
 * viven en las páginas, que son las que llaman a `exigirAdmin()`.
 */

export type Corrida = {
  id: string;
  fuente_id: string;
  empezo_en: string;
  termino_en: string | null;
  paginas: number;
  sin_cambios: number;
  nuevos: number;
  actualizados: number;
  vencidos: number;
  a_revisar: number;
  error: string | null;
};

export type EstadoCorrida = "ok" | "error" | "en_curso" | "trabada";

/** Mismo umbral que `hayCorridaAbierta` del runner: abierta hace más de una hora = trabada. */
const MS_VIVA = 60 * 60 * 1000;
/**
 * El cron es diario, pero GitHub lo arranca cuando puede: en la práctica entre
 * las 09:30 y las 13:00 UY. Con 30 h de margen, que un día arranque tres horas
 * más tarde que el anterior no aparece como "no corrió".
 */
const MS_DIARIA = 30 * 60 * 60 * 1000;

export function estadoCorrida(c: Corrida, ahora: number): EstadoCorrida {
  if (c.error) return "error";
  if (c.termino_en) return "ok";
  return ahora - Date.parse(c.empezo_en) > MS_VIVA ? "trabada" : "en_curso";
}

export type EstadoFuente = EstadoCorrida | "sin_correr";

export type FuenteConCorridas = {
  fuenteId: string;
  /** "sin_correr": la última corrida terminó bien pero es de hace más de un día. */
  estado: EstadoFuente;
  corridas: Corrida[];
};

/**
 * Agrupa por fuente (las corridas llegan de más nueva a más vieja) y deja
 * primero las fuentes con problemas, que es lo que se entra a mirar.
 */
export function agruparPorFuente(
  corridas: Corrida[],
  ahora: number,
  porFuente: number,
): FuenteConCorridas[] {
  const grupos = new Map<string, Corrida[]>();
  for (const c of corridas) {
    const lista = grupos.get(c.fuente_id) ?? [];
    if (lista.length < porFuente) lista.push(c);
    grupos.set(c.fuente_id, lista);
  }

  const fuentes = [...grupos].map(([fuenteId, lista]): FuenteConCorridas => {
    const ultima = lista[0]!;
    const estado = estadoCorrida(ultima, ahora);
    const vieja = ahora - Date.parse(ultima.empezo_en) > MS_DIARIA;
    return {
      fuenteId,
      estado: estado === "ok" && vieja ? "sin_correr" : estado,
      corridas: lista,
    };
  });

  const peso = (e: EstadoFuente) => (e === "ok" || e === "en_curso" ? 1 : 0);
  return fuentes.sort(
    (a, b) => peso(a.estado) - peso(b.estado) || a.fuenteId.localeCompare(b.fuenteId),
  );
}

/** "4 min 12 s"; `null` si la corrida no terminó. */
export function duracion(c: Corrida): string | null {
  if (!c.termino_en) return null;
  const s = Math.max(0, Math.round((Date.parse(c.termino_en) - Date.parse(c.empezo_en)) / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

export const ETIQUETA_ESTADO: Record<EstadoFuente, string> = {
  ok: "OK",
  error: "Error",
  en_curso: "En curso",
  trabada: "Trabada",
  sin_correr: "No corrió",
};
