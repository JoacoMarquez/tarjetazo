// Moneda del tope: el schema de core y la regla del normalizador con modelo
// (un tope de compra se guarda como tope de devolución). No llama al modelo.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BeneficioNormalizadoSchema, BeneficioSchema, Moneda } from "@tarjetazo/core";
import { PaginaSchema, SISTEMA, topeDevolucion } from "./normalizador.js";

const base = {
  comercio_key: "bodega-bouza",
  titulo: "25% de ahorro",
  descuento_raw: "25% de ahorro con tarjetas de crédito",
  porcentaje: 25,
  tipo: "porcentaje",
  url_fuente: "https://www.scotiabank.com.uy/x",
};

describe("core: tope_moneda en el schema", () => {
  it("sin moneda es UYU", () => {
    const b = BeneficioNormalizadoSchema.parse({ ...base, tope_monto: 1500, tope_periodo: "mes" });
    assert.equal(b.tope_moneda, "UYU");
    assert.equal(BeneficioNormalizadoSchema.parse(base).tope_moneda, "UYU");
  });

  it("acepta USD y rechaza otras monedas", () => {
    const b = BeneficioNormalizadoSchema.parse({ ...base, tope_monto: 500, tope_periodo: "compra", tope_moneda: "USD" });
    assert.deepEqual([b.tope_monto, b.tope_periodo, b.tope_moneda], [500, "compra", "USD"]);
    assert.equal(BeneficioNormalizadoSchema.safeParse({ ...base, tope_moneda: "EUR" }).success, false);
    assert.equal(BeneficioNormalizadoSchema.safeParse({ ...base, tope_moneda: null }).success, false);
    assert.deepEqual(Moneda.options, ["UYU", "USD"]);
  });

  it("el schema completo también la lleva, con default", () => {
    const b = BeneficioSchema.parse({
      ...base, id: "scotiabank:bodega-bouza:0", fuente_id: "scotiabank", fetched_at: "2026-09-27T00:00:00Z",
      tope_monto: 300, tope_periodo: "compra", tope_moneda: "USD",
    });
    assert.equal(b.tope_moneda, "USD");
    assert.equal(
      BeneficioSchema.parse({ ...base, id: "x:y:0", fuente_id: "scotiabank", fetched_at: "2026-09-27T00:00:00Z" }).tope_moneda,
      "UYU",
    );
  });
});

describe("normalizador: tope de compra → tope de devolución", () => {
  const tramo = { tipo: "porcentaje" as const, porcentaje: 15, tope_moneda: "USD" as const };

  it("15% con tope de compra USD 2.000 → 300 USD por compra", () => {
    assert.deepEqual(topeDevolucion({ ...tramo, tope_monto: 2000, tope_sobre: "compra", tope_periodo: null }), {
      tope_monto: 300, tope_periodo: "compra", tope_moneda: "USD",
    });
    assert.deepEqual(topeDevolucion({ ...tramo, porcentaje: 25, tope_monto: 2000, tope_sobre: "compra", tope_periodo: "compra" }), {
      tope_monto: 500, tope_periodo: "compra", tope_moneda: "USD",
    });
  });

  it("un tope de compra conserva el período que dice la página", () => {
    assert.deepEqual(
      topeDevolucion({ ...tramo, porcentaje: 10, tope_moneda: "UYU", tope_monto: 5000, tope_sobre: "compra", tope_periodo: "mes" }),
      { tope_monto: 500, tope_periodo: "mes", tope_moneda: "UYU" },
    );
  });

  it("decimales: 12% de USD 2.500 son 300; 7% de $ 1.999 son 139,93", () => {
    assert.equal(topeDevolucion({ ...tramo, porcentaje: 12, tope_monto: 2500, tope_sobre: "compra", tope_periodo: null }).tope_monto, 300);
    assert.equal(topeDevolucion({ ...tramo, porcentaje: 7, tope_monto: 1999, tope_sobre: "compra", tope_periodo: null }).tope_monto, 139.93);
  });

  it("un tope de devolución queda como está, con su moneda", () => {
    assert.deepEqual(topeDevolucion({ ...tramo, tope_monto: 200, tope_sobre: "devolucion", tope_periodo: "dia" }), {
      tope_monto: 200, tope_periodo: "dia", tope_moneda: "USD",
    });
    // Sin `tope_sobre` es de devolución (lo de siempre) y sin moneda, pesos.
    assert.deepEqual(topeDevolucion({ ...tramo, tope_moneda: null, tope_monto: 1500, tope_sobre: null, tope_periodo: "mes" }), {
      tope_monto: 1500, tope_periodo: "mes", tope_moneda: "UYU",
    });
  });

  it("cuotas con tope de devolución USD 120 por cuenta: se guarda", () => {
    assert.deepEqual(
      topeDevolucion({ tipo: "cuotas", porcentaje: null, tope_moneda: "USD", tope_monto: 120, tope_sobre: "devolucion", tope_periodo: "beneficio" }),
      { tope_monto: 120, tope_periodo: "beneficio", tope_moneda: "USD" },
    );
  });

  it("un tope de compra sin porcentaje (cuotas, 2x1) no dice cuánto te devuelven: sin tope", () => {
    const sinTope = { tope_monto: null, tope_periodo: null, tope_moneda: "UYU" };
    assert.deepEqual(topeDevolucion({ tipo: "cuotas", porcentaje: null, tope_moneda: "USD", tope_monto: 2000, tope_sobre: "compra", tope_periodo: null }), sinTope);
    assert.deepEqual(topeDevolucion({ tipo: "2x1", porcentaje: null, tope_moneda: "UYU", tope_monto: 900, tope_sobre: "compra", tope_periodo: null }), sinTope);
  });

  it("sin tope, nada", () => {
    assert.deepEqual(topeDevolucion({ ...tramo, tope_monto: null, tope_sobre: null, tope_periodo: null }), {
      tope_monto: null, tope_periodo: null, tope_moneda: "UYU",
    });
  });

  it("el resultado pasa el schema de core", () => {
    const b = BeneficioNormalizadoSchema.parse({
      ...base, ...topeDevolucion({ ...tramo, porcentaje: 25, tope_monto: 2000, tope_sobre: "compra", tope_periodo: null }),
    });
    assert.deepEqual([b.tope_monto, b.tope_periodo, b.tope_moneda], [500, "compra", "USD"]);
  });
});

describe("normalizador: lo que se le pide al modelo", () => {
  it("el schema de salida tiene moneda y sobre qué es el tope, obligatorios y nullables", () => {
    const tramo = PaginaSchema.shape.tramos.element.shape;
    assert.deepEqual(tramo.tope_moneda.unwrap().options, ["UYU", "USD"]);
    assert.deepEqual(tramo.tope_sobre.unwrap().options, ["devolucion", "compra"]);
    assert.equal(tramo.tope_moneda.safeParse(null).success, true);
    assert.equal(tramo.tope_sobre.safeParse(undefined).success, false);
  });

  it("el prompt explica la regla con ejemplos en dólares", () => {
    assert.match(SISTEMA, /tope_sobre`="compra"/);
    assert.match(SISTEMA, /U\$S 200 por tarjeta, por día" → tope_monto 200, tope_moneda USD/);
    assert.match(SISTEMA, /Tope de compra para efectuar el descuento USD 2\.000/);
    assert.match(SISTEMA, /USD120" → tope_monto 120, tope_moneda USD, tope_sobre devolucion, tope_periodo beneficio/);
  });
});

describe("schema normalizado: tope sin período", () => {
  it("rechaza un tope sin período (antes llegaba a la base y fallaba la página)", () => {
    const base = {
      comercio_key: "el-porton", titulo: "25% de descuento", descuento_raw: "25%", porcentaje: 25, cuotas: null, tipo: "porcentaje",
      dias_semana: [], vigencia_desde: null, vigencia_hasta: null, departamentos: [], productos_elegibles: [],
      tope_monto: 3000, tope_periodo: null, canal: "presencial", mecanica: [], acumulable: null, compra_minima: null,
      requiere_activacion: false, legales_raw: null, como_usarlo: [], url_fuente: "https://x",
    };
    assert.equal(BeneficioNormalizadoSchema.safeParse(base).success, false);
    assert.equal(BeneficioNormalizadoSchema.safeParse({ ...base, tope_periodo: "compra" }).success, true);
  });
});
