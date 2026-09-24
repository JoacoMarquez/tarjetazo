import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "tarjetas";
const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Baja la foto de una sugerencia y la deja en Storage, en `_sugeridas/`. Se
 * hace acá y no al aceptar porque BBVA no le responde a Vercel pero sí a
 * GitHub Actions. El nombre es el hash del contenido: la misma foto (los packs
 * de Santander comparten una) se guarda una sola vez.
 *
 * Headers de navegador: BBVA da 403 a cualquier otro cliente. Sin `image/avif`
 * en el Accept: BBVA la sirve en AVIF si se lo ofrecen y el bucket no lo acepta.
 */
export async function guardarFotoSugerida(db: SupabaseClient, url: string, pagina?: string): Promise<string> {
  // Como la pide un navegador al mostrar la página: desde GitHub Actions, BBVA
  // da 403 a la foto si falta el referer o los sec-fetch.
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5",
      "accept-language": "es-UY,es;q=0.9",
      "sec-fetch-dest": "image",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-origin",
      ...(pagina ? { referer: pagina } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tipo = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const ext = EXTENSION[tipo];
  if (!ext) throw new Error(`formato no soportado (${tipo || "sin tipo"})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("pesa más de 4 MB");

  const buf = await crypto.subtle.digest("SHA-256", bytes);
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
  const ruta = `_sugeridas/${h}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(ruta, bytes, { contentType: tipo, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Storage: ${error.message}`);
  return ruta;
}

/**
 * Las fotos pendientes que todavía no están en Storage: las de antes de este
 * cambio, o las que fallaron en una corrida anterior. Corre al principio de
 * cada revisión, aunque ninguna página haya cambiado.
 */
export async function completarFotosPendientes(db: SupabaseClient): Promise<{ ok: number; fallidas: number }> {
  const { data, error } = await db
    .from("producto_ficha_sugerencia")
    .select("id, valor, url")
    .eq("estado", "pendiente")
    .eq("campo", "imagen")
    .is("archivo", null);
  if (error) throw new Error(`leyendo fotos pendientes: ${error.message}`);
  let ok = 0;
  let fallidas = 0;
  for (const s of data ?? []) {
    try {
      const archivo = await guardarFotoSugerida(db, String(s.valor), s.url as string);
      const { error: e } = await db.from("producto_ficha_sugerencia").update({ archivo }).eq("id", s.id);
      if (e) throw new Error(e.message);
      ok++;
    } catch (e) {
      fallidas++;
      console.error(`  foto ${String(s.valor).slice(0, 100)}: ${String(e).slice(0, 120)}`);
    }
  }
  return { ok, fallidas };
}

