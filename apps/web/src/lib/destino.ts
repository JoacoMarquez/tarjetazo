/**
 * Solo se acepta un `next` relativo al sitio: cualquier cosa que apunte afuera
 * se descarta para no habilitar un redirect abierto. No alcanza con mirar que
 * empiece con `/`: el navegador y Next leen `/\host`, `/<tab>/host` y
 * `/.//host` como `//host`. Se resuelve como URL contra un origen fijo, se
 * exige ese mismo origen y se vuelve a revisar el resultado ya normalizado.
 */
export function destinoSeguro(next: string | null | undefined, porDefecto = "/app") {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return porDefecto;
  const base = "https://destino.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return porDefecto;
  }
  if (url.origin !== base) return porDefecto;
  const destino = `${url.pathname}${url.search}${url.hash}`;
  return destino.startsWith("/") && !destino.startsWith("//") ? destino : porDefecto;
}
