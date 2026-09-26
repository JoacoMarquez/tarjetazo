// Bajas del catálogo: una familia que el banco dejó de publicar se propone
// como baja, nunca se aplica sola. Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bajasDeFuente, clave } from "./catalogo/sugerencias.js";

const pag = (entradas: [string, string[] | null][]) => new Map(entradas);

describe("bajasDeFuente", () => {
  it("propone la familia que se vio antes y ya no aparece", () => {
    const antes = pag([["/a", ["bbva-black", "bbva-infinite"]], ["/b", ["bbva-sodimac"]]]);
    const ahora = pag([["/a", ["bbva-black", "bbva-infinite"]], ["/b", []]]);
    const bajas = bajasDeFuente("bbva", antes, ahora);
    assert.deepEqual(bajas.map((b) => b.familia_id), ["bbva-sodimac"]);
    assert.equal(bajas[0]!.tipo, "baja");
    assert.equal(bajas[0]!.campo, null);
    assert.deepEqual(bajas[0]!.valor, { paginas: ["/b"] });
    assert.equal(bajas[0]!.url, "/b");
  });

  it("una familia que pasó a otra página no es baja", () => {
    const antes = pag([["/vieja", ["bbva-sodimac"]]]);
    const ahora = pag([["/nueva", ["bbva-sodimac"]]]);
    assert.deepEqual(bajasDeFuente("bbva", antes, ahora), []);
  });

  it("una página que desapareció del índice cuenta como no vista", () => {
    const antes = pag([["/a", ["bbva-black"]], ["/sodimac", ["bbva-sodimac"]]]);
    const ahora = pag([["/a", ["bbva-black"]]]);
    assert.deepEqual(bajasDeFuente("bbva", antes, ahora).map((b) => b.familia_id), ["bbva-sodimac"]);
  });

  it("nunca propone una familia que no se vio nunca", () => {
    // TuApp no está en ninguna página del catálogo de BROU.
    const antes = pag([["/visa", ["brou-visa"]]]);
    const ahora = pag([["/visa", ["brou-visa"]]]);
    assert.deepEqual(bajasDeFuente("brou", antes, ahora), []);
  });

  it("sin familias guardadas (primera revisión) no propone nada", () => {
    const antes = pag([["/a", null], ["/b", null]]);
    const ahora = pag([["/a", ["bbva-black"]], ["/b", []]]);
    assert.deepEqual(bajasDeFuente("bbva", antes, ahora), []);
  });

  it("ignora familias de otra fuente o dadas de baja en código", () => {
    // `bbva-platinum` (Visa Platinum) ya es activo = false: no vuelve a proponerse.
    const antes = pag([["/a", ["bbva-platinum", "brou-visa", "bbva-black"]]]);
    const ahora = pag([["/a", []]]);
    assert.deepEqual(bajasDeFuente("bbva", antes, ahora).map((b) => b.familia_id), ["bbva-black"]);
  });

  it("junta y ordena las páginas donde se veía", () => {
    const antes = pag([["/z", ["bbva-oro"]], ["/a", ["bbva-oro"]]]);
    const [baja] = bajasDeFuente("bbva", antes, pag([]));
    assert.deepEqual(baja!.valor, { paginas: ["/a", "/z"] });
    assert.equal(baja!.url, "/a");
  });
});

describe("clave", () => {
  it("una baja por familia", () => {
    assert.equal(clave({ fuente_id: "bbva", familia_id: "bbva-oro", tipo: "baja", campo: null, nombre_visto: "x" }), "baja|bbva-oro");
    assert.notEqual(
      clave({ fuente_id: "bbva", familia_id: "bbva-oro", tipo: "baja", campo: null, nombre_visto: "x" }),
      clave({ fuente_id: "bbva", familia_id: "bbva-oro", tipo: "campo", campo: "costo_anual", nombre_visto: "x" }),
    );
  });
});
