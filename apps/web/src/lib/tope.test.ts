// Cómo se muestra un tope en pesos o en dólares. Correr con
// `pnpm --filter @tarjetazo/web test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOLAR_REFERENCIA, montoEn, pesos, topeCorto, topeEnPesos, topeLargo } from "./tope.ts";

describe("tope", () => {
  it("montos en pesos y en dólares", () => {
    assert.equal(pesos(3700), "$ 3.700");
    assert.equal(montoEn(300, "USD"), "US$ 300");
    assert.equal(montoEn(139.93, "UYU"), "$ 139,93");
    // Sin moneda (fila vieja) son pesos.
    assert.equal(montoEn(1500, null), "$ 1.500");
  });

  it("corto, para cards y filas", () => {
    assert.equal(topeCorto({ tope_monto: 3700, tope_periodo: "mes", tope_moneda: "UYU" }), "$ 3.700/mes");
    assert.equal(topeCorto({ tope_monto: 200, tope_periodo: "dia", tope_moneda: "USD" }), "US$ 200/día");
    assert.equal(topeCorto({ tope_monto: 100, tope_periodo: "beneficio", tope_moneda: "USD" }), "US$ 100 en total");
    // PostgREST devuelve los numeric como número, pero por las dudas un texto también sirve.
    assert.equal(topeCorto({ tope_monto: "2000.00", tope_periodo: "compra" }), "$ 2.000/compra");
    assert.equal(topeCorto({ tope_monto: null, tope_periodo: null, tope_moneda: "UYU" }), null);
  });

  it("largo, para la ficha", () => {
    assert.equal(topeLargo({ tope_monto: 300, tope_periodo: "compra", tope_moneda: "USD" }), "US$ 300 por compra");
    assert.equal(topeLargo({ tope_monto: 3700, tope_periodo: "mes", tope_moneda: "UYU" }), "$ 3.700 por mes");
    assert.equal(topeLargo({ tope_monto: 500, tope_periodo: null, tope_moneda: "USD" }), "US$ 500");
    assert.equal(topeLargo({ tope_monto: null, tope_periodo: null }), null);
  });

  it("en pesos para estimar ahorros", () => {
    assert.equal(topeEnPesos({ tope_monto: 1500, tope_periodo: "mes", tope_moneda: "UYU" }), 1500);
    assert.equal(topeEnPesos({ tope_monto: 300, tope_periodo: "compra", tope_moneda: "USD" }), 300 * DOLAR_REFERENCIA);
    assert.equal(topeEnPesos({ tope_monto: null, tope_periodo: null }), null);
  });
});
