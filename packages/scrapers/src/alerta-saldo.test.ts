// Alerta de saldo del modelo y páginas fallidas en el resumen de Telegram.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineaCorrida } from "./resumen.js";
import { esErrorDeSaldo, modoSinModelo } from "./runner.js";

describe("esErrorDeSaldo", () => {
  it("reconoce el error de Anthropic sin crédito", () => {
    const e = new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}');
    assert.equal(esErrorDeSaldo(e), true);
  });

  it("no confunde otros errores", () => {
    assert.equal(esErrorDeSaldo(new Error("429 rate_limit_error")), false);
    assert.equal(esErrorDeSaldo(new Error("fetch failed")), false);
  });
});

describe("lineaCorrida", () => {
  const base = { termino_en: "2026-09-28T00:25:00Z", nuevos: 0, actualizados: 0, vencidos: 0, a_revisar: 0, fallidas: 0, error: null };

  it("sin cambios ni fallidas, verde", () => {
    assert.deepEqual(lineaCorrida("BROU", base), { linea: "✅ BROU: sin cambios", problema: false });
  });

  it("una fallida se informa pero no alarma", () => {
    assert.deepEqual(lineaCorrida("BROU", { ...base, fallidas: 1 }), { linea: "✅ BROU: 1 página falló", problema: false });
  });

  it("desde 3 fallidas es un problema", () => {
    const r = lineaCorrida("Scotiabank", { ...base, actualizados: 2, fallidas: 4 });
    assert.equal(r.problema, true);
    assert.equal(r.linea, "⚠️ Scotiabank: 2 cambiaron, 4 páginas fallaron");
  });

  it("con error (sin saldo), rojo", () => {
    const r = lineaCorrida("Scotiabank", { ...base, fallidas: 4, error: "Sin saldo en la API de Anthropic: 4 páginas no se pudieron normalizar. Cargá crédito en la consola." });
    assert.equal(r.problema, true);
    assert.ok(r.linea.startsWith("❌ Scotiabank: Sin saldo en la API de Anthropic"));
  });
});

describe("modo sin modelo", () => {
  it("se prende con SCRAPER_SIN_MODELO=1", () => {
    assert.equal(modoSinModelo({ SCRAPER_SIN_MODELO: "1" }), true);
    assert.equal(modoSinModelo({ SCRAPER_SIN_MODELO: "true" }), true);
    assert.equal(modoSinModelo({ SCRAPER_SIN_MODELO: "" }), false);
    assert.equal(modoSinModelo({}), false);
    assert.equal(modoSinModelo({ SCRAPER_SIN_MODELO: "0" }), false);
  });

  it("las páginas pendientes se informan sin alarmar", () => {
    const r = lineaCorrida("Itaú", { termino_en: "2026-09-28T06:10:00Z", nuevos: 0, actualizados: 0, vencidos: 0, a_revisar: 0, fallidas: 0, pendientes: 5, error: null });
    assert.deepEqual(r, { linea: "✅ Itaú: 5 esperan normalización", problema: false });
  });
});
