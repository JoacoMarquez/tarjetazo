// Creditel y Passcard: promos de rubro entero al comercio canónico.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crudosDePasscard, normalizarCreditel, normalizarPasscard, rubroDeTexto } from "./fuentes/rubro-entero.js";

describe("promos de rubro entero", () => {
  it("reconoce el rubro por palabras", () => {
    assert.equal(rubroDeTexto("Domingos de cines y teatros")?.id, "cines-teatros");
    assert.equal(rubroDeTexto("Pasajes")?.id, "pasajes");
    assert.equal(rubroDeTexto("Préstamos Personales"), null);
  });

  it("Passcard: un tramo por porcentaje, con el día y el tope de las bases", () => {
    const html = `<figcaption><h2>Restaurantes</h2><p>El mejor plan a mitad de semana</p>
      <ul><li>Passcard 25% OFF</li><li>Passcard Like 25% OFF</li><li>Passcard Experta 30% OFF</li><li>Passcard Black 30% OFF</li></ul></figcaption>`;
    const [c] = crudosDePasscard(html);
    const e = normalizarPasscard(c!);
    assert.equal(e.comercio?.key, "todo-restaurantes");
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.productos_elegibles, b.dias_semana, b.tope_monto]), [
      [25, ["passcard-clasica", "passcard-like"], [3], 400],
      [30, ["passcard-experta", "passcard-black"], [3], 400],
    ]);
  });

  it("Creditel: el 20% general, no el de MODO", () => {
    const e = normalizarCreditel({
      fuente_id: "creditel", external_id: "librerias", url_fuente: "https://www.creditel.com.uy/promociones-descuentos", fetched_at: "",
      contenido: "Lunes de librerías\nDía: 1\nRubro: librerias\nDescuento: 20% de descuento · y si sos MODO creditel 25% de descuento",
    });
    assert.equal(e.comercio?.key, "todo-librerias");
    assert.equal(e.beneficios[0]?.porcentaje, 20);
    assert.deepEqual(e.beneficios[0]?.dias_semana, [1]);
  });
});
