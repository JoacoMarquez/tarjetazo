/**
 * Convierte el HTML de una página en el texto que ve un lector, que es lo que
 * le pasamos a Claude. Sacamos scripts, estilos y la navegación repetida: no
 * aportan y encarecen cada llamada.
 */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * BROU repite el header, el footer y un bloque "También te puede interesar" en
 * todas las páginas. Nos quedamos con el medio.
 */
export function recortarBrou(texto: string): string {
  const inicio = texto.indexOf("Inicio\n");
  const desde = inicio >= 0 ? inicio + "Inicio\n".length : 0;
  const corte = texto.indexOf("También te puede interesar", desde);
  const hasta = corte >= 0 ? corte : texto.indexOf("Contactanos", desde);
  return texto.slice(desde, hasta > desde ? hasta : undefined).trim();
}
