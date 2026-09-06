const UA =
  "Tarjetazo/0.1 (+https://tarjetazo.uy; agregador de beneficios; contacto@tarjetazo.uy)";

/** BROU no pide rate limit en robots.txt; 1 req/s es cortesía nuestra. */
const DELAY_MS = 1000;

let ultimaPeticion = 0;

async function esperarTurno() {
  const falta = DELAY_MS - (Date.now() - ultimaPeticion);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultimaPeticion = Date.now();
}

/**
 * Algunos sitios (BBVA) devuelven 403 a cualquier User-Agent que no sea de un
 * navegador, aunque robots.txt no prohíba nada. Para esos se pasa `comoNavegador`.
 */
const UA_NAVEGADOR =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function bajarTexto(
  url: string,
  intentos = 3,
  opciones: { comoNavegador?: boolean } = {},
): Promise<string> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    await esperarTurno();
    try {
      const res = await fetch(url, {
        headers: opciones.comoNavegador
          ? {
              "user-agent": UA_NAVEGADOR,
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "es-UY,es;q=0.9,en;q=0.8",
              "sec-fetch-dest": "document",
              "sec-fetch-mode": "navigate",
              "sec-fetch-site": "none",
              "upgrade-insecure-requests": "1",
            }
          : { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return await res.text();
    } catch (e) {
      ultimoError = e;
      // Backoff exponencial: 1s, 2s, 4s.
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw new Error(`No se pudo bajar ${url}: ${String(ultimoError)}`);
}

/**
 * Adónde apunta un acortador (goo.gl/maps), sin bajar el destino: la URL
 * larga de Google Maps trae las coordenadas del lugar.
 */
export async function resolverRedireccion(url: string): Promise<string | null> {
  await esperarTurno();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "user-agent": UA_NAVEGADOR },
      signal: AbortSignal.timeout(15_000),
    });
    return res.headers.get("location");
  } catch {
    return null;
  }
}

/** Hash estable del contenido, para saltear páginas que no cambiaron. */
export async function hash(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
