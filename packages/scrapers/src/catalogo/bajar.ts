import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import type { FuenteCatalogo } from "./fuentes.js";

/** Páginas del catálogo de una fuente: las fijas más las que el índice linkea. */
export async function descubrirPaginas(f: FuenteCatalogo): Promise<{ urls: string[]; imagenesIndice: string[] }> {
  const html = await bajarTexto(`${f.base}${f.indice}`, 3, { comoNavegador: f.comoNavegador });
  const host = new URL(f.base).host.replace(/^www\./, "");
  const paths = new Set<string>(f.fijas);
  for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
    let path = m[1]!.trim();
    try {
      const u = new URL(path, f.base);
      if (u.host.replace(/^www\./, "") !== host) continue;
      path = decodeURI(u.pathname).replace(/\/$/, "");
    } catch {
      continue;
    }
    if (f.patron.test(path) && !f.excluir.test(path)) paths.add(path);
  }
  return {
    urls: [...paths].sort().map((p) => `${f.base}${p}`),
    imagenesIndice: imagenesDe(html, `${f.base}${f.indice}`),
  };
}

/** Una imagen del contenido, no un ícono ni un logo ni un fondo. */
const PARECE_TARJETA = /tarjet|card|trilogy|pack|vertical|visa|master|black|platinum|oro|gold|infinite|signature|debito|credito|aadvantage|farmacard|hiperm/i;
const NO_ES = /icon|logo|sprite|bg-|banner|slider|avatar|flecha|arrow|\.svg/i;

/**
 * Imágenes de tarjetas de un HTML, con su texto alternativo. Muchos bancos
 * muestran la foto de la tarjeta en el índice y no en la ficha, así que el
 * runner le pasa al modelo las de las dos páginas.
 */
export function imagenesDe(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = tag.match(/(?:data-src|src)="([^"]+)"/)?.[1];
    if (!src) continue;
    const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? "";
    try {
      const abs = new URL(src.replace(/&amp;/g, "&"), base).toString();
      if ((PARECE_TARJETA.test(abs) || PARECE_TARJETA.test(alt)) && !NO_ES.test(abs)) out.add(abs);
    } catch {
      // URL rota: se ignora.
    }
  }
  return [...out];
}

export async function bajarPagina(
  url: string,
  comoNavegador = false,
): Promise<{ url: string; html: string; texto: string; imagenes: string[] }> {
  const html = await bajarTexto(url, 3, { comoNavegador });
  const imagenes = new Set(imagenesDe(html, url));
  // Tope de texto: las páginas de tarjetas son cortas; más que esto es menú.
  return { url, html, texto: htmlATexto(html).slice(0, 20_000), imagenes: [...imagenes].slice(0, 30) };
}
