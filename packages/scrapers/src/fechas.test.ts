// Fechas comodín: Scotiabank publica "Vigencia: 2022-01-01 a 3022-06-20" en las
// promos sin fin. Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sinFechaComodin } from "./normalizador.js";

const hoy = new Date("2026-09-27T12:00:00Z");

describe("sinFechaComodin", () => {
  it("un año lejano es sin fecha de fin", () => {
    for (const f of ["3022-06-20", "3200-10-12", "4022-06-20", "2060-03-30", "2036-07-31", "2030-12-23"]) {
      assert.equal(sinFechaComodin(f, hoy), null, f);
    }
  });

  it("una fecha real (hasta 3 años) se conserva", () => {
    for (const f of ["2026-12-31", "2027-12-31", "2029-07-26", "2023-07-31"]) {
      assert.equal(sinFechaComodin(f, hoy), f, f);
    }
  });

  it("null sigue null", () => {
    assert.equal(sinFechaComodin(null, hoy), null);
  });
});
