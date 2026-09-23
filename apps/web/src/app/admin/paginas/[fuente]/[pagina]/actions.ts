"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { urlInspector } from "@/lib/admin/paginas";

/**
 * Marca la página para que la próxima corrida la vuelva a normalizar, aunque
 * el banco no la haya cambiado. Es lo mismo que hace "Asignar tarjeta" en la
 * cola: sin hash guardado ni `normalizada_en`, el runner la procesa.
 */
export async function reNormalizar(form: FormData) {
  await exigirAdmin();
  const fuenteId = String(form.get("fuente_id") ?? "");
  const externalId = String(form.get("external_id") ?? "");
  const destino = urlInspector(fuenteId, externalId);
  if (!fuenteId || !externalId) redirect(destino);

  const { error } = await createSupabaseAdmin()
    .from("pagina_cruda")
    .update({ hash: "", normalizada_en: null })
    .eq("fuente_id", fuenteId)
    .eq("external_id", externalId);

  revalidatePath(destino);
  redirect(
    `${destino}?${error ? "error" : "ok"}=${encodeURIComponent(
      error
        ? `No se pudo marcar: ${error.message}`
        : "Marcada: la próxima corrida de la fuente la vuelve a normalizar.",
    )}`,
  );
}

/**
 * La página no describe un beneficio (institucional, sorteo, listado): sale de
 * "Páginas sin beneficios". Vale hasta que la página cambie y se vuelva a
 * normalizar, que es cuando hay que volver a mirarla.
 */
export async function marcarNoBeneficio(form: FormData) {
  await exigirAdmin();
  const fuenteId = String(form.get("fuente_id") ?? "");
  const externalId = String(form.get("external_id") ?? "");
  const destino = urlInspector(fuenteId, externalId);
  if (!fuenteId || !externalId) redirect(destino);

  const { error } = await createSupabaseAdmin()
    .from("pagina_cruda")
    .update({ resultado: "no_es_beneficio", tramos: 0 })
    .eq("fuente_id", fuenteId)
    .eq("external_id", externalId);

  revalidatePath(destino);
  revalidatePath("/admin/salud");
  redirect(
    `${destino}?${error ? "error" : "ok"}=${encodeURIComponent(
      error ? `No se pudo marcar: ${error.message}` : "Marcada como «no es un beneficio».",
    )}`,
  );
}

const DIAS_VERIFICADO = 90;

async function cambiarBeneficio(form: FormData, cambios: Record<string, unknown>, mensaje: string) {
  await exigirAdmin();
  const fuenteId = String(form.get("fuente_id") ?? "");
  const externalId = String(form.get("external_id") ?? "");
  const id = String(form.get("beneficio_id") ?? "");
  const destino = urlInspector(fuenteId, externalId);
  // El id tiene que ser de esta página: no se aceptan ids sueltos del formulario.
  if (!id.startsWith(`${fuenteId}:${externalId}:`)) redirect(destino);
  const { error } = await createSupabaseAdmin()
    .from("beneficio")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(destino);
  revalidatePath("/admin/salud");
  redirect(`${destino}?${error ? "error" : "ok"}=${encodeURIComponent(error ? `No se pudo: ${error.message}` : mensaje)}`);
}

/**
 * El banco lo sigue publicando pero está muerto: sale de la web. Se levanta
 * solo cuando la página cambia (el runner re-normaliza y lo deja en `ok`).
 */
export async function ocultarBeneficio(form: FormData) {
  await cambiarBeneficio(form, { estado_revision: "oculto", cambio: "oculto" }, "Oculto: ya no se ve en la web.");
}

export async function mostrarBeneficio(form: FormData) {
  await cambiarBeneficio(form, { estado_revision: "ok" }, "Vuelve a verse en la web.");
}

/** "Lo miré y sigue vigente": sale de los sospechosos de viejos por 90 días. */
export async function verificarBeneficio(form: FormData) {
  const hasta = new Date(Date.now() - 3 * 3600e3 + DIAS_VERIFICADO * 86400e3).toISOString().slice(0, 10);
  await cambiarBeneficio(form, { verificado_hasta: hasta }, `Verificado hasta el ${hasta.split("-").reverse().join("/")}.`);
}
