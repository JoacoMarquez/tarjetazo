"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { leerFormulario, slugManual, validar, type EstadoFormulario } from "@/lib/admin/manual";

/** Crea o edita un beneficio manual. Solo toca filas con `origen = 'manual'`. */
export async function guardarManual(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  await exigirAdmin();
  const db = createSupabaseAdmin();
  const v = leerFormulario(form);

  // El comercio: el existente con ese nombre, o uno nuevo con el rubro elegido.
  const { data: existente } = await db
    .from("comercio")
    .select("key")
    .ilike("nombre", v.comercio.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle<{ key: string }>();
  const comercioKey = existente?.key ?? slugManual(v.comercio);
  if (!existente && !v.categoria) {
    return { errores: { categoria: "Es un comercio nuevo: elegí el rubro." } };
  }

  const id =
    v.id ?? `${v.fuente_id}:manual-${comercioKey}-${Date.now().toString(36)}:0`;
  if (v.id) {
    const { data: previo } = await db.from("beneficio").select("origen").eq("id", v.id).maybeSingle<{ origen: string }>();
    if (previo?.origen !== "manual") return { error: "Solo se pueden editar beneficios cargados a mano." };
  }

  const { fila, errores } = validar(v, id, comercioKey);
  if (!fila) return { errores };

  if (!existente) {
    const { error } = await db
      .from("comercio")
      .upsert({ key: comercioKey, nombre: v.comercio, categoria: v.categoria }, { onConflict: "key", ignoreDuplicates: true });
    if (error) return { error: `No se pudo crear el comercio: ${error.message}` };
  }

  const { error } = await db.from("beneficio").upsert({
    ...fila,
    origen: "manual",
    nota_manual: v.nota_manual || null,
    cambio: v.id ? "actualizado" : "nuevo",
    corrida_id: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/admin/beneficios");
  revalidatePath(`/comercio/${comercioKey}`);
  redirect(`/admin/beneficios?ok=${encodeURIComponent(v.id ? "Beneficio actualizado." : "Beneficio cargado: ya se ve en la web.")}`);
}

/** Da de baja un manual (queda descartado, no se borra). */
export async function bajaManual(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const { error } = await createSupabaseAdmin()
    .from("beneficio")
    .update({ estado_revision: "descartado", cambio: "baja", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("origen", "manual");
  revalidatePath("/admin/beneficios");
  redirect(`/admin/beneficios?${error ? "error" : "ok"}=${encodeURIComponent(error ? error.message : "Beneficio dado de baja.")}`);
}
