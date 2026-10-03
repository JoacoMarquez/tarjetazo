// Club El País (#10): departamento desde la dirección, días de las fichas y
// de los legales, vigencia escrita en los legales y la tarjeta de socio fuera
// del catálogo público.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAMILIAS_TARJETA, FAMILIA_POR_ID } from "@tarjetazo/core";
import {
  anioImplicito,
  crudoDeFicha,
  departamentoDeDireccion,
  departamentosDeDireccion,
  normalizarClubElPais,
  vigenciaDeOracion,
} from "./fuentes/club-el-pais.js";
import { slugificar } from "./slug.js";

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

/** Una ficha ya leída, como la guarda `crudoDeFicha` (texto real recortado). */
function ficha(id: string, campos: { promo: string; dias: string; modificada?: string; bajada?: string; legales: string }) {
  const contenido = [
    id,
    `Beneficio: ${campos.promo}`,
    "Rubro según Club El País: vestimenta.",
    `Días (0 = domingo): ${campos.dias}.`,
    "Modalidad: Local - Online.",
    ...(campos.modificada ? [`Ficha modificada: ${campos.modificada}.`] : []),
    "Sucursales: https://ejemplo.com.uy/tiendas",
    ...(campos.bajada ? [campos.bajada] : []),
    "Términos y condiciones:",
    campos.legales,
  ].join("\n");
  return normalizarClubElPais({
    fuente_id: "club-el-pais",
    external_id: slugificar(id),
    url_fuente: `https://www.clubelpais.com.uy/comercio/${slugificar(id)}/`,
    contenido,
    fetched_at: "2026-10-03T14:11:08.313Z",
  });
}

describe("Club El País: días y vigencia de los legales", () => {
  it("IBER: el 30% solo en setiembre y el 10% de lunes a miércoles son dos tramos", () => {
    const e = ficha("IBER", {
      promo: "30% dto.",
      dias: "todos los días",
      modificada: "2026-09-08",
      bajada: "+ 25% ADICIONAL con tarjetas de crédito SCOTIA durante el mes de setiembre",
      legales:
        "Beneficio del 30% aplicable exclusivamente en tienda física durante el mes de setiembre de 2026 en vinos para todos los socios de Club El País que acrediten su condición de tales con su tarjeta de socio y documento de identidad al momento de emitir la factura para las formas de pago contado y con tarjeta. Beneficio acumulable con un 25% de descuento para quienes paguen con tarjetas de crédito Scotia. Aplica un 10% de descuento en el resto de los productos los días lunes, martes y miércoles. No aplica a cigarrillos.",
    });
    assert.equal(e.beneficios.length, 2);
    const [vinos, resto] = e.beneficios;
    assert.equal(vinos?.porcentaje, 30);
    assert.deepEqual(vinos?.dias_semana, []);
    assert.equal(vinos?.vigencia_desde, "2026-09-01");
    assert.equal(vinos?.vigencia_hasta, "2026-09-30");
    assert.equal(resto?.porcentaje, 10);
    assert.equal(resto?.titulo, "10% de descuento");
    assert.deepEqual(resto?.dias_semana, [1, 2, 3]);
    assert.equal(resto?.vigencia_hasta, null);
  });

  it("Under Armour: los días del legal mandan sobre las fichas, y la promo de Santander no es la vigencia", () => {
    const e = ficha("Under Armour", {
      promo: "20% dto.",
      dias: "todos los días",
      modificada: "2026-09-10",
      bajada: "+ 25% adicional con Santander del 10 al 16 de setiembre",
      legales:
        "Beneficio aplicable en tienda fisica y canal online a todos los socios de Club El País que acrediten su condición de tales al momento de emitir la factura con su tarjeta de socio y documento de identidad para las formas de pago contado y con tarjeta los días lunes, martes y miércoles. Del 10 al 16 de setiembre 20% off + 25% adicional pagando con Santander en tienda y web. No aplica a liquidaciones ni se acumula con otras promociones.",
    });
    assert.equal(e.beneficios.length, 1);
    assert.deepEqual(e.beneficios[0]?.dias_semana, [1, 2, 3]);
    assert.equal(e.beneficios[0]?.vigencia_hasta, null);
  });

  it("Ballon: 'del 4 al 8 de agosto' sin año toma el de la última edición de la ficha", () => {
    const html = `
      <script type="application/ld+json">{"@graph":[{"@type":"WebPage","datePublished":"2025-08-04T17:41:14-03:00","dateModified":"2026-09-04T11:23:41-03:00"}]}</script>
      <a title="Rubro" href="https://www.clubelpais.com.uy/rubro/ninos/">Niños</a>
      <h1 class="text-xl" itemprop="name">Ballon</h1>
      <div class="font-secundary text-4xl font-semibold mb-5">20% dto.</div>
      <div class="dias-de-beneficio-ficha gap-2 flex flex-wrap"><span class="block active">L</span><span class="block active">M</span><span class="block active">M</span><span class="block ">J</span><span class="block ">V</span><span class="block ">S</span><span class="block ">D</span></div>
      <h3 class="font-semibold">Modalidad</h3><div class="modalidad-compra flex">Local - Online</div>
      <span class="lugar-comercio text-gray-600">Solano Antuña 2711 BIS</span>
      <div class="terminos-comercio max-h-[300px]"><p>Beneficio aplicable a todos los socios de Club El País que acrediten su condición de tales al momento de emitir la factura con su tarjeta de socio y documento de identidad para las formas de pago contado y con tarjeta del 4 al 8 de agosto . No aplica a liquidaciones ni se acumula con otras promociones.</p></div>`;
    const crudo = crudoDeFicha("https://www.clubelpais.com.uy/comercio/ballon/", html);
    assert.match(crudo.contenido, /^Ficha modificada: 2026-09-04\.$/m);
    const [b] = normalizarClubElPais(crudo).beneficios;
    assert.deepEqual(b?.dias_semana, [1, 2, 3]);
    assert.equal(b?.vigencia_desde, "2026-08-04");
    assert.equal(b?.vigencia_hasta, "2026-08-08");
  });

  it("Amadeus: otros días en Punta del Este son otro tramo, en Maldonado", () => {
    const e = ficha("Amadeus", {
      promo: "20% dto.",
      dias: "1,2,3",
      legales:
        "Beneficio del 20% aplicable en tienda fisica y canal online a todos los socios de Club El País que acrediten su condición de tales al momento de emitir la factura con su tarjeta de socio y documento de identidad para las formas de pago contado y con tarjeta los días lunes, martes y miércoles. No aplica a liquidaciones ni se acumula con otras promociones. En Punta del Este beneficio aplicable los días viernes, sábado y domingo.",
    });
    assert.equal(e.beneficios.length, 2);
    assert.deepEqual(e.beneficios[0]?.dias_semana, [1, 2, 3]);
    assert.deepEqual(e.beneficios[0]?.departamentos, []);
    assert.equal(e.beneficios[1]?.porcentaje, 20);
    assert.deepEqual(e.beneficios[1]?.dias_semana, [0, 5, 6]);
    assert.deepEqual(e.beneficios[1]?.departamentos, ["maldonado"]);
  });

  it("no toma fechas ni días de promos de bancos ni de obsequios", () => {
    const punto = ficha("Punto Design", {
      promo: "20% dto.",
      dias: "1,2,3",
      legales:
        "Beneficio aplicable en tienda física y canal online a todos los socios de Club El País que acrediten su condición de tales al momento de emitir la factura con su tarjeta de socio y documento de identidad para las formas de pago contado y con tarjeta los días lunes, martes y miércoles. No acumula con otras promociones ni aplica al sale. Durante el mes de agosto 2026 al beneficio Club EL PAIS se le suma 15% con tarjetas Santander.",
    });
    assert.equal(punto.beneficios.length, 1);
    assert.equal(punto.beneficios[0]?.vigencia_hasta, null);
    const olivia = ficha("Olivia", {
      promo: "20% dto.",
      dias: "todos los días",
      legales:
        "Beneficio aplicable a todos los socios de Club El País que acrediten su condición de tales con su tarjeta de socio y documento de identidad al momento de emitir la factura para las formas de pago contado o crédito todos los días. Los martes de febrero al mediodía: botella de vino Familia Deicas Cabernet Sauvignon de OBSEQUIO para consumo fuera del local. No acumulable con otras promociones ni aplicable en delivery.",
    });
    assert.deepEqual(olivia.beneficios[0]?.dias_semana, []);
    assert.equal(olivia.beneficios[0]?.vigencia_hasta, null);
  });

  it("vigencia de una oración: fechas con año, sin año, cambio de año y comodín", () => {
    // Coderhouse, con año.
    assert.deepEqual(
      vigenciaDeOracion("Beneficio del 30% válido desde el 18/08/2026 hasta el 25/08/2026 23:59 inclusive.", "2026-08-19"),
      { desde: "2026-08-18", hasta: "2026-08-25" },
    );
    // Editada en diciembre: enero es del año que viene; editada en febrero, diciembre fue el anterior.
    assert.deepEqual(vigenciaDeOracion("Beneficio aplicable del 2 al 10 de enero.", "2026-12-20"), {
      desde: "2027-01-02",
      hasta: "2027-01-10",
    });
    assert.deepEqual(vigenciaDeOracion("Beneficio aplicable del 26 de diciembre al 3 de enero.", "2027-02-01"), {
      desde: "2026-12-26",
      hasta: "2027-01-03",
    });
    assert.deepEqual(vigenciaDeOracion("Beneficio válido durante el mes de febrero.", "2027-01-15"), {
      desde: "2027-02-01",
      hasta: "2027-02-28",
    });
    assert.deepEqual(vigenciaDeOracion("Beneficio aplicable hasta el 15 de octubre.", "2026-09-20"), {
      desde: null,
      hasta: "2026-10-15",
    });
    assert.deepEqual(vigenciaDeOracion("Vigencia 01/01/2025 a 3022.", "2026-09-20"), { desde: null, hasta: null });
    assert.equal(anioImplicito(8, 4, "2027-06-15"), 2027);
    assert.equal(anioImplicito(10, 1, "2027-06-15"), 2026);
  });
});
