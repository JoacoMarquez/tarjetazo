"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { FUENTES_EDITABLES, type SugerenciaUbicacion } from "@/lib/admin/comercios";
import { geocodificar, slugDepartamento } from "@/lib/admin/geo";

function volver(key: string, mensaje: string, error = false): never {
  revalidatePath("/admin/comercios", "layout");
  redirect(`/admin/comercios/${encodeURIComponent(key)}?${error ? "error" : "ok"}=${encodeURIComponent(mensaje)}` as never);
}

const punto = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;

/** Acepta una sugerencia de OSM: pasa a ser una sucursal y el comercio aparece en el mapa. */
export async function aceptarUbicacion(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const db = createSupabaseAdmin();
  const { data: s, error } = await db
    .from("sucursal_sugerencia")
    .select("*")
    .eq("id", id)
    .eq("estado", "pendiente")
    .maybeSingle<SugerenciaUbicacion>();
  if (error || !s) volver(String(form.get("comercio_key") ?? ""), "La sugerencia ya no está pendiente.", true);
  if (!s.departamento) volver(s.comercio_key, "La sugerencia no trae departamento: cargala a mano.", true);

  const { error: e } = await db.from("sucursal").insert({
    comercio_key: s.comercio_key,
    nombre: s.nombre,
    direccion: s.direccion,
    localidad: s.localidad,
    departamento: s.departamento,
    geom: punto(s.lat, s.lng),
    precision: "exacta",
    fuente_direccion: "osm_sugerencia",
    osm_id: s.osm_id,
    geocoded_at: new Date().toISOString(),
  });
  // 23505: ese local de OSM ya estaba cargado (otra cadena, otra aceptación).
  if (e && e.code !== "23505") volver(s.comercio_key, `No se pudo guardar: ${e.message}`, true);

  await db.from("sucursal_sugerencia").update({ estado: "aceptada", resuelta_en: new Date().toISOString() }).eq("id", id);
  volver(s.comercio_key, e ? "Ese local ya estaba cargado; la sugerencia queda aceptada." : "Sucursal agregada: ya aparece en el mapa.");
}

export async function ignorarUbicacion(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const key = String(form.get("comercio_key") ?? "");
  const db = createSupabaseAdmin();
  const { error } = await db
    .from("sucursal_sugerencia")
    .update({ estado: "ignorada", resuelta_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) volver(key, `No se pudo ignorar: ${error.message}`, true);
  volver(key, "Sugerencia ignorada: no se vuelve a sugerir.");
}

/**
 * Sucursal cargada a mano: se geocodifica con el servicio oficial y queda con
 * `fuente_direccion = 'manual'`. El scraper nunca borra sucursales, así que
 * no la pisa.
 */
export async function agregarSucursal(form: FormData) {
  await exigirAdmin();
  const key = String(form.get("comercio_key") ?? "");
  const direccion = String(form.get("direccion") ?? "").trim();
  const localidad = String(form.get("localidad") ?? "").trim();
  const departamento = slugDepartamento(String(form.get("departamento") ?? ""));
  if (!key || !direccion || !departamento) volver(key, "Falta la dirección o el departamento.", true);

  const p = await geocodificar([direccion, localidad, departamento.replace(/-/g, " ")].filter(Boolean).join(", "));
  if (!p) volver(key, `No se encontró «${direccion}» en ${departamento}. Probá con calle y número, o calle y esquina.`, true);
  const deptoEncontrado = slugDepartamento(p.departamento);
  if (deptoEncontrado && deptoEncontrado !== departamento) {
    volver(key, `«${direccion}» se encontró en ${deptoEncontrado}, no en ${departamento}. Revisá la dirección.`, true);
  }

  const db = createSupabaseAdmin();
  const { error } = await db.from("sucursal").insert({
    comercio_key: key,
    nombre: String(form.get("nombre") ?? "").trim() || null,
    direccion,
    localidad: localidad || p.localidad,
    departamento,
    geom: punto(p.lat, p.lng),
    precision: p.precision,
    fuente_direccion: "manual",
    geocoded_at: new Date().toISOString(),
  });
  if (error) volver(key, error.code === "23505" ? "Esa dirección ya está cargada." : `No se pudo guardar: ${error.message}`, true);
  volver(
    key,
    `Sucursal agregada (${p.direccion ?? direccion}${p.precision !== "exacta" ? `, precisión: ${p.precision}` : ""}). Si el pin quedó mal, borrala y probá con otra dirección.`,
  );
}

/** Solo las que se cargaron desde acá: las de una fuente vuelven con la próxima corrida. */
export async function borrarSucursal(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const key = String(form.get("comercio_key") ?? "");
  const db = createSupabaseAdmin();
  const { data } = await db.from("sucursal").select("fuente_direccion").eq("id", id).maybeSingle<{ fuente_direccion: string | null }>();
  if (!data || !FUENTES_EDITABLES.has(data.fuente_direccion ?? "")) {
    volver(key, "Esa sucursal viene de una fuente y no se borra desde acá.", true);
  }
  const { error } = await db.from("sucursal").delete().eq("id", id);
  if (error) volver(key, `No se pudo borrar: ${error.message}`, true);
  volver(key, "Sucursal borrada.");
}
