/**
 * Descargas de URLs que vienen de afuera (links de sitemaps, fotos y logos de
 * las páginas de los bancos). Solo del lado del servidor: el scraper corre con
 * los secretos del job y el backoffice en Vercel. Nada de ir a la red interna,
 * al loopback ni a la metadata de la nube, tampoco después de una redirección.
 * No importa nada de Node (core también va al navegador): el DNS lo resuelve
 * quien llama, con `node:dns`.
 */

const esIpv4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
const esIpv6 = (s: string) => s.includes(":") && /^[0-9a-f:.]+$/i.test(s);

export class DestinoNoPermitido extends Error {}

function ipv4Privada(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Loopback, privada, link-local, CGNAT, multicast o sin especificar. */
export function esIpPrivada(ip: string): boolean {
  if (esIpv4(ip)) return ipv4Privada(ip);
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::" || v6 === "::1") return true;
  // IPv4 embebida (::ffff:10.0.0.1, 64:ff9b::a9fe:a9fe…): se juzga la v4.
  const v4 = v6.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (v4) return ipv4Privada(v4);
  if (/^::ffff:|^64:ff9b:/.test(v6)) return true;
  return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

/** De nombre a IPs (en Node: `(await lookup(host, { all: true })).map((r) => r.address)`). */
export type Resolver = (host: string) => Promise<string[]>;

/** Tira DestinoNoPermitido si la URL no es http(s) o resuelve a una IP no pública. */
export async function revisarDestino(url: URL, resolver: Resolver): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new DestinoNoPermitido(`esquema ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal)$/.test(host)) throw new DestinoNoPermitido(`host ${host}`);
  const ips = esIpv4(host) || esIpv6(host) ? [host] : await resolver(host);
  if (ips.length === 0 || ips.some(esIpPrivada)) throw new DestinoNoPermitido(`${host} no es una dirección pública`);
}

/**
 * fetch que revisa el destino antes de cada salto: las redirecciones se siguen
 * a mano (hasta 5) y cada una vuelve a pasar por `revisarDestino`.
 */
export async function fetchPublico(
  url: string | URL,
  init: RequestInit = {},
  opciones: { resolver: Resolver; maxSaltos?: number },
): Promise<Response> {
  let actual = new URL(url);
  let pedido: RequestInit = { ...init, redirect: "manual" };
  for (let salto = 0; ; salto++) {
    await revisarDestino(actual, opciones.resolver);
    const res = await fetch(actual, pedido);
    const destino = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!destino) return res;
    if (salto >= (opciones.maxSaltos ?? 5)) throw new Error(`demasiadas redirecciones desde ${url}`);
    await res.body?.cancel();
    actual = new URL(destino, actual);
    // 301/302/303 pasan a GET sin cuerpo, como hace el navegador.
    if (res.status !== 307 && res.status !== 308) pedido = { ...pedido, method: "GET", body: undefined };
  }
}

/** Lee el cuerpo cortando apenas pasa `maxBytes`, sin cargar el resto en memoria. */
export async function leerConTope(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declarado = Number(res.headers.get("content-length") ?? "");
  if (declarado > maxBytes) {
    await res.body?.cancel();
    throw new Error(`pesa más de ${Math.round(maxBytes / 1024)} KB`);
  }
  if (!res.body) return new Uint8Array();
  const partes: Uint8Array[] = [];
  let total = 0;
  const lector = res.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel();
      throw new Error(`pesa más de ${Math.round(maxBytes / 1024)} KB`);
    }
    partes.push(value);
  }
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.byteLength;
  }
  return out;
}
