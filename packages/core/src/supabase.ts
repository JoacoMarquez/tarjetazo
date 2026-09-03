/**
 * El dashboard de Supabase muestra varias URLs y es fácil copiar la que no es
 * (la del navegador, o la de la API REST con su path) o pegarla sin el
 * esquema. El cliente quiere el origen pelado, así que normalizamos lo que se
 * pueda y avisamos claro cuando no es la URL del proyecto.
 */
export function origenSupabase(url: string): string {
  const limpia = url.trim().replace(/^["']|["']$/g, "");
  if (limpia === "") {
    throw new Error("La URL de Supabase está vacía");
  }

  // Pegar "abcdef.supabase.co" sin https:// es el error más común.
  const conEsquema = /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;

  let parsed: URL;
  try {
    parsed = new URL(conEsquema);
  } catch {
    throw new Error(
      `La URL de Supabase no es válida: ${limpia}. Se espera https://<ref>.supabase.co ` +
        "(Project Settings → Data API → Project URL)",
    );
  }

  if (!parsed.hostname.endsWith(".supabase.co") && parsed.hostname !== "localhost") {
    throw new Error(
      `La URL de Supabase apunta a ${parsed.hostname}; se espera https://<ref>.supabase.co ` +
        "(Project Settings → Data API → Project URL), no la URL del dashboard",
    );
  }
  return parsed.origin;
}
