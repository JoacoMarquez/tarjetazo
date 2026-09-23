"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";

const MUESTRA = 10;

function volver(mensaje: string, error = false): never {
  revalidatePath("/admin/auditoria");
  revalidatePath("/admin");
  redirect(`/admin/auditoria?${error ? "error" : "ok"}=${encodeURIComponent(mensaje)}`);
}

/** Completa la muestra de esta semana hasta 10 (no repite ni pisa lo respondido). */
export async function armarMuestra() {
  await exigirAdmin();
  const { data, error } = await createSupabaseAdmin().rpc("auditoria_armar", { p_n: MUESTRA });
  if (error) volver(`No se pudo armar la muestra: ${error.message}`, true);
  volver(Number(data) > 0 ? `Muestra lista: ${data} beneficios.` : "La muestra de esta semana ya está completa.");
}

/** Un ✗ no edita el beneficio: queda anotado y se corrige desde el inspector o el scraper. */
export async function responder(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const resultado = String(form.get("resultado") ?? "");
  const nota = String(form.get("nota") ?? "").trim().slice(0, 500) || null;
  if (!id || !["bien", "mal"].includes(resultado)) volver("Falta la respuesta.", true);
  const { error } = await createSupabaseAdmin()
    .from("auditoria")
    .update({ resultado, nota, respondido_en: new Date().toISOString() })
    .eq("id", id);
  if (error) volver(`No se pudo guardar: ${error.message}`, true);
  revalidatePath("/admin/auditoria");
  redirect(`/admin/auditoria#${id}`);
}
