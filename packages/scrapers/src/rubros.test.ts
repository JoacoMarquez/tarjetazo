// Rubros enteros (@tarjetazo/core): qué comercios reciben la nota "también en
// todas las librerías". Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORIAS, RUBROS_ENTEROS, esComercioDeRubro, keyDeRubro, rubrosDeComercio } from "@tarjetazo/core";

const ids = (c: { key: string; nombre: string; categoria: string }) => rubrosDeComercio(c).map((r) => r.id);

describe("rubros enteros", () => {
  it("cada rubro usa una categoría que existe", () => {
    const slugs = new Set(CATEGORIAS.map((c) => c.slug));
    for (const r of RUBROS_ENTEROS) assert.ok(slugs.has(r.categoria), r.id);
  });

  it("la categoría sola no alcanza cuando es más gruesa que el rubro", () => {
    assert.deepEqual(ids({ key: "optica-del-centro", nombre: "Óptica del Centro", categoria: "salud-belleza" }), ["opticas"]);
    assert.deepEqual(ids({ key: "peluqueria-x", nombre: "Peluquería X", categoria: "salud-belleza" }), ["peluquerias"]);
    assert.deepEqual(ids({ key: "spa-y", nombre: "Spa Y", categoria: "salud-belleza" }), []);
    assert.deepEqual(ids({ key: "grido", nombre: "Grido", categoria: "restaurantes" }), ["restaurantes", "heladerias"]);
    assert.deepEqual(ids({ key: "farmashop", nombre: "Farmashop", categoria: "farmacias" }), ["farmacias"]);
  });

  it("el comercio canónico no se muestra a sí mismo", () => {
    const librerias = RUBROS_ENTEROS.find((r) => r.id === "librerias")!;
    assert.ok(esComercioDeRubro(keyDeRubro(librerias)));
    assert.deepEqual(ids({ key: "todo-librerias", nombre: "Todas las librerías", categoria: "libreria-juguetes" }), []);
  });
});
