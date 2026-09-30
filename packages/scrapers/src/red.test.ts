// Descargas de URLs de terceros: nada de ir a la red interna, tampoco
// siguiendo una redirección, y el tamaño se corta mientras se lee.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import http from "node:http";
import type { LookupFunction } from "node:net";
import { afterEach, describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { DestinoNoPermitido, esIpPrivada, fetchPublico, leerConTope, revisarDestino } from "@tarjetazo/core/red";
import { crearLookupPublico, crearTransportePublico } from "@tarjetazo/core/red-node";

const publico = async () => ["203.0.113.10"];
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("destinos de descargas", () => {
  it("reconoce IPs no públicas", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "::7f00:1", "168.63.129.16"]) {
      assert.equal(esIpPrivada(ip), true, ip);
    }
    for (const ip of ["200.40.1.1", "8.8.8.8", "2800:a4:1::1"]) assert.equal(esIpPrivada(ip), false, ip);
  });

  it("rechaza esquemas, hosts e IPs internas", async () => {
    for (const u of ["file:///etc/passwd", "data:text/plain,hola", "http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data/", "http://algo.internal/"]) {
      await assert.rejects(revisarDestino(new URL(u), publico), DestinoNoPermitido, u);
    }
    await assert.rejects(revisarDestino(new URL("https://banco.com.uy/"), async () => ["10.0.0.5"]), DestinoNoPermitido);
    await revisarDestino(new URL("https://banco.com.uy/"), publico);
  });

  it("una redirección hacia la red interna se corta antes de pedirla", async () => {
    const pedidas: string[] = [];
    globalThis.fetch = (async (u: URL) => {
      pedidas.push(String(u));
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
    }) as typeof fetch;
    await assert.rejects(fetchPublico("https://banco.com.uy/foto.png", {}, { resolver: publico }), DestinoNoPermitido);
    assert.deepEqual(pedidas, ["https://banco.com.uy/foto.png"]);
  });

  it("sigue redirecciones públicas", async () => {
    globalThis.fetch = (async (u: URL) =>
      String(u).endsWith("/vieja")
        ? new Response(null, { status: 301, headers: { location: "/nueva" } })
        : new Response("ok", { status: 200 })) as typeof fetch;
    const res = await fetchPublico("https://banco.com.uy/vieja", {}, { resolver: publico });
    assert.equal(await res.text(), "ok");
  });

  it("corta el cuerpo apenas pasa el tope", async () => {
    let enviados = 0;
    const cuerpo = new ReadableStream<Uint8Array>({
      pull(c) {
        enviados++;
        c.enqueue(new Uint8Array(1024 * 1024));
        if (enviados > 50) c.close();
      },
    });
    await assert.rejects(leerConTope(new Response(cuerpo), 4 * 1024 * 1024), /pesa más/);
    assert.ok(enviados < 10, `leyó ${enviados} MB`);
    await assert.rejects(leerConTope(new Response("x", { headers: { "content-length": "9999999" } }), 1024), /pesa más/);
    assert.equal((await leerConTope(new Response("hola"), 1024)).byteLength, 4);
  });
});

/** Servidor en loopback que anota cada pedido. */
async function servidor(manejar: http.RequestListener) {
  const pedidos: string[] = [];
  const srv = http.createServer((req, res) => {
    pedidos.push(`${req.method} ${req.url}`);
    manejar(req, res);
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const puerto = (srv.address() as { port: number }).port;
  return { pedidos, puerto, cerrar: () => new Promise((ok) => srv.close(ok)) };
}

/** Un `lookup` de prueba que contesta siempre la misma IP. */
const siempre = (ip: string): Parameters<typeof crearLookupPublico>[0] => (_h, _o, cb) =>
  cb(null, [{ address: ip, family: 4 }]);

describe("conexión atada a la IP chequeada", () => {
  it("el lookup de la conexión rechaza IPs internas", async () => {
    const lookup = crearLookupPublico(siempre("127.0.0.1"));
    const err = await new Promise((ok) => lookup("banco.com.uy", {}, (e) => ok(e)));
    assert.ok(err instanceof DestinoNoPermitido);
    const bien = await new Promise((ok) => crearLookupPublico(siempre("203.0.113.10"))("banco.com.uy", {}, (e, ip) => ok(e ?? ip)));
    assert.equal(bien, "203.0.113.10");
  });

  it("un DNS que cambia después del chequeo no llega a la red interna", async () => {
    const srv = await servidor((_q, r) => r.end("interno"));
    try {
      // El chequeo ve una IP pública; al conectar, el DNS contesta loopback.
      const transporte = crearTransportePublico(crearLookupPublico(siempre("127.0.0.1")));
      await assert.rejects(
        fetchPublico(`http://banco.test:${srv.puerto}/foto.png`, {}, { resolver: publico, transporte }),
        DestinoNoPermitido,
      );
      assert.deepEqual(srv.pedidos, []);
    } finally {
      await srv.cerrar();
    }
  });

  it("el transporte devuelve el cuerpo, descomprime y manda formularios", async () => {
    const srv = await servidor((req, res) => {
      let cuerpo = "";
      req.on("data", (c) => (cuerpo += c));
      req.on("end", () => {
        if (req.url === "/gz") {
          res.writeHead(200, { "content-encoding": "gzip", "content-type": "text/plain" });
          return res.end(gzipSync("comprimido"));
        }
        if (req.url === "/vieja") {
          res.writeHead(301, { location: "/gz" });
          return res.end();
        }
        res.end(`${req.headers["content-type"]}|${cuerpo}`);
      });
    });
    try {
      // En la prueba se permite loopback: lo que se prueba es el transporte.
      const loopback = ((_h, o, cb) =>
        o.all ? (cb as unknown as (e: null, d: object[]) => void)(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4)) as LookupFunction;
      const transporte = crearTransportePublico(loopback);
      const url = (p: string) => new URL(`http://banco.test:${srv.puerto}${p}`);
      assert.equal(await (await transporte(url("/gz"))).text(), "comprimido");
      const form = await transporte(url("/f"), { method: "POST", body: new URLSearchParams({ a: "1" }) });
      assert.equal(await form.text(), "application/x-www-form-urlencoded;charset=UTF-8|a=1");
      const redir = await transporte(url("/vieja"));
      assert.equal(redir.status, 301);
      assert.equal(redir.headers.get("location"), "/gz");
      const seguida = await fetchPublico(url("/vieja"), {}, { resolver: publico, transporte });
      assert.equal(await seguida.text(), "comprimido");
    } finally {
      await srv.cerrar();
    }
  });
});
