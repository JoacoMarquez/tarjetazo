import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agruparBusquedas, type BusquedaDia } from "./admin/busquedas.ts";

const f = (q: string, veces: number, dia = "2026-09-29"): BusquedaDia => ({ q, dia, veces });

describe("búsquedas sin resultado", () => {
  it("los prefijos de lo que se estaba escribiendo se juntan con el completo", () => {
    const t = agruparBusquedas([f("farmas", 2), f("farmasho", 2), f("farmashopp", 2)]);
    assert.deepEqual(t.map((x) => x.q), ["farmashopp"]);
  });

  it("un texto más largo buscado una vez no tapa uno buscado muchas", () => {
    const t = agruparBusquedas([f("farmacia nueva", 40), f("farmacia nuevax", 1)]);
    assert.deepEqual(t.map((x) => [x.q, x.veces]), [["farmacia nueva", 40], ["farmacia nuevax", 1]]);
  });

  it("suma por término entre días", () => {
    const t = agruparBusquedas([f("devoto", 3, "2026-09-28"), f("devoto", 2, "2026-09-29")]);
    assert.deepEqual(t, [{ q: "devoto", veces: 5, dias: 2, ultima: "2026-09-29" }]);
  });
});
