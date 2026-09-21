"use server";

import {
  PRODUCTOS,
  esErrorDeTramo,
  normalizarNombreTarjeta,
  problemasDeMotivo,
} from "@tarjetazo/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { armarCubiertos, pendientesDe, type Revision } from "@/lib/admin/revision";

type Db = ReturnType<typeof createSupabaseAdmin>;

const COLUMNAS = "id, fuente_id, motivo, url_fuente, created_at, descartados";

function volver(mensaje: string, error = false): never {
  revalidatePath("/admin/revision");
  revalidatePath("/admin");
  redirect(`/admin/revision?${error ? "error" : "ok"}=${encodeURIComponent(mensaje)}`);
}

async function pendientesDeFuente(db: Db, fuenteId: string): Promise<Revision[]> {
  const { data, error } = await db
    .from("beneficio_revision")
    .select(COLUMNAS)
    .eq("fuente_id", fuenteId)
    .eq("resuelto", false);
  if (error) throw new Error(`leyendo la cola: ${error.message}`);
  return (data ?? []) as Revision[];
}

/** Cierra las filas de la fuente a las que ya no les queda nada sin resolver. */
async function cerrarResueltas(db: Db, fuenteId: string): Promise<number> {
  const [filas, alias, ignorar] = await Promise.all([
    pendientesDeFuente(db, fuenteId),
    db.from("producto_alias").select("fuente_id, texto").eq("fuente_id", fuenteId),
    db.from("regla_ignorar").select("fuente_id, texto").eq("fuente_id", fuenteId),
  ]);
  const fallo = alias.error ?? ignorar.error;
  if (fallo) throw new Error(`leyendo reglas: ${fallo.message}`);

  const cubiertos = armarCubiertos([...(alias.data ?? []), ...(ignorar.data ?? [])]);
  const ids = filas.filter((r) => pendientesDe(r, cubiertos).length === 0).map((r) => r.id);
  if (ids.length > 0) {
    const { error } = await db.from("beneficio_revision").update({ resuelto: true }).in("id", ids);
    if (error) throw new Error(`cerrando revisiones: ${error.message}`);
  }
  return ids.length;
}

/** Filas pendientes de la fuente donde aparece ese nombre de tarjeta. */
function conNombre(filas: Revision[], texto: string): Revision[] {
  return filas.filter((r) =>
    problemasDeMotivo(r.motivo).some(
      (p) => !esErrorDeTramo(p) && normalizarNombreTarjeta(p) === texto,
    ),
  );
}

function campos(form: FormData) {
  const fuenteId = String(form.get("fuente_id") ?? "");
  const texto = normalizarNombreTarjeta(String(form.get("texto") ?? ""));
  if (!fuenteId || !texto) volver("Falta la fuente o el nombre.", true);
  return { fuenteId, texto };
}

/**
 * Crea el alias y marca las páginas afectadas para re-normalizar. Hace falta lo
 * segundo porque el beneficio ya está publicado *sin* esa tarjeta: el alias
 * solo tiene efecto cuando la página vuelve a pasar por el normalizador, y una
 * página con el mismo hash no pasa.
 */
export async function asignarTarjeta(form: FormData) {
  await exigirAdmin();
  const { fuenteId, texto } = campos(form);
  const validos = new Set(PRODUCTOS.filter((p) => p.fuente_id === fuenteId).map((p) => p.id));
  const productoIds = form
    .getAll("producto_ids")
    .map(String)
    .filter((id) => validos.has(id));
  if (productoIds.length === 0) volver("Elegí al menos una tarjeta.", true);

  const db = createSupabaseAdmin();
  const { error } = await db
    .from("producto_alias")
    .upsert(
      { fuente_id: fuenteId, texto, producto_ids: productoIds },
      { onConflict: "fuente_id,texto" },
    );
  if (error) volver(`No se pudo guardar el alias: ${error.message}`, true);

  const urls = [
    ...new Set(
      conNombre(await pendientesDeFuente(db, fuenteId), texto)
        .map((r) => r.url_fuente)
        .filter((u): u is string => Boolean(u)),
    ),
  ];
  if (urls.length > 0) {
    // Hash vacío = "cambió": la próxima corrida la vuelve a normalizar.
    const { error: e } = await db
      .from("pagina_cruda")
      .update({ hash: "" })
      .eq("fuente_id", fuenteId)
      .in("url_fuente", urls);
    if (e) volver(`Alias guardado, pero no se pudieron marcar las páginas: ${e.message}`, true);
  }

  const cerradas = await cerrarResueltas(db, fuenteId);
  volver(
    `Alias guardado. ${cerradas} en la cola resueltas; ${urls.length} páginas se re-normalizan en la próxima corrida.`,
  );
}

export async function ignorarSiempre(form: FormData) {
  await exigirAdmin();
  const { fuenteId, texto } = campos(form);
  const db = createSupabaseAdmin();
  const { error } = await db
    .from("regla_ignorar")
    .upsert({ fuente_id: fuenteId, texto }, { onConflict: "fuente_id,texto" });
  if (error) volver(`No se pudo guardar la regla: ${error.message}`, true);

  const cerradas = await cerrarResueltas(db, fuenteId);
  volver(`Regla guardada: ese nombre no vuelve a la cola. ${cerradas} resueltas.`);
}

/** Descarta ese problema en las filas donde aparece hoy, sin crear una regla. */
export async function descartar(form: FormData) {
  await exigirAdmin();
  const fuenteId = String(form.get("fuente_id") ?? "");
  const clave = String(form.get("clave") ?? "");
  const esTramo = form.get("es_tramo") === "1";
  if (!fuenteId || !clave) volver("Falta la fuente o el problema.", true);

  const db = createSupabaseAdmin();
  const filas = await pendientesDeFuente(db, fuenteId);
  let tocadas = 0;
  for (const r of filas) {
    const suyos = problemasDeMotivo(r.motivo).filter((p) =>
      esTramo ? p === clave : !esErrorDeTramo(p) && normalizarNombreTarjeta(p) === clave,
    );
    const nuevos = suyos.filter((p) => !r.descartados.includes(p));
    if (nuevos.length === 0) continue;
    const { error } = await db
      .from("beneficio_revision")
      .update({ descartados: [...r.descartados, ...nuevos] })
      .eq("id", r.id);
    if (error) volver(`No se pudo descartar: ${error.message}`, true);
    tocadas++;
  }

  const cerradas = await cerrarResueltas(db, fuenteId);
  volver(`Descartado en ${tocadas} filas; ${cerradas} resueltas.`);
}
