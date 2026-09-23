"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";

/** Fusiona `origen` en `destino`: mueve todo, borra el origen y deja el alias. */
export async function fusionar(form: FormData) {
  await exigirAdmin();
  const destino = String(form.get("destino") ?? "");
  const a = String(form.get("a") ?? "");
  const b = String(form.get("b") ?? "");
  const origen = destino === a ? b : destino === b ? a : "";
  if (!origen) redirect("/admin/salud#nombres_parecidos");

  const { data, error } = await createSupabaseAdmin().rpc("fusionar_comercios", {
    p_origen: origen,
    p_destino: destino,
  });
  if (error) {
    redirect(`/admin/comercios/fusionar?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&error=${encodeURIComponent(error.message)}`);
  }
  const r = (data as { beneficios: number; sucursales: number }[] | null)?.[0];
  revalidatePath("/admin/salud");
  revalidatePath(`/comercio/${destino}`);
  revalidatePath(`/comercio/${origen}`);
  redirect(
    `/admin/salud?ok=${encodeURIComponent(
      `Fusionado en ${destino}: ${r?.beneficios ?? 0} beneficios y ${r?.sucursales ?? 0} sucursales movidos. La URL vieja redirige.`,
    )}#nombres_parecidos`,
  );
}
