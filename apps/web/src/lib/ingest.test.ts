import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cabecerasDeVuelta, cabecerasHaciaPostHog, destinoIngest } from "./ingest.ts";

describe("proxy de PostHog", () => {
  it("manda los eventos a la API y los scripts a assets", () => {
    assert.equal(destinoIngest(["e"], "?ip=0&ver=1", "phc_x", true)?.href, "https://eu.i.posthog.com/e/?ip=0&ver=1");
    assert.equal(destinoIngest(["static", "array.js"], "", "phc_x")?.href, "https://eu-assets.i.posthog.com/static/array.js");
    assert.equal(destinoIngest(["array", "phc_x", "config.js"], "", "phc_x")?.href, "https://eu-assets.i.posthog.com/array/phc_x/config.js");
  });

  it("no sirve la configuración de otro proyecto ni rutas raras", () => {
    assert.equal(destinoIngest(["array", "phc_otro", "config.js"], "", "phc_x"), null);
    assert.equal(destinoIngest(["array", "phc_x", "config.js"], "", undefined), null);
    assert.equal(destinoIngest(["..", "x"], "", "phc_x"), null);
    assert.equal(destinoIngest([], "", "phc_x"), null);
    assert.equal(destinoIngest(["a%2F..%2F..%2Fx"], "", "phc_x"), null);
  });

  it("solo las rutas que usa posthog-js", () => {
    for (const r of [["e"], ["i", "v0", "e"], ["i", "v1", "logs"], ["s"], ["flags"], ["api", "surveys"], ["static", "recorder.js"], ["static", "1.425.0", "surveys.js"], ["array", "phc_x", "config"]]) {
      assert.notEqual(destinoIngest(r, "", "phc_x"), null, r.join("/"));
    }
    for (const r of [["login"], ["api", "projects"], ["api", "surveys", "x"], ["static", "x.html"], ["static"], ["array", "phc_x", "config.js", "x"], ["admin"]]) {
      assert.equal(destinoIngest(r, "", "phc_x"), null, r.join("/"));
    }
  });

  it("lo que vuelve no se interpreta como página", () => {
    const html = cabecerasDeVuelta(new Headers({ "content-type": "text/html; charset=utf-8", "set-cookie": "a=1" }));
    assert.equal(html.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(html.get("x-content-type-options"), "nosniff");
    assert.equal(html.get("content-security-policy"), "sandbox");
    assert.equal(html.get("set-cookie"), null);
    assert.equal(cabecerasDeVuelta(new Headers({ "content-type": "application/javascript" })).get("content-type"), "application/javascript");
  });

  it("no pasa cookies ni autorización", () => {
    const h = new Headers({
      cookie: "sb-ref-auth-token.0=base64-xxx; sb-ref-auth-token.1=yyy",
      authorization: "Bearer x",
      "content-type": "text/plain",
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": "203.0.113.7",
    });
    const out = cabecerasHaciaPostHog(h);
    assert.equal(out.get("cookie"), null);
    assert.equal(out.get("authorization"), null);
    assert.equal(out.get("content-type"), "text/plain");
    assert.equal(out.get("x-forwarded-for"), "203.0.113.7");
  });
});
