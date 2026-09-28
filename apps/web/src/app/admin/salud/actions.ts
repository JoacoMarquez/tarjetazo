"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";

/**
 * "No son el mismo comercio": el par deja de aparecer en «Nombres parecidos».
 * Es una regla en base, como un alias: la próxima corrida no la pisa.
 */
export async function marcarDistintos(form: FormData) {
  await exigirAdmin();
  const [key_a, key_b] = [String(form.get("a") ?? ""), String(form.get("b") ?? "")].sort();
  if (!key_a || !key_b || key_a === key_b) return;
  const { error } = await createSupabaseAdmin()
    .from("comercio_par_distinto")
    .upsert({ key_a, key_b }, { onConflict: "key_a,key_b", ignoreDuplicates: true });
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  revalidatePath("/admin/salud");
  revalidatePath("/admin");
}
