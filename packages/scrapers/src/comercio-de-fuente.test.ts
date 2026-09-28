// Comercio que ya nombra la fuente (landings de Itaú) contra el del modelo.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BeneficioNormalizado } from "@tarjetazo/core";
import { conComercioDeFuente } from "./comercio-de-fuente.js";
import type { Crudo, Extraido } from "./tipos.js";

const crudo: Crudo = {
  fuente_id: "itau",
  external_id: "landing-al-fin-y-al-cabo",
  url_fuente: "https://www.itau.com.uy/inst/restaurantes.html",
  contenido: "Al fin y al cabo (restaurantes)\n\n15% menos ...",
  fetched_at: "2026-09-28T00:00:00Z",
  comercio: { nombre: "Al fin y al cabo", categoria: "restaurantes" },
};

const beneficio = { comercio_key: "restaurantes", titulo: "15% de descuento" } as BeneficioNormalizado;

const delModelo: Extraido = {
  crudo,
  comercio: { key: "restaurantes", nombre: "Restaurantes", categoria: "restaurantes" },
  beneficios: [beneficio, { ...beneficio, titulo: "20% de descuento" }],
  productos_desconocidos: [],
};

describe("conComercioDeFuente", () => {
  it("el comercio de la fuente gana sobre el rubro que tomó el modelo", () => {
    const r = conComercioDeFuente(delModelo, crudo);
    assert.deepEqual(r.comercio, { key: "al-fin-y-al-cabo", nombre: "Al fin y al cabo", categoria: "restaurantes" });
    assert.deepEqual(r.beneficios.map((b) => b.comercio_key), ["al-fin-y-al-cabo", "al-fin-y-al-cabo"]);
  });

  it("sin comercio en el crudo queda lo del normalizador", () => {
    const { comercio: _, ...sinComercio } = crudo;
    assert.equal(conComercioDeFuente(delModelo, sinComercio), delModelo);
  });

  it("si el normalizador dijo que no es un beneficio, no inventa un comercio", () => {
    const noEs: Extraido = { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false };
    assert.equal(conComercioDeFuente(noEs, crudo).comercio, null);
  });
});
