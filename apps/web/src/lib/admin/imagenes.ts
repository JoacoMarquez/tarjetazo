import "server-only";

import { createHash } from "node:crypto";
import type { createSupabaseAdmin } from "@/lib/admin";

type Db = ReturnType<typeof createSupabaseAdmin>;

export const BUCKET = "tarjetas";
/** Igual que el `file_size_limit` del bucket. */
export const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * El tipo real de una imagen por sus primeros bytes. Itaú sirve las fotos de
 * sus tarjetas como `binary/octet-stream`: el header no alcanza.
 */
function tipoPorContenido(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  return null;
}

/**
 * Baja la foto del banco. Con headers de navegador: BBVA responde 403 a
 * cualquier otro cliente. Sin `image/avif` en el Accept: BBVA la sirve en AVIF
 * si se lo ofrecen, y el bucket no lo acepta.
 */
export async function bajarImagen(url: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5",
      "accept-language": "es-UY,es;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`el banco respondió HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("la imagen pesa más de 4 MB");
  const header = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const tipo = EXTENSION[header] ? header : (tipoPorContenido(bytes) ?? header);
  if (!EXTENSION[tipo]) throw new Error(`formato no soportado (${tipo || "sin tipo"})`);
  return { bytes, tipo };
}

/** Lee una foto que ya está en el bucket (la que dejó el scraper en `_sugeridas/`). */
export async function leerImagen(db: Db, ruta: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const { data, error } = await db.storage.from(BUCKET).download(ruta);
  if (error || !data) throw new Error(`no se pudo leer ${ruta} de Storage: ${error?.message ?? "vacío"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const header = data.type.split(";")[0]!.trim().toLowerCase();
  const tipo = EXTENSION[header] ? header : (tipoPorContenido(bytes) ?? header);
  if (!EXTENSION[tipo]) throw new Error(`formato no soportado (${tipo || "sin tipo"})`);
  return { bytes, tipo };
}

/**
 * Sube una foto al bucket y devuelve la ruta. El nombre lleva el hash del
 * contenido: una foto nueva es otra URL y no queda una vieja en el caché del
 * CDN. La anterior se borra para no juntar huérfanas.
 */
export async function subirImagen(
  db: Db,
  familiaId: string,
  lado: "frente" | "dorso",
  imagen: { bytes: Uint8Array; tipo: string },
  anterior: string | null,
): Promise<string> {
  const ext = EXTENSION[imagen.tipo];
  if (!ext) throw new Error(`formato no soportado (${imagen.tipo})`);
  const hash = createHash("sha256").update(imagen.bytes).digest("hex").slice(0, 12);
  const ruta = `${familiaId}/${lado}-${hash}.${ext}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(ruta, imagen.bytes, { contentType: imagen.tipo, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`no se pudo guardar en Storage: ${error.message}`);
  if (anterior && anterior !== ruta) await borrarImagen(db, anterior);
  return ruta;
}

/** Best effort: una huérfana en el bucket no rompe nada. */
export async function borrarImagen(db: Db, ruta: string): Promise<void> {
  await db.storage.from(BUCKET).remove([ruta]);
}
