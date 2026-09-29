// Info de comercios desde OSM y desde Santander (#118).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sitioDe } from "./fuentes/santander.js";
import { sitioWeb, usuarioInstagram } from "./geo/info.js";

describe("info de comercios", () => {
  it("Instagram: URL, arroba o usuario", () => {
    assert.equal(usuarioInstagram("https://www.instagram.com/tata.uy/"), "tata.uy");
    assert.equal(usuarioInstagram("@Bela_uy"), "bela_uy");
    assert.equal(usuarioInstagram("no es un usuario"), null);
  });

  it("sitio web con protocolo; las redes sociales no son sitio", () => {
    assert.equal(sitioWeb("www.tata.com.uy"), "https://www.tata.com.uy/");
    assert.equal(sitioWeb("https://tiendainglesa.com.uy;https://otra.com"), "https://tiendainglesa.com.uy/");
    assert.equal(sitioWeb("https://www.facebook.com/algo"), null);
    assert.equal(sitioWeb("sin punto"), null);
  });

  it("el \"Visitar Página\" de Santander, si no es del propio banco", () => {
    const html = `<a href="https://www.aihaus.com.uy/"  class="d-inline-flex text-sm beneficios-modal-link gap-1">
         Visitar Página <svg></svg></a>`;
    assert.equal(sitioDe(html), "https://www.aihaus.com.uy/");
    assert.equal(sitioDe(html.replace("www.aihaus.com.uy", "www.santander.com.uy")), null);
    assert.equal(sitioDe("<p>sin link</p>"), null);
  });
});
