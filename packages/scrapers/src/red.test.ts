// Descargas de URLs de terceros: nada de ir a la red interna, tampoco
// siguiendo una redirección, y el tamaño se corta mientras se lee.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DestinoNoPermitido, esIpPrivada, fetchPublico, leerConTope, revisarDestino } from "@tarjetazo/core/red";

const publico = async () => ["203.0.113.10"];
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("destinos de descargas", () => {
  it("reconoce IPs no públicas", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe"]) {
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
