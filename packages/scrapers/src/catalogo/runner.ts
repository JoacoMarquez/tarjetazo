import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hash } from "../http.js";
import { extraerTarjetas, type TarjetaVista } from "./extraer.js";
import { bajarPagina, descubrirPaginas } from "./bajar.js";
import { FUENTES_CATALOGO, NO_CONSUMO } from "./fuentes.js";
import { completarFotosPendientes, guardarFotoSugerida } from "./imagen.js";
import { bajasDeFuente, clave, familiaPara, juntar, sugerenciasDeFamilia, type Ficha, type Sugerencia } from "./sugerencias.js";

export interface ReporteCatalogo {
  paginas: number;
  extraidas: number;
  tarjetas: number;
  sugerencias: number;
  fallidas: number;
}

/**
 * Revisión del catálogo de tarjetas (#27). Baja las páginas oficiales, extrae
 * las tarjetas con el modelo solo si la página cambió, y deja sugerencias para
 * la bandeja (#26): campos, altas y bajas (una familia que el banco dejó de
 * publicar). Nunca escribe en `producto_ficha`.
 */
export async function correrCatalogo(
  db: SupabaseClient,
  opciones: { fuentes?: string[]; limite?: number } = {},
): Promise<ReporteCatalogo> {
  const claude = new Anthropic();
  const r: ReporteCatalogo = { paginas: 0, extraidas: 0, tarjetas: 0, sugerencias: 0, fallidas: 0 };
  const tokens = { entrada: 0, salida: 0 };
  const { data: rev, error: eRev } = await db.from("catalogo_revision").insert({}).select("id").single();
  if (eRev) throw new Error(`abriendo revisión: ${eRev.message}`);

  try {
    const [fichas, previas, paginas] = await Promise.all([
      db.from("producto_ficha").select("*"),
      db.from("producto_ficha_sugerencia").select("id, fuente_id, familia_id, tipo, campo, valor, nombre_visto, estado").neq("estado", "aceptada"),
      db.from("catalogo_pagina").select("fuente_id, url, hash, extraido_en, familias"),
    ]);
    const fallo = fichas.error ?? previas.error ?? paginas.error;
    if (fallo) throw new Error(fallo.message);
    const fichaDe = new Map((fichas.data ?? []).map((f) => [f.familia_id as string, f as Ficha]));
    const cache = new Map((paginas.data ?? []).map((p) => [p.url as string, p]));
    const existentes = new Map<string, { id: string; valor: unknown; estado: string }[]>();
    for (const s of previas.data ?? []) {
      const k = clave(s as Parameters<typeof clave>[0]);
      existentes.set(k, [...(existentes.get(k) ?? []), s as { id: string; valor: unknown; estado: string }]);
    }

    for (const f of FUENTES_CATALOGO.filter((x) => !opciones.fuentes || opciones.fuentes.includes(x.fuente_id))) {
      const { urls: todas, imagenesIndice } = await descubrirPaginas(f);
      const urls = todas.slice(0, opciones.limite ?? Infinity);
      console.error(`${f.fuente_id}: ${urls.length} páginas`);
      // Qué familias dio cada página, antes y en esta revisión: para las bajas.
      const antes = new Map(
        [...cache.values()].filter((p) => p.fuente_id === f.fuente_id).map((p) => [p.url as string, p.familias as string[] | null]),
      );
      const ahora = new Map<string, string[] | null>();
      let fallidasFuente = 0;
      for (const url of urls) {
        r.paginas++;
        try {
          const p = await bajarPagina(url, f.comoNavegador);
          // La foto suele estar en el índice y no en la ficha: van las dos.
          p.imagenes = [...new Set([...p.imagenes, ...imagenesIndice])].slice(0, 40);
          const h = await hash(p.texto + "\n" + p.imagenes.join("\n"));
          const previa = cache.get(url);
          // Sin `familias` (extraída antes de las bajas) se vuelve a extraer una vez.
          if (previa && previa.hash === h && previa.extraido_en && previa.familias) {
            await db.from("catalogo_pagina").update({ visto_en: new Date().toISOString() }).eq("url", url);
            ahora.set(url, previa.familias as string[]);
            continue;
          }
          const { tarjetas, uso } = await extraerTarjetas({ url, texto: p.texto, imagenes: p.imagenes }, claude);
          tokens.entrada += uso.entrada + uso.cache_escritura + uso.cache_lectura;
          tokens.salida += uso.salida;
          r.extraidas++;

          // Una familia puede aparecer varias veces (los plásticos de un pack).
          const porFamilia = new Map<string, TarjetaVista[]>();
          const nuevas: Sugerencia[] = [];
          for (const t of tarjetas) {
            if (NO_CONSUMO.test(t.nombre)) continue;
            r.tarjetas++;
            const fam = familiaPara(f.fuente_id, t);
            if (fam) porFamilia.set(fam, [...(porFamilia.get(fam) ?? []), t]);
            else nuevas.push({ fuente_id: f.fuente_id, familia_id: null, tipo: "alta", campo: null, valor: t, valor_actual: null, nombre_visto: t.nombre, url });
          }
          for (const [fam, ts] of porFamilia) {
            nuevas.push(...sugerenciasDeFamilia(f.fuente_id, fam, juntar(ts), fichaDe.get(fam) ?? null, url));
          }
          r.sugerencias += await guardarSugerencias(db, nuevas, existentes);

          const familias = [...porFamilia.keys()].sort();
          const { error } = await db.from("catalogo_pagina").upsert({
            fuente_id: f.fuente_id, url, hash: h, contenido: p.texto, visto_en: new Date().toISOString(), extraido_en: new Date().toISOString(), familias,
          });
          if (error) throw new Error(error.message);
          ahora.set(url, familias);
          // Una página que tenía tarjetas y ahora el modelo no le saca ninguna
          // es más probable un mal extraído que un banco sin tarjetas: esta
          // revisión no alcanza para proponer bajas de la fuente.
          if (familias.length === 0 && (antes.get(url)?.length ?? 0) > 0) {
            fallidasFuente++;
            console.error(`  ${url}: antes tenía tarjetas y ahora ninguna; no se proponen bajas de ${f.fuente_id}`);
          }
        } catch (e) {
          r.fallidas++;
          fallidasFuente++;
          console.error(`  falló ${url}: ${String(e).slice(0, 160)}`);
        }
      }
      // Con una revisión incompleta, lo que falta es lo que no se leyó.
      if (opciones.limite === undefined && fallidasFuente === 0 && urls.length > 0) {
        r.sugerencias += await guardarSugerencias(db, bajasDeFuente(f.fuente_id, antes, ahora), existentes);
        await descartarBajasQueVolvieron(db, ahora, existentes);
      }
    }
    if (r.paginas > 0 && r.fallidas === r.paginas) throw new Error("fallaron todas las páginas");
    // También las de páginas que no cambiaron: una foto que falló la semana
    // pasada, o las de antes de que el scraper las bajara.
    const fotos = await completarFotosPendientes(db);
    if (fotos.ok + fotos.fallidas > 0) console.error(`fotos pendientes: ${fotos.ok} guardadas, ${fotos.fallidas} fallaron`);
    await db.from("catalogo_revision").update({
      termino_en: new Date().toISOString(), paginas: r.paginas, extraidas: r.extraidas, tarjetas: r.tarjetas,
      sugerencias: r.sugerencias, tokens_entrada: tokens.entrada, tokens_salida: tokens.salida,
    }).eq("id", rev.id);
    return r;
  } catch (e) {
    await db.from("catalogo_revision").update({ termino_en: new Date().toISOString(), error: String(e), tokens_entrada: tokens.entrada, tokens_salida: tokens.salida }).eq("id", rev.id);
    throw e;
  }
}

/**
 * Una baja pendiente de una familia que el banco volvió a publicar ya no
 * aplica: se borra (no se ignora, así puede volver a proponerse).
 */
async function descartarBajasQueVolvieron(
  db: SupabaseClient,
  ahora: ReadonlyMap<string, readonly string[] | null>,
  existentes: Map<string, { id: string; valor: unknown; estado: string }[]>,
): Promise<void> {
  const vistas = new Set([...ahora.values()].flatMap((f) => f ?? []));
  const ids: string[] = [];
  for (const fam of vistas) {
    const k = `baja|${fam}`;
    const previas = existentes.get(k) ?? [];
    ids.push(...previas.filter((p) => p.estado === "pendiente").map((p) => p.id));
    existentes.set(k, previas.filter((p) => p.estado !== "pendiente"));
  }
  if (ids.length === 0) return;
  const { error } = await db.from("producto_ficha_sugerencia").delete().in("id", ids);
  if (error) throw new Error(`borrando bajas que volvieron: ${error.message}`);
}

/**
 * Inserta lo nuevo sin repetir: una ignorada con el mismo valor no vuelve; una
 * pendiente del mismo campo se actualiza si el banco cambió el valor.
 */
async function guardarSugerencias(
  db: SupabaseClient,
  nuevas: Sugerencia[],
  existentes: Map<string, { id: string; valor: unknown; estado: string }[]>,
): Promise<number> {
  let n = 0;
  const mismo = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const s of nuevas) {
    const k = clave(s);
    const previas = existentes.get(k) ?? [];
    if (previas.some((p) => mismo(p.valor, s.valor))) continue;
    if (s.campo === "imagen") {
      try {
        s.archivo = await guardarFotoSugerida(db, String(s.valor), s.url);
      } catch (e) {
        // Queda sin archivo: la reintenta `completarFotosPendientes`, y si no, el backoffice al aceptar.
        console.error(`  foto ${String(s.valor).slice(0, 100)}: ${String(e).slice(0, 120)}`);
      }
    }
    const pendiente = previas.find((p) => p.estado === "pendiente");
    if (pendiente) {
      const { error } = await db
        .from("producto_ficha_sugerencia")
        .update({ valor: s.valor, valor_actual: s.valor_actual, url: s.url, archivo: s.archivo ?? null, creada_en: new Date().toISOString() })
        .eq("id", pendiente.id);
      if (error) throw new Error(`guardando sugerencia: ${error.message}`);
      pendiente.valor = s.valor;
    } else {
      // Con su id real: la misma tarjeta puede volver a aparecer en otra página
      // de la misma corrida y hay que poder actualizarla.
      const { data, error } = await db.from("producto_ficha_sugerencia").insert(s).select("id").single();
      if (error) throw new Error(`guardando sugerencia: ${error.message}`);
      existentes.set(k, [...previas, { id: data.id as string, valor: s.valor, estado: "pendiente" }]);
    }
    n++;
  }
  return n;
}
