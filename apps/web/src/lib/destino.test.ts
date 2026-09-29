import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinoSeguro } from "./destino.ts";

describe("destino después del login", () => {
  it("deja pasar las rutas del sitio", () => {
    assert.equal(destinoSeguro("/app"), "/app");
    assert.equal(destinoSeguro("/app/mis-tarjetas?a=1#b"), "/app/mis-tarjetas?a=1#b");
    assert.equal(destinoSeguro("/auth/nueva-contrasena?next=%2Fadmin"), "/auth/nueva-contrasena?next=%2Fadmin");
  });

  it("todo lo que apunte afuera vuelve al default", () => {
    for (const malo of ["//evil.example", "https://evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example",
      "/\\/evil.example/x", "/.//evil.example", "/%2e//evil.example", "/x/..//evil.example", "evil.example", "", null, undefined]) {
      assert.equal(destinoSeguro(malo), "/app", String(malo));
    }
  });

  it("lo que devuelve resuelve al mismo origen", () => {
    for (const v of ["/app", "/a/../b", "/./c", "/%5Cx"]) {
      assert.equal(new URL(destinoSeguro(v), "https://tarjetazo.uy").origin, "https://tarjetazo.uy", v);
    }
  });
});
