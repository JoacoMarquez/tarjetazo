import type { SupabaseClient } from "@supabase/supabase-js";
import { conReintentos } from "./db.js";

/** Reglas creadas desde el backoffice, por fuente y por texto ya normalizado. */
export interface ReglasDb {
  alias: Map<string, Map<string, string[]>>;
  ignorar: Map<string, Set<string>>;
}

export const SIN_REGLAS: ReglasDb = { alias: new Map(), ignorar: new Map() };

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
    const [alias, ignorar] = await Promise.all([
      db.from("producto_alias").select("fuente_id, texto, producto_ids"),
      db.from("regla_ignorar").select("fuente_id, texto"),
    ]);
    const fallo = alias.error ?? ignorar.error;
    if (fallo && !TABLA_INEXISTENTE.has(fallo.code ?? "")) throw new Error(fallo.message);
    return { alias, ignorar, faltanTablas: Boolean(fallo) };
  };
  const { alias, ignorar, faltanTablas } = await conReintentos("leyendo reglas del backoffice", leer);
  if (faltanTablas) {
    console.error("  las tablas de reglas del backoffice no existen todavía: sigo con las de código");
    return SIN_REGLAS;
  }

  const reglas: ReglasDb = { alias: new Map(), ignorar: new Map() };
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
