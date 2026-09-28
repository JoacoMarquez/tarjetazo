// Del lugar al departamento, y las direcciones escritas de BBVA.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { direccionEscrita } from "./fuentes/bbva.js";
import { departamentoDeLugar } from "./geo/lugares.js";

describe("lugares", () => {
  it("barrios, ciudades y departamentos", () => {
    assert.equal(departamentoDeLugar("Pocitos"), "montevideo");
    assert.equal(departamentoDeLugar("Capurro"), "montevideo");
    assert.equal(departamentoDeLugar("Dolores"), "soriano");
    assert.equal(departamentoDeLugar("Paso de los Toros"), "tacuarembo");
    assert.equal(departamentoDeLugar("Colonia del Sacramento"), "colonia");
    assert.equal(departamentoDeLugar("La Barra"), "maldonado");
    assert.equal(departamentoDeLugar("Algún lugar"), null);
  });

  it("BBVA: la dirección escrita cuando el link no trae el punto", () => {
    assert.deepEqual(direccionEscrita("Puig 1848, Dolores"), { direccion: "Puig 1848, Dolores", departamento: "soriano" });
    assert.deepEqual(direccionEscrita("Restaurant Orillas: Ismael Cortinas S/N, Paso de los Toros"), {
      direccion: "Ismael Cortinas S/N, Paso de los Toros",
      departamento: "tacuarembo",
    });
    // Sin localidad no se sabe dónde buscar.
    assert.equal(direccionEscrita("Santiago de Chile 1015"), null);
  });
});
