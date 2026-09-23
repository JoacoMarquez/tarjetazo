import type { SupabaseClient } from "@supabase/supabase-js";
import { conReintentos } from "./db.js";

/** Reglas creadas desde el backoffice, por fuente y por texto ya normalizado. */
export interface ReglasDb {
  alias: Map<string, Map<string, string[]>>;
  ignorar: Map<string, Set<string>>;
  /** Comercios fusionados desde el backoffice: clave vieja → la que quedó (#25). */
  comercios: Map<string, string>;
}

export const SIN_REGLAS: ReglasDb = { alias: new Map(), ignorar: new Map(), comercios: new Map() };

/** PostgREST (tabla fuera del schema cache) y Postgres (relación inexistente). */
const TABLA_INEXISTENTE = new Set(["PGRST205", "42P01"]);

/**
 * Si las tablas todavía no existen (la migración se aplica aparte del deploy
 * del cron), la corrida sigue solo con las reglas de código.
 *
 * Cualquier otro error se reintenta y, si persiste, **corta la corrida**. No se
 * puede seguir sin reglas: una página marcada para re-normalizar por un alias
 * se normalizaría sin él, se guardaría su hash y el alias no se aplicaría
 * nunca, después de haber pagado la llamada al modelo. Pasó en una prueba con
 * un "JWT issued at future" pasajero de Supabase.
 */
export async function cargarReglasDb(db: SupabaseClient): Promise<ReglasDb> {
  const leer = async () => {
    const [alias, ignorar, comercios] = await Promise.all([
      db.from("producto_alias").select("fuente_id, texto, producto_ids"),
      db.from("regla_ignorar").select("fuente_id, texto"),
      db.from("comercio_alias").select("alias_key, comercio_key"),
    ]);
    const fallo = alias.error ?? ignorar.error ?? comercios.error;
    if (fallo && !TABLA_INEXISTENTE.has(fallo.code ?? "")) throw new Error(fallo.message);
    return { alias, ignorar, comercios, faltanTablas: Boolean(fallo) };
  };
  const { alias, ignorar, comercios, faltanTablas } = await conReintentos("leyendo reglas del backoffice", leer);
  if (faltanTablas) {
    console.error("  las tablas de reglas del backoffice no existen todavía: sigo con las de código");
    return SIN_REGLAS;
  }

  const reglas: ReglasDb = {
    alias: new Map(),
    ignorar: new Map(),
    comercios: new Map(
      (comercios.data ?? []).map((c) => [c.alias_key as string, c.comercio_key as string]),
    ),
  };
  for (const a of alias.data ?? []) {
    const porFuente = reglas.alias.get(a.fuente_id as string) ?? new Map<string, string[]>();
    porFuente.set(a.texto as string, a.producto_ids as string[]);
    reglas.alias.set(a.fuente_id as string, porFuente);
  }
  for (const i of ignorar.data ?? []) {
    const porFuente = reglas.ignorar.get(i.fuente_id as string) ?? new Set<string>();
    porFuente.add(i.texto as string);
    reglas.ignorar.set(i.fuente_id as string, porFuente);
  }
  return reglas;
}
