/**
 * Parámetros de Auth que no deben salir del navegador en la analítica: el código
 * PKCE de un link de login o recuperación, tokens de sesión y los textos de
 * error que arma Supabase.
 */
const SENSIBLES = new Set([
  "code", "access_token", "refresh_token", "provider_token", "provider_refresh_token",
  "token", "token_hash", "error", "error_code", "error_description",
]);

/** La URL sin esos parámetros, ni en la query ni en el fragmento. Si no es una URL, igual. */
export function urlSinTokens(valor: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return valor;
  }
  let cambio = false;
  for (const k of [...url.searchParams.keys()]) {
    if (SENSIBLES.has(k.toLowerCase())) {
      url.searchParams.delete(k);
      cambio = true;
    }
  }
  // El flujo implícito deja los tokens en el fragmento (#access_token=…).
  const hash = url.hash.slice(1);
  if (hash.includes("=")) {
    const p = new URLSearchParams(hash);
    for (const k of [...p.keys()]) {
      if (SENSIBLES.has(k.toLowerCase())) {
        p.delete(k);
        cambio = true;
      }
    }
    url.hash = p.toString();
  }
  return cambio ? url.toString() : valor;
}

/** Las rutas internas no deben salir en las métricas del sitio público. */
export function esRutaAdmin(valor: string): boolean {
  try {
    const pathname = new URL(valor, "https://tarjetazo.uy").pathname;
    return pathname === "/admin" || pathname.startsWith("/admin/");
  } catch {
    return false;
  }
}

/**
 * Deja un evento listo para la analítica: `urlSinTokens` en todas las
 * propiedades de texto y nada de /admin en las que arrastran la página
 * anterior. Los mapas de calor se juntan en el navegador y salen con el
 * próximo evento, con las URLs como claves: un rato en /admin y la vuelta a una
 * página pública alcanzan para que viajen.
 */
export function propiedadesSinTokens<T extends Record<string, unknown>>(props: T): T {
  const p = props as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && /^https?:\/\//.test(v)) p[k] = urlSinTokens(v);
  }
  const anterior = p.$prev_pageview_pathname;
  if (typeof anterior === "string" && esRutaAdmin(anterior)) {
    for (const k of Object.keys(p)) if (k.startsWith("$prev_pageview_")) delete p[k];
  }
  const calor = p.$heatmap_data;
  if (calor && typeof calor === "object" && !Array.isArray(calor)) {
    const limpio: Record<string, unknown> = {};
    for (const [url, datos] of Object.entries(calor)) if (!esRutaAdmin(url)) limpio[urlSinTokens(url)] = datos;
    if (Object.keys(limpio).length > 0) p.$heatmap_data = limpio;
    else delete p.$heatmap_data;
  }
  return props;
}
