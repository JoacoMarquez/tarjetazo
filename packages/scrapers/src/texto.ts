/**
 * Convierte el HTML de una página en el texto que ve un lector, que es lo que
 * le pasamos a Claude. Sacamos scripts, estilos y la navegación repetida: no
 * aportan y encarecen cada llamada.
 */
/**
 * Los sitios de los bancos vienen con entidades HTML sin decodificar
 * ("Solicit&aacute; tu Tarjeta"). Estas son las que aparecen en castellano.
 */
const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", copy: "©", reg: "®",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", uuml: "ü", ntilde: "ñ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Uuml: "Ü", Ntilde: "Ñ",
  iquest: "¿", iexcl: "¡", laquo: "«", raquo: "»", deg: "°", ordm: "º", ordf: "ª",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  euro: "€", pound: "£", yen: "¥", cent: "¢", middot: "·", bull: "•", times: "×",
};

export function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (entero, nombre: string) => ENTIDADES[nombre] ?? entero)
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Casi todo el HTML de un banco es navegación: el menú de Santander y el de
 * Scotiabank ocupan más que el beneficio. Nos quedamos con el contenido
 * principal, que estos sitios marcan con <main> o <article>, y descartamos los
 * bloques que se repiten en todas las páginas.
 */
export function contenidoPrincipal(html: string): string {
  const sinCoro = html.replace(
    /<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  for (const etiqueta of ["main", "article"]) {
    const re = new RegExp(`<${etiqueta}\\b[^>]*>([\\s\\S]*?)<\\/${etiqueta}>`, "i");
    const m = sinCoro.match(re);
    // Un <main> muy corto suele ser un contenedor vacío que llena el JS.
    if (m?.[1] && m[1].length > 500) return m[1];
  }
  return sinCoro;
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
