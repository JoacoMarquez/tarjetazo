// ANDA (#10): categorías de la landing, agrupado por marca y lectura de las
// condiciones. Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoriasDeLanding, crudosDeItems, normalizarAnda, type ItemAnda } from "./fuentes/anda.js";

const JUEVES = { slug: "jueves-anda-octubre", nombre: "Jueves ANDA octubre" };
const BASES = "Promoción válida para compras presenciales hasta el 31/12/26. El tope de descuento es de $2.000 por compra y aplica en el punto de venta.";

function item(titulo: string, localidad: string, departamento: string, link = `https://anda.com.uy/dias-de-descuentos/${localidad}/`): ItemAnda {
  return { titulo, descuento: "20", bases: BASES, localidad, link, departamento, categoria: JUEVES };
}

describe("ANDA", () => {
  it("lee las categorías de la landing, sin el feed", () => {
    const html = `<a href="https://anda.com.uy/categoria/dias-de-descuentos/jueves-anda/">x</a>
      <a href="https://anda.com.uy/categoria/dias-de-descuentos/feed/">rss</a>
      <a href="/categoria/dias-de-descuentos/todos-los-dias/">y</a>`;
    assert.deepEqual(categoriasDeLanding(html).map((c) => c.slug), ["jueves-anda", "todos-los-dias"]);
  });

  it("junta los locales de una marca y las copias en un beneficio", () => {
    const crudos = crudosDeItems([
      item("Óptica Odella", "Sauce", "Canelones"),
      item("Óptica Odella", "Durazno", "Durazno"),
      item("Óptica Odella", "Sauce", "Canelones", "https://anda.com.uy/dias-de-descuentos/odella-sauce-2/"),
    ]);
    assert.equal(crudos.length, 1);
    // El id no depende del mes: "jueves-anda" y "jueves-anda-octubre" son la misma página.
    assert.equal(crudos[0]!.external_id, "jueves-optica-odella");
    const [b] = normalizarAnda(crudos[0]!).beneficios;
    assert.deepEqual(b?.dias_semana, [4]);
    assert.deepEqual(b?.departamentos, ["canelones", "durazno"]);
    assert.equal(b?.tope_monto, 2000);
    assert.equal(b?.tope_periodo, "compra");
    assert.equal(b?.vigencia_hasta, "2026-12-31");
    assert.equal(b?.canal, "presencial");
    assert.deepEqual(b?.productos_elegibles, []);
  });

  it("lee fechas con nombre de mes y las tarjetas que nombra", () => {
    const [c] = crudosDeItems([{
      titulo: "Ser Animal",
      descuento: "15",
      bases: "Promoción válida todos los días del 1.º de octubre al 31 de diciembre de 2026 inclusive, con tarjeta de crédito ANDA y prepaga DEANDA. El descuento se aplica en el estado de cuenta.",
      localidad: "",
      link: "https://anda.com.uy/dias-de-descuentos/ser-animal/",
      departamento: "Montevideo",
      categoria: { slug: "todos-los-dias", nombre: "Todos los días" },
    }]);
    const [b] = normalizarAnda(c!).beneficios;
    assert.equal(b?.vigencia_desde, "2026-10-01");
    assert.equal(b?.vigencia_hasta, "2026-12-31");
    assert.deepEqual(b?.dias_semana, []);
    assert.equal(b?.tipo, "reintegro");
    assert.deepEqual(b?.productos_elegibles, ["anda-credito", "anda-visa", "anda-deanda"]);
  });
});
