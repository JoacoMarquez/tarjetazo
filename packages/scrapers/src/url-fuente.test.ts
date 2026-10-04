import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { urlFuenteConfiable } from "./url-fuente.js";

describe("url_fuente en un dominio de la fuente", () => {
  it("deja las páginas de la fuente, también en subdominios", () => {
    assert.equal(urlFuenteConfiable("brou", "https://beneficios.brou.com.uy/x"), "https://beneficios.brou.com.uy/x");
    assert.equal(urlFuenteConfiable("anda", "https://anda.com.uy/beneficio/1"), "https://anda.com.uy/beneficio/1");
  });

  it("otro dominio, o uno que solo empieza igual, va a la portada", () => {
    assert.equal(urlFuenteConfiable("anda", "https://otro.example/anda"), "https://anda.com.uy");
    assert.equal(urlFuenteConfiable("itau", "https://itau.com.uy.example.com/x"), "https://www.itau.com.uy");
    assert.equal(urlFuenteConfiable("itau", "https://malitau.com.uy/x"), "https://www.itau.com.uy");
  });

  it("solo http(s)", () => {
    assert.equal(urlFuenteConfiable("oca", "javascript:alert(1)"), "https://www.oca.com.uy");
    assert.equal(urlFuenteConfiable("bbva", "no es url"), "https://www.bbva.com.uy");
  });

  it("OCA puede apuntar al sitio del comercio", () => {
    assert.equal(urlFuenteConfiable("oca", "https://movie.com.uy/promo"), "https://movie.com.uy/promo");
  });
});
