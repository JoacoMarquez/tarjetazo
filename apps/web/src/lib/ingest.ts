/**
 * Proxy propio de PostHog (#114): los bloqueadores cortan sus dominios. Antes
 * era un rewrite de Next, que reenvía el pedido entero, cookies incluidas: la
 * sesión de Supabase (access y refresh token, también la de un admin) viajaba
 * a PostHog en cada evento. Acá se arma el pedido de cero con lo mínimo.
 */

const API = "https://eu.i.posthog.com";
const ASSETS = "https://eu-assets.i.posthog.com";

/**
 * Las rutas que usa posthog-js (eventos, flags, grabaciones, logs y los
 * scripts que carga). El resto de PostHog no se sirve desde nuestro dominio.
 */
const RUTAS_API = new Set(["e", "i", "s", "flags", "decide"]);
const RUTAS_API_EXTRA = new Set(["surveys", "early_access_features", "web_experiments", "product_tours"]);

function rutaDePostHog(ruta: string[], clave: string | undefined): boolean {
  const [primero, segundo] = ruta;
  if (primero === "static") return ruta.length >= 2 && ruta.at(-1)!.endsWith(".js");
  // La configuración que sirve `array/` es por proyecto: solo la nuestra.
  if (primero === "array") return !!clave && segundo === clave && ruta.length === 3;
  if (primero === "api") return ruta.length === 2 && RUTAS_API_EXTRA.has(segundo!);
  return RUTAS_API.has(primero!);
}

/** Adónde va `/ingest/<ruta>`, o null si la ruta no es de PostHog. */
export function destinoIngest(ruta: string[], search: string, clave: string | undefined, barraFinal = false): URL | null {
  if (ruta.length === 0 || ruta.some((p) => p === "" || p === "." || p === "..")) return null;
  if (!rutaDePostHog(ruta, clave)) return null;
  const [primero] = ruta;
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

/** Los tipos que devuelve PostHog por estas rutas; cualquier otro sale como texto. */
const TIPOS = new Set(["application/json", "application/javascript", "text/javascript", "text/plain"]);

export const cabecerasHaciaPostHog = (h: Headers) => copiarCabeceras(h, HACIA_POSTHOG);

/**
 * Lo que vuelve se sirve desde nuestro dominio: nunca como página (HTML, SVG)
 * que corra con nuestro origen, y sin que el navegador adivine el tipo.
 */
export function cabecerasDeVuelta(h: Headers): Headers {
  const out = copiarCabeceras(h, DE_VUELTA);
  const tipo = (out.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (out.has("content-type") && !TIPOS.has(tipo)) out.set("content-type", "text/plain; charset=utf-8");
  out.set("x-content-type-options", "nosniff");
  out.set("content-security-policy", "sandbox");
  return out;
}
