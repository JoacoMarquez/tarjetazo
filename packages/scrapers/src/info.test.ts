// Info de comercios desde OSM y desde Santander (#118).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sitioDe } from "./fuentes/santander.js";
import { elegir, sitioWeb, usuarioInstagram } from "./geo/info.js";

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

  it("en una cadena, el dato de un solo local no alcanza (salvo un dominio propio)", () => {
    const ancap = ["https://estacionhimalaya.com/", null, null, null];
    assert.equal(elegir("estaciones-ancap", ancap, "sitio"), null);
    assert.equal(elegir("estaciones-ancap", ["ancapcardona", null, null], "instagram"), null);
    assert.equal(elegir("el-dorado", ["https://eldorado.com.uy/", null, null, null], "sitio"), "https://eldorado.com.uy/");
    assert.equal(elegir("tata", ["http://tata.com.uy/", "https://www.tata.com.uy/", "https://www.tata.com.uy/", null], "sitio"), "https://www.tata.com.uy/");
    assert.equal(elegir("bar-tabare", ["http://www.bartabare.com/"], "sitio"), "http://www.bartabare.com/");
  });
});
