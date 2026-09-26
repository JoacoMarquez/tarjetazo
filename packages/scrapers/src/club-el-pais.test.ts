// Club El País (#10): departamento desde la dirección, días de las fichas y
// la tarjeta de socio fuera del catálogo público.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAMILIAS_TARJETA, FAMILIA_POR_ID } from "@tarjetazo/core";
import { crudoDeFicha, departamentoDeDireccion, departamentosDeDireccion, normalizarClubElPais } from "./fuentes/club-el-pais.js";

describe("Club El País", () => {
  it("lee el departamento de la dirección, sin confundirlo con una calle", () => {
    assert.equal(departamentoDeDireccion("Rio Negro 1310 esq. 18 de Julio"), "montevideo");
    assert.equal(departamentoDeDireccion("Florida 1221, Ciudad de Paysandú"), "paysandu");
    assert.equal(departamentoDeDireccion("Av. Artigas 209, Mercedes Soriano"), "soriano");
    assert.equal(departamentoDeDireccion("Nuevo Centro Shopping, Av. Luis Alberto de Herrera esquina Br. Artigas"), "montevideo");
    assert.equal(departamentoDeDireccion("Calle 27 (los Muergos) & Gorlero"), "maldonado");
    assert.equal(departamentoDeDireccion("Costa Urbana Shopping - Av. Giannattasio km 21 Zona Sur piso 1"), "canelones");
    assert.equal(departamentoDeDireccion("Calle Los Lobos esquina Ruta 10 Km 182"), null);
    assert.deepEqual(
      departamentosDeDireccion("Cebollatí 1474, Montevideo | Av. Italia entre Orinoco y Rimas, Punta del Este"),
      ["montevideo", "maldonado"],
    );
    assert.deepEqual(departamentosDeDireccion("Av. Arocena 1571 / Galería Roma local 008"), ["montevideo"]);
  });

  it("arma el beneficio desde la plantilla de la ficha", () => {
    const html = `
      <a title="Rubro" href="https://www.clubelpais.com.uy/rubro/hogar/">Hogar</a>
      <h1 class="text-xl" itemprop="name">Acher</h1>
      <div class="font-secundary text-4xl font-semibold mb-5">20% dto.</div>
      <div class="dias-de-beneficio-ficha gap-2 flex flex-wrap"><span class="block active">L</span><span class="block active">M</span><span class="block active">M</span><span class="block ">J</span><span class="block ">V</span><span class="block ">S</span><span class="block ">D</span></div>
      <h3 class="font-semibold">Modalidad</h3><div class="modalidad-compra flex">Local - Online</div>
      <span class="lugar-comercio text-gray-600"><a href="https://acher.com.uy/tiendas">Ver Sucursales</a></span>
      <div class="terminos-comercio max-h-[300px]"><p>Beneficio aplicable los días lunes, martes y miércoles. No aplica a liquidaciones ni se acumula con otras promociones.</p></div>`;
    const e = normalizarClubElPais(crudoDeFicha("https://www.clubelpais.com.uy/comercio/acher/", html));
    assert.equal(e.comercio?.categoria, "hogar-deco");
    const [b] = e.beneficios;
    assert.equal(b?.porcentaje, 20);
    assert.deepEqual(b?.dias_semana, [1, 2, 3]);
    assert.equal(b?.canal, "ambos");
    assert.equal(b?.acumulable, false);
    // Sin dirección propia (link a sucursales): todo el país.
    assert.deepEqual(b?.departamentos, []);
    assert.deepEqual(b?.productos_elegibles, ["club-el-pais-socio"]);
  });

  it("la tarjeta de socio no está en el catálogo público", () => {
    assert.ok(FAMILIA_POR_ID["club-el-pais-socio"]);
    assert.ok(!FAMILIAS_TARJETA.some((f) => f.fuente_id === "club-el-pais"));
  });
});
