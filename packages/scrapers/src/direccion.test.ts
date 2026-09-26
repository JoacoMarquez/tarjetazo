// Pines desde direcciones escritas (Club El País): limpieza y validación del
// punto que devuelve el geocodificador. Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limpiarDireccion, mismaDireccion, puntoConfiable } from "./geo/direccion.js";
import type { Punto } from "./geo/tipos.js";

describe("direcciones escritas", () => {
  it("deja la calle y el número", () => {
    assert.equal(limpiarDireccion("Pesaro 2917 Esq. Madreselva"), "Pesaro 2917");
    assert.equal(limpiarDireccion("Dr. José Scosería 2612 - Local 2"), "Dr. José Scosería 2612");
    assert.equal(limpiarDireccion("García Cortinas 2357 Piso 5 - Edificio El Plata"), "García Cortinas 2357");
    assert.equal(limpiarDireccion("Ruta 60 km 19, Maldonado"), null);
    assert.equal(limpiarDireccion("Via Disegno Mall"), null);
  });

  it("acepta la misma calle con el número cerca, y nada más", () => {
    assert.ok(mismaDireccion("Solano García 2454", "SOLANO GARCIA 2454"));
    assert.ok(mismaDireccion("Av. Artigas 209", "GENERAL JOSE G. ARTIGAS 223"));
    assert.ok(mismaDireccion("Solano Antuña 2711 BIS", "FRANCISCO SOLANO ANTUÑA 2711"));
    // Otra calle, o la misma a un kilómetro.
    assert.ok(!mismaDireccion("Avenida de las Americas 4239", "EXODO 4066"));
    assert.ok(!mismaDireccion("Costa Rica 6488", "COSTA RICA 2261"));
    assert.ok(!mismaDireccion("Punta Carretas 136", "LA CARRETA 1602"));
  });

  it("un punto 'de calle' no es confiable", () => {
    const punto = (precision: Punto["precision"]): Punto => ({
      lat: -34.9, lng: -56.1, precision, fuente: "ide_uy", direccion_normalizada: "SOLANO GARCIA 2454", departamento: null, localidad: null,
    });
    assert.ok(!puntoConfiable("Solano García 2454", punto("calle")));
    assert.ok(puntoConfiable("Solano García 2454", punto("exacta")));
  });
});
