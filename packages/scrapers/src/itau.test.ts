// Parser de Itaú (sin modelo), con items reales del feed y de las landings tal
// como los arma el fetch en `Crudo.datos` (bajados el 2026-09-28).
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Departamento, PRODUCTOS } from "@tarjetazo/core";
import { clausulas, comercioDelFeed, normalizarItau, objetoDe, tarjetasDe, vigenciaDelTramo } from "./fuentes/itau-parser.js";
import { diasEnTitulo } from "./fuentes/legales.js";
import type { DatosItauFeed } from "./fuentes/itau.js";
import type { DatosItauLanding } from "./fuentes/itau-landings.js";
import type { Crudo } from "./tipos.js";

const FEED = "https://www.itau.com.uy/inst/beneficios.html";
const LANDING = "https://www.itau.com.uy/inst/restaurantes.html";

function crudo(external_id: string, datos: DatosItauFeed | DatosItauLanding): Crudo {
  return {
    fuente_id: "itau",
    external_id,
    url_fuente: datos.tipo === "feed" ? FEED : LANDING,
    contenido: "",
    fetched_at: "2026-09-28T12:00:00.000Z",
    datos,
  };
}

const activos = (f: (p: (typeof PRODUCTOS)[number]) => boolean) =>
  PRODUCTOS.filter((p) => p.fuente_id === "itau" && p.activo !== false && f(p)).map((p) => p.id).sort();
const CREDITO = activos((p) => p.instrumento === "credito");
const PLATINUM = ["itau-latam-pass-platinum", "itau-visa-platinum"];
const PERSONAL_BANK_Y_BLACK = ["itau-debito-infinite", "itau-latam-pass-infinite", "itau-mastercard-black", "itau-visa-infinite-volar"];
const INTERIOR = Departamento.options.filter((d) => d !== "montevideo");

const CONDICIONES_15 =
  "Del 1 de setiembre 2026 al 30 de setiembre del 2026. El descuento del 15% se efectuará al momento de la compra y el voucher se procesará por el valor de la compra luego de aplicar el descuento correspondiente. Descuento no acumulable con otras campañas vigentes.";
const CONDICIONES_20 =
  "Punta del este - Vigencia de la campaña: Del 1 de setiembre 2026 al 30 de setiembre del 2026. El descuento del 20% se efectuará al momento de la compra y el voucher se procesará por el valor de compra luego de aplicar el descuento correspondiente. Descuento no acumulable con otras campañas vigentes ni aplica para eventos. Montevideo e interior - Vigencia de la campaña: Del 1 de setiembre 2026 al 30 de setiembre del 2026.";
const CONDICIONES_25 =
  "Campaña vigente hasta el 01/12/2026 El descuento del 25% se efectuará al momento de la compra y el voucher se procesará por el valor de la compra luego de aplicado el descuento correspondiente. Descuento no acumulable con otras campañas vigentes ni aplica para eventos. Válido hasta el 1 de diciembre de 2026.";

function landing(nombre: string, ubicaciones: string[]): DatosItauLanding {
  return {
    tipo: "landing",
    nombre,
    rubro: "restaurantes",
    tramos: [
      { encabezado: "Restaurantes 15% menos Todos los días, con tarjetas de crédito Itaú de Uruguay.", ubicaciones, condiciones: CONDICIONES_15 },
      { encabezado: "Restaurantes 20% menos Todos los días, pagando con tus tarjetas de crédito Platinum.", ubicaciones, condiciones: CONDICIONES_20 },
      { encabezado: "Restaurantes 25% menos Todos los días, con tarjetas de débito y crédito Personal Bank. Incluye Infinite y Black.", ubicaciones, condiciones: CONDICIONES_25 },
    ],
  };
}

describe("parser de Itaú: landings de restaurantes", () => {
  it("tres tramos: todas las de crédito, las Platinum y Personal Bank con la Black", () => {
    const e = normalizarItau(crudo("landing-hasami", landing("Hasami", ["Montevideo", "Punta del Este"])));
    assert.deepEqual(e.comercio, { key: "hasami", nombre: "Hasami", categoria: "restaurantes" });
    assert.deepEqual(e.beneficios.map((b) => b.porcentaje), [15, 20, 25]);
    const [quince, veinte, veinticinco] = e.beneficios;
    assert.deepEqual(quince!.productos_elegibles, CREDITO);
    assert.deepEqual(veinte!.productos_elegibles, PLATINUM);
    assert.deepEqual(veinticinco!.productos_elegibles, PERSONAL_BANK_Y_BLACK);
    for (const b of e.beneficios) {
      assert.deepEqual(b.departamentos, ["maldonado", "montevideo"]);
      assert.deepEqual(b.dias_semana, []);
      assert.equal(b.acumulable, false);
      assert.equal(b.canal, "presencial");
      assert.equal(b.tope_monto, null);
    }
    assert.equal(quince!.descuento_raw, "Restaurantes 15% menos Todos los días, con tarjetas de crédito Itaú de Uruguay. En: Montevideo, Punta del Este.");
    assert.deepEqual(e.productos_desconocidos, []);
  });

  it("vigencia de las condiciones de cada tramo (también cuando la dan por ubicación)", () => {
    const e = normalizarItau(crudo("landing-hasami", landing("Hasami", ["Montevideo", "Punta del Este"])));
    const [quince, veinte, veinticinco] = e.beneficios;
    assert.deepEqual([quince!.vigencia_desde, quince!.vigencia_hasta], ["2026-09-01", "2026-09-30"]);
    assert.deepEqual([veinte!.vigencia_desde, veinte!.vigencia_hasta], ["2026-09-01", "2026-09-30"]);
    assert.deepEqual([veinticinco!.vigencia_desde, veinticinco!.vigencia_hasta], [null, "2026-12-01"]);
  });

  it("fechas distintas para las pestañas del tramo: sin vigencia y a revisión", () => {
    const d = landing("Ejemplo", ["Montevideo", "Punta del Este"]);
    d.tramos = [{
      ...d.tramos[1]!,
      condiciones: "Punta del este - Vigencia de la campaña: Del 1 de setiembre 2026 al 30 de setiembre del 2026. Montevideo e interior - Vigencia de la campaña: Del 1 de setiembre 2026 al 31 de octubre del 2026.",
    }];
    const e = normalizarItau(crudo("landing-ejemplo", d));
    assert.equal(e.beneficios[0]!.vigencia_hasta, null);
    assert.equal(e.productos_desconocidos.length, 1);
    assert.match(e.productos_desconocidos[0]!, /^tramo 0: las condiciones dan fechas distintas/);
  });

  it("'Interior' es todo menos Montevideo; con Montevideo, todo el país", () => {
    const soloInterior = normalizarItau(crudo("landing-anita", landing("Anita", ["Interior"])));
    assert.deepEqual(soloInterior.beneficios[0]!.departamentos, INTERIOR);
    const todas = normalizarItau(crudo("landing-vinos-del-mundo", landing("Vinos del Mundo", ["Montevideo", "Punta del Este", "Interior"])));
    assert.deepEqual(todas.beneficios[0]!.departamentos, []);
  });
});

describe("parser de Itaú: items del feed", () => {
  it("varios porcentajes en una frase: días y tarjetas heredados dentro de la oración", () => {
    const e = normalizarItau(crudo("benef-11724", {
      tipo: "feed",
      titulo: "25% 20% y 15% menos en San Roque",
      descripcion: "25% menos en farmacias San Roque los días martes y jueves con tus tarjetas de débito y crédito Personal Bank (incluye Infinite y Black) y 20% menos con tarjetas Platinum. 15% menos todos los días con todas las tarjetas de crédito Itaú y tarjetas de débito Personal Bank.",
      listas: ["tarjeta de crédito"],
      bases: "Comprando en la web o en locales de farmacia San Roque, obtené un 25% de descuento los días martes y jueves y un 15% menos todos los días en tus compras pagando con tarjetas de crédito y débito Personal Bank(incluye Infinite y Black) y 20% menos pagando con Visa Platinum. 15% menos todos los días, pagando con todas las tarjetas de crédito y tarjetas de débito Personal Bank de Banco Itaú Uruguay S.A. El descuento se efectuará al momento de la compra y el voucher se procesará por el valor de la compra luego de aplicar el descuento correspondiente. El descuento es acumulable con ofertas existentes hasta agotar stock. Vigencia de la campaña: del 01/09/2026 al 30/09/2026.",
    }));
    assert.equal(e.comercio?.key, "san-roque");
    assert.equal(e.comercio?.categoria, "farmacias");
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.dias_semana]), [[25, [2, 4]], [20, [2, 4]], [15, []]]);
    // Los días van en el título: distinguen los tramos del mismo comercio.
    assert.deepEqual(e.beneficios.map((b) => b.titulo), [
      "25% de descuento los martes y jueves",
      "20% de descuento los martes y jueves",
      "15% de descuento",
    ]);
    assert.deepEqual(e.beneficios[0]!.productos_elegibles, PERSONAL_BANK_Y_BLACK);
    assert.deepEqual(e.beneficios[1]!.productos_elegibles, PLATINUM);
    assert.deepEqual(e.beneficios[2]!.productos_elegibles, [...CREDITO, "itau-debito-infinite"].sort());
    for (const b of e.beneficios) {
      assert.equal(b.canal, "ambos");
      assert.equal(b.acumulable, true);
      assert.deepEqual([b.vigencia_desde, b.vigencia_hasta], ["2026-09-01", "2026-09-30"]);
    }
  });

  it("'débito Personal Bank' es solo la Débito Infinite", () => {
    const e = normalizarItau(crudo("benef-11244", {
      tipo: "feed",
      titulo: "10% menos en Mosca con Personal Bank",
      descripcion: "10% menos en Mosca con tarjetas de débito Personal Bank.",
      listas: ["tarjeta de débito", "tarjeta de alimentación"],
      bases: "10% menos en Mosca con tarjetas de débito Personal Bank emitidas por Banco Itaú Uruguay . El descuento del 10% se efectuará al momento de la compra y el voucher se procesará por el valor de la compra luego de aplicar el descuento correspondiente. No se acumula con otras campañas vigentes. Vigencia de la campaña: del 01/09/2026 al 30/09/2026.",
    }));
    assert.equal(e.comercio?.key, "mosca");
    assert.deepEqual(e.beneficios[0]!.productos_elegibles, ["itau-debito-infinite"]);
    assert.equal(e.beneficios[0]!.acumulable, false);
  });

  it("2x1: título legible, 'No aplica a Cuenta Pocket' no suma y los departamentos de las bases", () => {
    const e = normalizarItau(crudo("benef-189", {
      tipo: "feed",
      titulo: "2x1 en Las Delicias",
      descripcion: "2x1 en helados de litro y cucuruchos grandes con tarjetas de débito Volar, Junior de Itaú y tarjetas de débito y crédito Personal Bank .No aplica a Itaú Cuenta Pocket.",
      listas: ["tarjeta de débito", "tarjeta de alimentación", "paquete Full", "paquete Light"],
      bases: "2x1 en helados de litro y cucuruchos grandes con tarjetas de débito del programa Volar, Junior y tarjetas de débito y crédito Personal Bank de Itaú todos los días. Beneficio valido solo para compras en el locales de Montevideo y Maldonado. No aplica a Itaú Cuenta Pocket. No se acumula con otras campañas vigentes. Vigencia de la campaña: 01/09/2025 al 30/09/2026.",
    }));
    const b = e.beneficios[0]!;
    assert.equal(b.tipo, "2x1");
    assert.equal(b.titulo, "2x1 en helados de litro y cucuruchos grandes");
    assert.deepEqual(b.productos_elegibles, ["itau-debito-infinite", "itau-debito-junior", "itau-debito-volar", "itau-latam-pass-infinite", "itau-visa-infinite-volar"]);
    assert.deepEqual(b.departamentos, ["maldonado", "montevideo"]);
    assert.deepEqual([b.vigencia_desde, b.vigencia_hasta], ["2025-09-01", "2026-09-30"]);
    assert.equal(b.canal, "presencial");
  });

  it("la sucursal del título da el departamento", () => {
    const e = normalizarItau(crudo("benef-7804", {
      tipo: "feed",
      titulo: "2x1 en Heladería La Nevada - Salto",
      descripcion: "2x1 en helados de kilo y cucuruchos grandes con tarjetas de débito Volar, Junior de Itaú y tarjetas de débito y crédito Personal Bank. No aplica a Itaú Cuenta Pocket.",
      listas: ["tarjeta de débito"],
      bases: "Vigencia de la campaña: del 01/09/2025 al 30/09/2026.",
    }));
    assert.equal(e.comercio?.key, "heladeria-la-nevada");
    assert.deepEqual(e.beneficios[0]!.departamentos, ["salto"]);
  });

  it("Movie: el tramo de lunes a miércoles que solo está en las bases; la Pocket no hace online el de la Volar", () => {
    const e = normalizarItau(crudo("benef-80", {
      tipo: "feed",
      titulo: "2x1 en Movie",
      descripcion: "2x1 en Movie pagando con tu tarjeta de débito Volar.",
      listas: ["tarjeta de débito"],
      bases: "2X1 en Movie todos los días pagando con tarjetas de débito Volar (incluye tarjeta de débito junior) en la compra de entradas y de lunes a miércoles con tarjetas de débito por pago de sueldos (azules) y Cuenta Pocket en la compra de entradas. El tope de la promoción es de cuatro entradas por tarjeta, es decir, dos compras de entradas 2x1 por función. No se acumula con otras campañas vigentes. Cuenta Pocket válida unicamente en compras web. Vigencia de la campaña: del 01/01/2025 al 30/9/2026.",
    }));
    assert.equal(e.beneficios.length, 2);
    const [volar, sueldo] = e.beneficios;
    assert.equal(volar!.titulo, "2x1 en entradas");
    assert.equal(volar!.canal, "presencial");
    assert.deepEqual(volar!.productos_elegibles, ["itau-debito-volar"]);
    assert.deepEqual(volar!.dias_semana, []);
    // "cuatro entradas" no es un monto: sin tope.
    assert.equal(volar!.tope_monto, null);
    assert.equal(sueldo!.titulo, "2x1 en entradas de lunes a miércoles");
    assert.equal(sueldo!.tipo, "2x1");
    assert.deepEqual(sueldo!.dias_semana, [1, 2, 3]);
    assert.deepEqual(sueldo!.productos_elegibles, ["itau-debito-sueldo", "itau-debito-volar"]);
    // La Pocket vale solo en la web; las de sueldo, en la boletería.
    assert.equal(sueldo!.canal, "ambos");
    assert.deepEqual([sueldo!.vigencia_desde, sueldo!.vigencia_hasta], ["2025-01-01", "2026-09-30"]);
  });

  it("títulos: lo que se compra, sin el comercio ni el lugar", () => {
    assert.equal(objetoDe("15% menos en cuponeras en PRAT Pádel", "Prat Pádel"), "en cuponeras");
    assert.equal(objetoDe("24 cuotas sin interés en la compra de Iphone en Movigroup y", "Movigroup"), "en Iphone");
    assert.equal(objetoDe("12 cuotas sin recargo en compra de equipos.", "Movigroup"), "en equipos");
    assert.equal(objetoDe("2x1 en Movie pagando con tu tarjeta de débito Volar.", "Movie"), null);
    assert.equal(objetoDe("25% menos en farmacias San Roque los días martes", "San Roque"), null);
    assert.equal(objetoDe("10% menos en locales de Montevideo", "Mosca"), null);
    assert.equal(objetoDe("2x1 en helados de kilo y cucuruchos grandes con tarjetas", "Heladería La Nevada"), "en helados de kilo y cucuruchos grandes");
  });

  it("títulos: los días", () => {
    assert.equal(diasEnTitulo([]), "");
    assert.equal(diasEnTitulo([2, 4]), " los martes y jueves");
    assert.equal(diasEnTitulo([6]), " los sábados");
    assert.equal(diasEnTitulo([1, 2, 3]), " de lunes a miércoles");
    assert.equal(diasEnTitulo([5, 6, 0]), " de viernes a domingo");
    assert.equal(diasEnTitulo([1, 3, 5]), " los lunes, miércoles y viernes");
  });

  it("rango sin año: toma el único año que nombra el texto; la Black de 'Incluye Infinite y Black'", () => {
    const e = normalizarItau(crudo("benef-11024", {
      tipo: "feed",
      titulo: "25% menos en Taxis Aeropuerto de Carrasco",
      descripcion: "Durante junio, julio y agosto tenés 25% menos con tarjetas de débito y crédito Personal Bank. Incluye Infinite y Black.",
      listas: ["tarjeta de alimentación"],
      bases: "Tenés 25% menos pagando con tarjetas de débito y crédito Personal Bank, incluye Infinite y Black en taxis Aeropuerto de Carrasco durante junio, julio y agosto 2026. Vigencia de la campaña: desde el 1 de junio al 30 de setiembre.",
    }));
    const b = e.beneficios[0]!;
    assert.deepEqual([b.vigencia_desde, b.vigencia_hasta], ["2026-06-01", "2026-09-30"]);
    assert.deepEqual(b.productos_elegibles, PERSONAL_BANK_Y_BLACK);
  });

  it("sin texto: el tramo del título y las tarjetas de las listas del feed", () => {
    const e = normalizarItau(crudo("benef-7864", {
      tipo: "feed", titulo: "15% menos en Loop", descripcion: "", bases: "",
      listas: ["tarjeta de crédito", "tarjeta de alimentación", "paquete Full", "paquete Light"],
    }));
    assert.equal(e.comercio?.key, "loop");
    assert.deepEqual(e.beneficios[0]!.productos_elegibles, [...CREDITO, "itau-alimentacion"].sort());
  });

  it("un título que nombra un rubro toma los comercios de las bases; si no nombran ninguno, no es un beneficio", () => {
    const librerias = comercioDelFeed({
      titulo: "25% menos en Librerías",
      descripcion: "25% menos todos los días pagando con tus tarjetas de débito y crédito Personal Bank (incluye Infinite y Black).",
      bases: "Comprando en la web o en locales de las librerías El Virrey, Escaramuza, Wonder Works y Libros Libros Punta del Este, obtené un 25% de descuento todos los días.",
    });
    assert.deepEqual(librerias, { nombre: "El Virrey, Escaramuza, Wonder Works y Libros Libros Punta del Este", departamento: null });
    const moda = normalizarItau(crudo("benef-8664", { tipo: "feed", titulo: "25% menos en moda", descripcion: "", listas: ["tarjeta de alimentación"], bases: "" }));
    assert.equal(moda.es_beneficio, false);
    assert.equal(moda.comercio, null);
  });

  it("'Beneficios …' es un listado de comercios, no un beneficio", () => {
    const e = normalizarItau(crudo("benef-11624", {
      tipo: "feed",
      titulo: "Beneficios U25",
      descripcion: "15% menos con tarjeta de débito Volar",
      listas: ["tarjeta de débito"],
      bases: "15% menos pagando con tarjeta de débito Volar y Personal Bank en:\nCandy Sweet,\nRudy,\nPez Globo",
    }));
    assert.equal(e.es_beneficio, false);
    assert.deepEqual(e.beneficios, []);
  });

  it("farmacias El Túnel → el-tunel (la base tiene el alias a farmacia-el-tunel)", () => {
    assert.equal(comercioDelFeed({ titulo: "20% y 15% menos en farmacias El Túnel", descripcion: "", bases: "" })?.nombre, "El Túnel");
  });

  it("las fechas que escribe el tramo mandan sobre las de la página; el que no nombra fechas se queda con las de la página", () => {
    const e = normalizarItau(crudo("benef-11764", {
      tipo: "feed",
      titulo: "25% y 15% menos en Mosca tecnología",
      descripcion: "25% menos en Mosca del 9 al 18 de octubre en Tecnología con tarjetas débito y crédito Personal Bank. 15% menos pagando con todas las tarjetas de crédito Itaú.",
      listas: ["tarjeta de débito", "tarjeta de alimentación"],
      bases: "25% menos en Mosca con tarjetas de débito y crédito Personal Bank, incluye Infinite y Black emitidas por Banco Itaú Uruguay . 15% menos en Mosca pagando con todas las tarjetas de crédito. Descuento aplicado a productos de tecnología en exclusiva. No se acumula con otras campañas vigentes. Vigencia de la campaña: del 01/10/2026 al 31/10/2026.",
    }));
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.vigencia_desde, b.vigencia_hasta]), [
      [25, "2026-10-09", "2026-10-18"],
      [15, "2026-10-01", "2026-10-31"],
    ]);
  });

  it("fechas al principio de la oración, antes del porcentaje", () => {
    const e = normalizarItau(crudo("benef-11276", {
      tipo: "feed",
      titulo: "25% menos en Boomerang",
      descripcion: "Del 31 de agosto al 12 de setiembre, tenés 25% menos en Boomerang con tarjetas de crédito Platinum",
      listas: ["tarjeta de crédito"],
      // Recortadas: sin la vigencia, las únicas fechas son las de la descripción.
      bases: "25% de descuento pagando con tarjetas de crédito Platinum de Banco Itaú Uruguay S.A. No se acumula con otras campañas vigentes.",
    }));
    assert.deepEqual([e.beneficios[0]!.vigencia_desde, e.beneficios[0]!.vigencia_hasta], ["2026-08-31", "2026-09-12"]);
  });

  it("sin los datos estructurados tira (la página queda fallida y sus beneficios siguen)", () => {
    const c: Crudo = { fuente_id: "itau", external_id: "x", url_fuente: FEED, contenido: "X", fetched_at: "2026-09-28T12:00:00.000Z" };
    assert.throws(() => normalizarItau(c), /no trae los datos/);
  });
});

describe("parser de Itaú: piezas", () => {
  it("tarjetas", () => {
    assert.deepEqual(tarjetasDe("con tarjetas de débito y crédito Personal Bank. Incluye Infinite y Black.").ids, PERSONAL_BANK_Y_BLACK);
    assert.deepEqual(tarjetasDe("pagando con tus tarjetas de crédito Platinum.").ids, PLATINUM);
    assert.deepEqual(tarjetasDe("con tarjetas de crédito Itaú de Uruguay.").ids, CREDITO);
    assert.deepEqual(tarjetasDe("pagando tarjetas de crédito de Visa y Mastercard emitidas por Banco Itaú").ids, CREDITO);
    assert.deepEqual(tarjetasDe("de lunes a miércoles con tarjetas de débito por pago de sueldos (azules)").ids, ["itau-debito-sueldo"]);
    assert.deepEqual(tarjetasDe("en helados de kilo").nombres, []);
  });

  it("cláusulas: una por porcentaje, 2x1 o cuotas, con su oración", () => {
    const cs = clausulas("20% menos en farmacias San Roque los días martes y jueves y 15% menos todos los días pagando con tarjetas Platinum.");
    assert.deepEqual(cs.map((c) => [c.porcentaje, c.oracion]), [[20, 0], [15, 0]]);
    const cuotas = clausulas("24 cuotas sin interés en la compra de Iphone en Movigroup y 12 cuotas sin recargo en compra de equipos.");
    assert.deepEqual(cuotas.map((c) => [c.tipo, c.cuotas]), [["cuotas", 24], ["cuotas", 12]]);
    const pegadas = clausulas("25%menos los lunes con Personal Bank (incluye Infinite y Black).15% menos todos los días");
    assert.deepEqual(pegadas.map((c) => [c.porcentaje, c.oracion]), [[25, 0], [15, 1]]);
  });

  it("fechas del tramo: el año que falta sale de la vigencia de la página", () => {
    const octubre = { desde: "2026-10-01", hasta: "2026-10-31" };
    const bajada = "2026-10-03T12:00:00.000Z";
    assert.deepEqual(vigenciaDelTramo("25% menos en Mosca del 9 al 18 de octubre en Tecnología", octubre, bajada), { desde: "2026-10-09", hasta: "2026-10-18" });
    assert.deepEqual(vigenciaDelTramo("25% menos del 28 de setiembre al 3 de octubre", octubre, bajada), { desde: "2026-09-28", hasta: "2026-10-03" });
    assert.deepEqual(vigenciaDelTramo("25% menos con Personal Bank, Infinite y Black del 1 al 31 octubre", octubre, bajada), octubre);
    // Con año, vale el escrito.
    assert.deepEqual(vigenciaDelTramo("25% menos del el 1° de julio al 15 de agosto de 2019", octubre, bajada), { desde: "2019-07-01", hasta: "2019-08-15" });
    // Cruza el año: el fin es del siguiente; el año es el que deja el rango dentro de la página.
    const verano = { desde: "2026-12-01", hasta: "2027-01-31" };
    assert.deepEqual(vigenciaDelTramo("20% menos del 28 de diciembre al 3 de enero", verano, bajada), { desde: "2026-12-28", hasta: "2027-01-03" });
    assert.deepEqual(vigenciaDelTramo("20% menos del 5 al 10 de enero", verano, bajada), { desde: "2027-01-05", hasta: "2027-01-10" });
    // Solo el fin: el inicio es el de la página.
    assert.deepEqual(vigenciaDelTramo("Hasta el 10 de octubre tenés", octubre, bajada), { desde: "2026-10-01", hasta: "2026-10-10" });
    // Sin vigencia de la página, la fecha de la bajada.
    assert.deepEqual(vigenciaDelTramo("del 9 al 18 de octubre", { desde: null, hasta: null }, bajada), { desde: "2026-10-09", hasta: "2026-10-18" });
    // Sin fechas, o con días de la semana o porcentajes que no son fechas: nada.
    assert.equal(vigenciaDelTramo("15% menos pagando con todas las tarjetas de crédito Itaú.", octubre, bajada), null);
    assert.equal(vigenciaDelTramo("2X1 de lunes a miércoles con tarjetas de débito", octubre, bajada), null);
    assert.equal(vigenciaDelTramo("10% adicional al 18,03% de Centro Comercial Carrasco", octubre, bajada), null);
  });
});
