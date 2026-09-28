// Fechas comodín: Scotiabank publica "Vigencia: 2022-01-01 a 3022-06-20" en las
// promos sin fin. Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fechaFinDeTexto } from "./fechas.js";
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

describe("fechaFinDeTexto", () => {
  it("frases de fin reales", () => {
    assert.equal(fechaFinDeTexto("tarjeta del 21 al 25 de setiembre de 2026 inclusive."), "2026-09-25");
    assert.equal(fechaFinDeTexto("Vigencia 01/12/2022 al 30/11/2023 clinicaleblanc"), "2023-11-30");
    assert.equal(fechaFinDeTexto("Vigencia: 01/09/22 al 31/08/23 duam.com.uy"), "2023-08-31");
    assert.equal(fechaFinDeTexto("La vigencia es del 18/9/23 hasta el 30/06/26 inclusive."), "2026-06-30");
    assert.equal(fechaFinDeTexto("Vigencia todos los días hasta el 1 de agosto de 2026."), "2026-08-01");
    assert.equal(fechaFinDeTexto("Promoción válida del 05 de enero de 2026 al 31 de enero de 2027 para clientes"), "2027-01-31");
  });

  it("las de inicio no cuentan", () => {
    assert.equal(fechaFinDeTexto("El acuerdo se encuentra vigente desde el 15 de junio de 2020."), null);
    assert.equal(fechaFinDeTexto("Vigencia: A partir del 20 de Noviembre de 2017 en adelante"), null);
    assert.equal(fechaFinDeTexto("El beneficio se aplica a partir del 1° de marzo de 2026"), null);
  });

  it("sin año, o con fechas imposibles, nada", () => {
    assert.equal(fechaFinDeTexto("fin de año (del 20 de diciembre al 10 de enero, mínimo 7 días)"), null);
    assert.equal(fechaFinDeTexto("al 31/06/2026"), null);
    assert.equal(fechaFinDeTexto("Vigencia de la campaña del 17/08/2026 al 30/09/26/2026."), null);
    assert.equal(fechaFinDeTexto(null), null);
  });
});
