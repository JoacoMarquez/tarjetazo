/**
 * El dashboard de Supabase muestra varias URLs y es fácil copiar la que no es
 * (la del navegador, o la de la API REST con su path). El cliente quiere el
 * origen pelado, así que lo normalizamos y avisamos claro cuando la URL no es
 * la del proyecto.
 */
export function origenSupabase(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`La URL de Supabase no es válida: ${url}`);
  }
  if (!parsed.hostname.endsWith(".supabase.co") && parsed.hostname !== "localhost") {
    throw new Error(
      `La URL de Supabase apunta a ${parsed.hostname}; se espera https://<ref>.supabase.co ` +
        "(Project Settings → Data API → Project URL), no la URL del dashboard",
    );
  }
  return parsed.origin;
}
