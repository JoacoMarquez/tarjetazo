import type { SupabaseClient } from "@supabase/supabase-js";

/** Reglas creadas desde el backoffice, por fuente y por texto ya normalizado. */
export interface ReglasDb {
  alias: Map<string, Map<string, string[]>>;
  ignorar: Map<string, Set<string>>;
}

export const SIN_REGLAS: ReglasDb = { alias: new Map(), ignorar: new Map() };

/**
 * Si las tablas todavía no existen (la migración se aplica aparte del deploy
 * del cron) o la lectura falla, la corrida sigue solo con las reglas de código:
 * un alias de menos manda algo a revisión, no rompe nada.
 */
export async function cargarReglasDb(db: SupabaseClient): Promise<ReglasDb> {
  const [alias, ignorar] = await Promise.all([
    db.from("producto_alias").select("fuente_id, texto, producto_ids"),
    db.from("regla_ignorar").select("fuente_id, texto"),
  ]);
  const fallo = alias.error ?? ignorar.error;
  if (fallo) {
    console.error(`  reglas del backoffice no disponibles (${fallo.message}): sigo con las de código`);
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
