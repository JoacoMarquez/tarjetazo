import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { direccionConLocalidad, nombreDeLugar } from "./direccion.ts";

describe("direcciones de los locales", () => {
  it("pasa las localidades en mayúsculas a nombre propio", () => {
    assert.equal(nombreDeLugar("CIUDAD DE LA COSTA"), "Ciudad de la Costa");
    assert.equal(nombreDeLugar("Montevideo"), "Montevideo");
  });

  it("no repite la localidad si la dirección ya la dice", () => {
    assert.equal(direccionConLocalidad("República De Chile 4851, Atlantida", "ATLANTIDA"), "República De Chile 4851, Atlantida");
    assert.equal(direccionConLocalidad("Tomás Berreta 333, Canelones", "CANELONES"), "Tomás Berreta 333, Canelones");
    assert.equal(direccionConLocalidad("18 de Julio 1234", "MONTEVIDEO"), "18 de Julio 1234, Montevideo");
    assert.equal(direccionConLocalidad("18 de Julio 1234", null), "18 de Julio 1234");
  });
});
