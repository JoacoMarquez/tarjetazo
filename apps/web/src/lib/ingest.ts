/**
 * Proxy propio de PostHog (#114): los bloqueadores cortan sus dominios. Antes
 * era un rewrite de Next, que reenvía el pedido entero, cookies incluidas: la
 * sesión de Supabase (access y refresh token, también la de un admin) viajaba
 * a PostHog en cada evento. Acá se arma el pedido de cero con lo mínimo.
 */

const API = "https://eu.i.posthog.com";
const ASSETS = "https://eu-assets.i.posthog.com";

/** Adónde va `/ingest/<ruta>`, o null si la ruta no es de PostHog. */
export function destinoIngest(ruta: string[], search: string, clave: string | undefined, barraFinal = false): URL | null {
  if (ruta.length === 0 || ruta.some((p) => p === "" || p === "." || p === "..")) return null;
  const [primero] = ruta;
  // La configuración que sirve `array/` es por proyecto: solo la nuestra.
  if (primero === "array" && (!clave || ruta[1] !== clave)) return null;
  const host = primero === "static" || primero === "array" ? ASSETS : API;
  // Los endpoints de PostHog llevan barra final (`/e/`): sin ella redirigen.
  const url = new URL(`${host}/${ruta.map(encodeURIComponent).join("/")}${barraFinal ? "/" : ""}`);
  url.search = search;
  return url;
}

/** Lo que se le pasa a PostHog del pedido del navegador: sin cookies ni auth. */
const HACIA_POSTHOG = ["content-type", "content-encoding", "user-agent", "accept", "accept-language", "x-forwarded-for"];
/** Lo que se devuelve. Sin content-encoding: fetch ya descomprimió el cuerpo. */
const DE_VUELTA = ["content-type", "cache-control", "etag", "last-modified"];

export function copiarCabeceras(origen: Headers, permitidas: string[]): Headers {
  const out = new Headers();
  for (const nombre of permitidas) {
    const v = origen.get(nombre);
    if (v !== null) out.set(nombre, v);
  }
  return out;
}

export const cabecerasHaciaPostHog = (h: Headers) => copiarCabeceras(h, HACIA_POSTHOG);
export const cabecerasDeVuelta = (h: Headers) => copiarCabeceras(h, DE_VUELTA);
