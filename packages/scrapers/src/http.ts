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

export async function bajarTexto(url: string, intentos = 3): Promise<string> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    await esperarTurno();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
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

/** Hash estable del contenido, para saltear páginas que no cambiaron. */
export async function hash(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
