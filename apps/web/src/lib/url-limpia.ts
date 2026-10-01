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

/** Aplica `urlSinTokens` a todas las propiedades de texto de un evento. */
export function propiedadesSinTokens<T extends Record<string, unknown>>(props: T): T {
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string" && /^https?:\/\//.test(v)) (props as Record<string, unknown>)[k] = urlSinTokens(v);
  }
  return props;
}
