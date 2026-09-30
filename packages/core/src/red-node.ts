/**
 * La parte de `red.ts` que necesita Node. `revisarDestino` resuelve el nombre
 * para chequearlo, pero `fetch` lo vuelve a resolver al conectar: un DNS que
 * contesta una IP pública y después una interna pasaría el chequeo. Acá la
 * conexión usa un `lookup` que chequea la misma IP a la que se conecta.
 * Solo para código de servidor (scraper y backoffice).
 */
import { lookup as dnsLookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { DestinoNoPermitido, esIpPrivada, fetchPublico, revisarDestino, type Resolver } from "./red";

type LookupBase = (
  host: string,
  opciones: LookupAllOptions,
  cb: (err: NodeJS.ErrnoException | null, direcciones: LookupAddress[]) => void,
) => void;

/** `lookup` para `net.connect`: falla si alguna IP del nombre no es pública. */
export function crearLookupPublico(base: LookupBase = dnsLookup): LookupFunction {
  return (host, opciones, cb) => {
    base(host, { ...opciones, all: true }, (err, direcciones) => {
      if (err) return cb(err, "", 0);
      if (direcciones.length === 0 || direcciones.some((d) => esIpPrivada(d.address))) {
        return cb(new DestinoNoPermitido(`${host} no es una dirección pública`), "", 0);
      }
      if (opciones.all) return (cb as unknown as (e: null, d: LookupAddress[]) => void)(null, direcciones);
      cb(null, direcciones[0]!.address, direcciones[0]!.family);
    });
  };
}

export const resolverDns: Resolver = (host) =>
  new Promise((ok, mal) =>
    dnsLookup(host, { all: true }, (err, direcciones) => (err ? mal(err) : ok(direcciones.map((d) => d.address)))),
  );

function cuerpoDe(body: RequestInit["body"]): { datos?: string | Uint8Array; tipo?: string } {
  if (body == null) return {};
  if (typeof body === "string") return { datos: body, tipo: "text/plain;charset=UTF-8" };
  if (body instanceof URLSearchParams) return { datos: body.toString(), tipo: "application/x-www-form-urlencoded;charset=UTF-8" };
  if (body instanceof Uint8Array) return { datos: body };
  throw new Error("cuerpo no soportado");
}

function cabeceras(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => (out[k] = v));
  return out;
}

/**
 * Un pedido HTTP sin seguir redirecciones (de eso se encarga `fetchPublico`),
 * conectando solo a IPs públicas. Devuelve un `Response` como `fetch`.
 */
export function crearTransportePublico(lookup: LookupFunction = crearLookupPublico()) {
  return (url: URL, init: RequestInit = {}): Promise<Response> =>
    new Promise((ok, mal) => {
      const headers = new Headers(init.headers);
      const { datos, tipo } = cuerpoDe(init.body);
      if (tipo && !headers.has("content-type")) headers.set("content-type", tipo);
      if (!headers.has("accept-encoding")) headers.set("accept-encoding", "gzip, deflate, br");
      const cliente = url.protocol === "https:" ? https : http;
      const req = cliente.request(url, {
        method: init.method ?? "GET",
        headers: cabeceras(headers),
        lookup,
        signal: init.signal ?? undefined,
        agent: false,
      });
      req.on("error", mal);
      req.on("response", (res) => {
        const salida = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) salida.append(k, x);
        }
        const status = res.statusCode ?? 502;
        if (init.method === "HEAD" || status === 204 || status === 304 || (status >= 300 && status < 400)) {
          res.resume();
          return ok(new Response(null, { status, headers: salida }));
        }
        const codificacion = (res.headers["content-encoding"] ?? "").toLowerCase();
        const flujo =
          codificacion === "gzip" ? res.pipe(zlib.createGunzip())
          : codificacion === "br" ? res.pipe(zlib.createBrotliDecompress())
          : codificacion === "deflate" ? res.pipe(zlib.createInflate())
          : res;
        if (flujo !== res) res.on("error", (e) => flujo.destroy(e));
        ok(new Response(Readable.toWeb(flujo) as ReadableStream<Uint8Array>, { status, headers: salida }));
      });
      req.end(datos);
    });
}

const transporte = crearTransportePublico();

/** `fetchPublico` con DNS de Node y la conexión atada a la IP chequeada. */
export function fetchPublicoNode(url: string | URL, init: RequestInit = {}, maxSaltos?: number): Promise<Response> {
  return fetchPublico(url, init, { resolver: resolverDns, transporte, maxSaltos });
}

/** Un solo pedido, sin seguir redirecciones (para leer un `Location`). */
export async function pedirPublico(url: URL, init: RequestInit = {}): Promise<Response> {
  // Con una IP literal no hay lookup: el chequeo de la URL cubre ese caso.
  await revisarDestino(url, resolverDns);
  return transporte(url, init);
}
