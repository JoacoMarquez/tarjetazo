/**
 * Migración única de #72: deja las fotos de frente que ya están en Storage
 * como las guarda ahora Tarjetazo (horizontales, recortadas, 1012×638).
 *
 *   tsx scripts/normalizar-fotos.mts --salida <dir>   # seco: escribe las fotos en <dir>, no toca nada
 *   tsx scripts/normalizar-fotos.mts --aplicar        # sube y actualiza las fichas
 *
 * Las fotos viejas quedan en el bucket: las páginas públicas están cacheadas
 * una hora (revalidate 3600) con las rutas viejas, y borrarlas las rompe.
 *
 * Pide SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL).
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ALTO, ANCHO, type Recorte, normalizarFoto } from "../src/lib/normalizar-foto";

const BUCKET = "tarjetas";

/**
 * Escenas de las que se saca una tarjeta derecha, y fotos donde la detección
 * automática no alcanza. Coordenadas en píxeles de la foto que hay hoy: si la
 * foto cambia, el recorte deja de valer (se chequea la ruta).
 */
const RECORTES: Record<string, { foto: string; recorte: Recorte }> = {
  // Dorada sobre fondo dorado: la misma caja que las otras de BBVA.
  "bbva-oro": { foto: "bbva-oro/frente-d1f48a08c6fc.webp", recorte: { left: 39, top: 30, width: 242, height: 153 } },
  // Una sombra opaca abajo.
  "itau-debito-junior": { foto: "itau-debito-junior/frente-125818589acb.webp", recorte: { left: 0, top: 0, width: 340, height: 214 } },
  // La de adelante de dos.
  "bbva-debito": { foto: "bbva-debito/frente-50e9034c7daf.webp", recorte: { left: 148, top: 180, width: 632, height: 398 } },
  // La azul de dos, lado a lado.
  "brou-recompensa": { foto: "brou-recompensa/frente-c8d7349ce2a8.png", recorte: { left: 0, top: 0, width: 172, height: 109 } },
  // La de adelante de la pila.
  "santander-select": { foto: "santander-select/frente-a41d05862d11.webp", recorte: { left: 176, top: 181, width: 293, height: 185 } },
};

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : undefined;
if (!aplicar && !salida) throw new Error("falta --salida <dir> o --aplicar");

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: fichas, error } = await db
  .from("producto_ficha")
  .select("familia_id, imagen_frente")
  .not("imagen_frente", "is", null)
  .order("familia_id");
if (error) throw new Error(error.message);
if (salida) mkdirSync(salida, { recursive: true });

const resumen = { normalizadas: 0, genericas: 0, sinCambios: 0 };
for (const { familia_id: familia, imagen_frente: ruta } of fichas as { familia_id: string; imagen_frente: string }[]) {
  const { data: blob, error: e } = await db.storage.from(BUCKET).download(ruta);
  if (e || !blob) throw new Error(`${familia}: no se pudo bajar ${ruta}: ${e?.message}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Ya normalizada: una corrida anterior, o un recorte del admin.
  const { width, height } = await sharp(bytes).metadata();
  if (width === ANCHO && height === ALTO) {
    resumen.sinCambios++;
    continue;
  }
  const manual = RECORTES[familia];
  if (manual && manual.foto !== ruta) throw new Error(`${familia}: la foto cambió (${ruta}), revisar el recorte`);
  const r = await normalizarFoto(bytes, manual?.recorte);

  if (!r.ok) {
    // Una escena sin tarjeta derecha: cara genérica. `imagen_origen` queda, así el scraper no la re-sugiere.
    console.log(`${familia.padEnd(32)} → genérica (${r.motivo})`);
    resumen.genericas++;
    if (aplicar) {
      const { error: u } = await db.from("producto_ficha").update({ imagen_frente: null }).eq("familia_id", familia);
      if (u) throw new Error(`${familia}: ${u.message}`);
    }
    continue;
  }

  const hash = createHash("sha256").update(r.bytes).digest("hex").slice(0, 12);
  const nueva = `${familia}/frente-${hash}.webp`;
  console.log(`${familia.padEnd(32)} → ${nueva}${manual ? " (recorte a mano)" : ""}`);
  resumen.normalizadas++;
  if (salida) writeFileSync(`${salida}/${familia}.webp`, r.bytes);
  if (aplicar) {
    const { error: s } = await db.storage
      .from(BUCKET)
      .upload(nueva, r.bytes, { contentType: r.tipo, upsert: true, cacheControl: "31536000" });
    if (s) throw new Error(`${familia}: ${s.message}`);
    const { error: u } = await db.from("producto_ficha").update({ imagen_frente: nueva }).eq("familia_id", familia);
    if (u) throw new Error(`${familia}: ${u.message}`);
  }
}
console.log(resumen);
