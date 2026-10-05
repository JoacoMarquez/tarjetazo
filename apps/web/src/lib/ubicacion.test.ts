import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { propiedadesDeUbicacion, ubicacionDeCabeceras } from "./ubicacion.ts";

describe("ubicación de la visita", () => {
  it("lee las cabeceras de Vercel", () => {
    const h = new Headers({ "x-vercel-ip-country": "UY", "x-vercel-ip-country-region": "MO", "x-vercel-ip-city": "Montevideo" });
    assert.deepEqual(ubicacionDeCabeceras(h), { pais: "UY", region: "MO", ciudad: "Montevideo" });
  });

  it("decodifica la ciudad y descarta valores raros", () => {
    const h = new Headers({ "x-vercel-ip-country": "uy<", "x-vercel-ip-city": "Paysand%C3%BA" });
    assert.deepEqual(ubicacionDeCabeceras(h), { pais: null, region: null, ciudad: "Paysandú" });
    assert.deepEqual(ubicacionDeCabeceras(new Headers({ "x-vercel-ip-city": "%E0%A4%A" })).ciudad, null);
  });

  it("arma las propiedades de PostHog solo con lo que hay", () => {
    assert.deepEqual(propiedadesDeUbicacion({ pais: "UY", region: null, ciudad: "Salto" }), {
      $geoip_country_code: "UY",
      $geoip_city_name: "Salto",
    });
  });
});
