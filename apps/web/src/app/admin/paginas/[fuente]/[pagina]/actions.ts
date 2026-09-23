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
