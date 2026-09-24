"use server";

import { FAMILIA_POR_ID } from "@tarjetazo/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import {
  COLUMNAS_FICHA,
  COLUMNAS_SUGERENCIA,
  leerFormularioFicha,
  valorDeSugerencia,
  type EstadoFicha,
  type Ficha,
  type Sugerencia,
} from "@/lib/admin/fichas";
import { MAX_BYTES, bajarImagen, borrarImagen, leerImagen, subirImagen } from "@/lib/admin/imagenes";

type Db = ReturnType<typeof createSupabaseAdmin>;

/** A dónde vuelve cada acción: la bandeja o la ficha desde la que se aceptó. */
function destino(form: FormData): string {
  const v = String(form.get("volver_a") ?? "");
  return v.startsWith("/admin/tarjetas") ? v : "/admin/tarjetas";
}

function volver(form: FormData, mensaje: string, error = false): never {
  revalidatePath("/admin/tarjetas", "layout");
  const url = destino(form);
  redirect(`${url}${url.includes("?") ? "&" : "?"}${error ? "error" : "ok"}=${encodeURIComponent(mensaje)}` as never);
}

async function pendientes(db: Db, ids: string[]): Promise<Sugerencia[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("producto_ficha_sugerencia")
    .select(COLUMNAS_SUGERENCIA)
    .in("id", ids)
    .eq("estado", "pendiente");
  if (error) throw new Error(`leyendo sugerencias: ${error.message}`);
  return (data ?? []) as Sugerencia[];
}

async function resolver(db: Db, ids: string[], estado: "aceptada" | "ignorada") {
  if (ids.length === 0) return;
  const { error } = await db
    .from("producto_ficha_sugerencia")
    .update({ estado, resuelta_en: new Date().toISOString() })
    .in("id", ids)
    .eq("estado", "pendiente");
  if (error) throw new Error(`marcando sugerencias: ${error.message}`);
}

/**
 * Acepta sugerencias de campo: una, las de una familia o todas (la carga
 * inicial). Cada familia es un upsert parcial de su ficha; la foto se copia a
 * la ficha desde la que dejó el scraper en Storage (o se baja del banco si no
 * hay). Lo que falla (foto que no baja, valor que no encaja) queda
 * pendiente y se informa.
 */
export async function aceptarSugerencias(form: FormData) {
  await exigirAdmin();
  const db = createSupabaseAdmin();
  const ids = form.getAll("id").map(String);
  const sugerencias = (await pendientes(db, ids)).filter((s) => s.tipo === "campo" && s.familia_id && s.campo);
  if (sugerencias.length === 0) volver(form, "No había nada pendiente para aceptar.", true);

  const porFamilia = new Map<string, Sugerencia[]>();
  for (const s of sugerencias) porFamilia.set(s.familia_id!, [...(porFamilia.get(s.familia_id!) ?? []), s]);

  const { data: fichas, error } = await db
    .from("producto_ficha")
    .select(COLUMNAS_FICHA)
    .in("familia_id", [...porFamilia.keys()]);
  if (error) volver(form, `No se pudieron leer las fichas: ${error.message}`, true);
  const fichaDe = new Map(((fichas ?? []) as Ficha[]).map((f) => [f.familia_id, f]));

  const aceptadas: string[] = [];
  const fallos: string[] = [];
  for (const [familiaId, suyas] of porFamilia) {
    const ficha = fichaDe.get(familiaId);
    const patch: Record<string, unknown> = {};
    const ok: string[] = [];
    // En orden de llegada: si quedaron dos del mismo campo, gana la última vista.
    suyas.sort((a, b) => a.creada_en.localeCompare(b.creada_en));
    for (const s of suyas) {
      if (s.campo === "imagen") {
        try {
          const origen = String(s.valor);
          // La copia del scraper si la hay: BBVA no le responde a Vercel.
          const imagen = s.archivo ? await leerImagen(db, s.archivo) : await bajarImagen(origen);
          const ruta = await subirImagen(db, familiaId, "frente", imagen, ficha?.imagen_frente ?? null);
          patch.imagen_frente = ruta;
          patch.imagen_origen = origen;
          ok.push(s.id);
        } catch (e) {
          fallos.push(`${s.nombre_visto}, foto: ${(e as Error).message}`);
        }
        continue;
      }
      const v = valorDeSugerencia(s.campo!, s.valor);
      if (!v.ok) {
        fallos.push(`${s.nombre_visto}, ${s.campo}: ${v.error}`);
        continue;
      }
      patch[s.campo!] = v.valor;
      ok.push(s.id);
    }
    if (ok.length === 0) continue;
    patch.url_oficial = suyas.at(-1)!.url;
    const { error: e } = await db.from("producto_ficha").upsert(
      { familia_id: familiaId, fuente_id: suyas[0]!.fuente_id, ...patch, actualizado_en: new Date().toISOString() },
      { onConflict: "familia_id" },
    );
    if (e) {
      fallos.push(`${FAMILIA_POR_ID[familiaId]?.nombre ?? familiaId}: ${e.message}`);
      continue;
    }
    aceptadas.push(...ok);
  }

  await resolver(db, aceptadas, "aceptada");
  const n = aceptadas.length;
  const texto = `${n} ${n === 1 ? "sugerencia aceptada" : "sugerencias aceptadas"}.`;
  if (fallos.length > 0) volver(form, `${texto} Quedaron pendientes: ${fallos.join("; ")}.`, n === 0);
  volver(form, texto);
}

export async function ignorarSugerencias(form: FormData) {
  await exigirAdmin();
  const db = createSupabaseAdmin();
  const ids = (await pendientes(db, form.getAll("id").map(String))).map((s) => s.id);
  await resolver(db, ids, "ignorada");
  volver(form, `${ids.length} ${ids.length === 1 ? "sugerencia ignorada" : "sugerencias ignoradas"}.`);
}

/** Una tarjeta nueva no se "acepta" en la base: se agrega en código con un PR. */
export async function marcarAltaAgregada(form: FormData) {
  await exigirAdmin();
  const db = createSupabaseAdmin();
  const altas = (await pendientes(db, form.getAll("id").map(String))).filter((s) => s.tipo === "alta");
  await resolver(db, altas.map((s) => s.id), "aceptada");
  volver(form, "Marcada como agregada. Cuando el PR llegue a producción, la próxima revisión del catálogo ya la reconoce.");
}

function archivo(form: FormData, nombre: string): File | null {
  const f = form.get(nombre);
  return f instanceof File && f.size > 0 ? f : null;
}

/** Guarda la ficha editada a mano, con las fotos recortadas en el navegador. */
export async function guardarFicha(_: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  await exigirAdmin();
  const familiaId = String(form.get("familia_id") ?? "");
  const familia = FAMILIA_POR_ID[familiaId];
  if (!familia) return { error: "Esa tarjeta no está en el catálogo." };

  const { fila, errores } = leerFormularioFicha(form);
  const frente = archivo(form, "frente");
  const dorso = archivo(form, "dorso");
  for (const [nombre, f] of [["frente", frente], ["dorso", dorso]] as const) {
    if (!f) continue;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) errores[nombre] = "Tiene que ser PNG, JPG o WebP.";
    else if (f.size > MAX_BYTES) errores[nombre] = "Pesa más de 4 MB.";
  }
  const urlOficial = String(form.get("url_oficial") ?? "").trim() || null;
  if (urlOficial && !/^https?:\/\//i.test(urlOficial)) errores.url_oficial = "Tiene que empezar con https://";
  if (!fila || Object.keys(errores).length > 0) return { errores };

  const db = createSupabaseAdmin();
  const { data: previa, error: e1 } = await db
    .from("producto_ficha")
    .select(COLUMNAS_FICHA)
    .eq("familia_id", familiaId)
    .maybeSingle<Ficha>();
  if (e1) return { error: `No se pudo leer la ficha: ${e1.message}` };

  const imagenes: Partial<Ficha> = {};
  try {
    if (frente) {
      imagenes.imagen_frente = await subirImagen(
        db, familiaId, "frente",
        { bytes: new Uint8Array(await frente.arrayBuffer()), tipo: frente.type },
        previa?.imagen_frente ?? null,
      );
      // `imagen_origen` queda como estaba: la foto del banco solo se vuelve a
      // sugerir si el banco la cambia, no cada lunes.
    }
    if (dorso) {
      imagenes.imagen_dorso = await subirImagen(
        db, familiaId, "dorso",
        { bytes: new Uint8Array(await dorso.arrayBuffer()), tipo: dorso.type },
        previa?.imagen_dorso ?? null,
      );
    } else if (form.get("quitar_dorso") === "1" && previa?.imagen_dorso) {
      await borrarImagen(db, previa.imagen_dorso);
      imagenes.imagen_dorso = null;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await db.from("producto_ficha").upsert(
    {
      familia_id: familiaId,
      fuente_id: familia.fuente_id,
      ...fila,
      ...imagenes,
      url_oficial: urlOficial,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "familia_id" },
  );
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Redirect y no `{ ok }`: la ficha remonta el formulario cuando cambia, y
  // el mensaje se perdería con el estado.
  revalidatePath("/admin/tarjetas", "layout");
  redirect(`/admin/tarjetas/${familiaId}?ok=${encodeURIComponent("Ficha guardada.")}` as never);
}
