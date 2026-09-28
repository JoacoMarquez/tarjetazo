// Parser de Santander (sin modelo), con fichas reales tal como las arma el
// fetch en `Crudo.datos` (bajadas el 2026-09-28).
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS } from "@tarjetazo/core";
import { normalizarSantander, tarjetasDe, topesDe } from "./fuentes/santander-parser.js";
import type { DatosSantander } from "./fuentes/santander.js";
import { departamentosDeLocales } from "./runner.js";
import type { Crudo } from "./tipos.js";

function crudo(external_id: string, datos: DatosSantander, sucursales: Crudo["sucursales"] = []): Crudo {
  return {
    fuente_id: "santander",
    external_id,
    url_fuente: `https://www.santander.com.uy/beneficios/${external_id}`,
    contenido: "",
    fetched_at: "2026-09-28T12:00:00.000Z",
    sucursales,
    datos,
  };
}

const activos = (f: (p: (typeof PRODUCTOS)[number]) => boolean) =>
  PRODUCTOS.filter((p) => p.fuente_id === "santander" && p.activo !== false && f(p)).map((p) => p.id).sort();
const PRIVATE = ["santander-private", "santander-private-debito", "santander-private-mastercard-black"];
const SELECT = ["santander-select", "santander-select-debito", "santander-select-mastercard-black"];
const PLATINUM = activos((p) => p.tier === "platinum");
const FARMACARD = ["santander-farmacard"];

const TOPE_POR_SEGMENTO = `• Los descuentos aplican a las tarjetas de CRÉDITO y DEBITO emitidas por Banco Santander S.A. (Uruguay), con excepción de la tarjeta débito incluida dentro del paquete Cuenta Nómina Básica (art. 10 de Ley 19.210 de Inclusión Financiera) emitido por Banco Santander S.A.
• A éstos descuentos se les sumará el correspondiente a la devolución de puntos de IVA, de acuerdo a la Ley 17.934.
• El descuento se efectuará en el estado de cuenta , pudiendo figurar en el mismo hasta 30 días después de efectuada la compra.
• Tope de Devolución mensual (por cliente, por tipo de tarjeta -crédito y débito- y por restaurante):
Clientes bajo segmento Private Banking: hasta UYU 6.000 en total con la suma de tarjetas de crédito, más UYU 6.000 en total con la suma de tarjetas de débito.
Clientes bajo segmento Select: hasta UYU 4.000 en total con la suma de tarjetas de crédito, más UYU 4.000 en total con la suma de tarjetas de débito.
Para el resto de los segmentos: hasta UYU 2.000 en total con la suma de tarjetas de crédito, más UYU 2.000 en total con la suma de tarjetas de débito.
• Restricciones: Promoción no acumulable a otros descuentos y sujeta a cambios sin previo aviso. Banco Santander es ajeno a los problemas de comunicación que puedan existir para que se realice íntegramente la transacción. No aplica descuentos a transacciones hechas a través de Mercado Pago y Pos Handy.`;

const RUTA_GOURMET: DatosSantander = {
  titulo: "Bruta",
  resumen: ["25% con Platinum, Select y Private Banking.", "15% con crédito y débito.", "A los descuentos se suma la devolución de puntos de IVA."],
  condiciones: TOPE_POR_SEGMENTO,
  categoria: "Ruta Gourmet",
};

const HELADERIA: DatosSantander = {
  titulo: "Gelatería Il Porto",
  resumen: ["50% de descuento con tarjeta Infinite, Black y débito Select, 30% de descuento con tarjetas de crédito y débito todos los días."],
  condiciones: `• Tope de Devolución: el mismo se calcula por tipo de tarjeta: crédito o débito.
Para tarjetas de crédito Select : la devolución es de hasta UYU 4.000 en la suma de tarjetas por cada restaurant.
Para tarjetas de débito Select la devolución es de hasta UYU 4.000 en la suma en tarjetas por mes por cada restaurant.
Para el resto de las tarjetas el tope de devolución en cada tipo de tarjeta (débito y crédito) será de hasta $ 2.000 por mes por cada restaurante.
Cada restaurante tiene su propio tope, no se suman entre si.
• Restricciones: Promoción no acumulable a otros descuentos y sujeta a cambios sin previo aviso.`,
  categoria: "Heladerías",
};

describe("parser de Santander: Ruta Gourmet", () => {
  const e = normalizarSantander(crudo("bruta", RUTA_GOURMET));

  it("25% partido por segmento, cada uno con su tope mensual", () => {
    assert.deepEqual(e.comercio, { key: "bruta", nombre: "Bruta", categoria: "restaurantes" });
    const veinticinco = e.beneficios.filter((b) => b.porcentaje === 25);
    assert.deepEqual(
      veinticinco.map((b) => [b.productos_elegibles, b.tope_monto, b.tope_periodo]).sort((a, b) => (a[1] as number) - (b[1] as number)),
      [
        [PLATINUM, 2000, "mes"],
        [SELECT, 4000, "mes"],
        [PRIVATE, 6000, "mes"],
      ].sort((a, b) => (a[1] as number) - (b[1] as number)),
    );
  });

  it("el 15% es para las tarjetas que no tienen el 25%", () => {
    const quince = e.beneficios.filter((b) => b.porcentaje === 15);
    assert.equal(quince.length, 1);
    const ids = quince[0]!.productos_elegibles;
    for (const id of [...PLATINUM, ...SELECT, ...PRIVATE]) assert.ok(!ids.includes(id), id);
    assert.ok(ids.includes("santander-visa") && ids.includes("santander-debito"));
    assert.deepEqual([quince[0]!.tope_monto, quince[0]!.tope_periodo], [2000, "mes"]);
  });

  it("todos los días, presencial, no acumulable, sin fecha; los departamentos los pone el runner", () => {
    for (const b of e.beneficios) {
      assert.deepEqual(b.dias_semana, []);
      assert.equal(b.canal, "presencial");
      assert.equal(b.acumulable, false);
      assert.equal(b.vigencia_hasta, null);
      assert.deepEqual(b.departamentos, []);
      assert.equal(b.tope_moneda, "UYU");
    }
    assert.equal(e.departamentosDeLocales, true);
    assert.deepEqual(e.productos_desconocidos, []);
  });
});

describe("parser de Santander: otras plantillas", () => {
  it("\"15% de descuento todos los días\" vale con cualquier tarjeta, sin tope", () => {
    const e = normalizarSantander(
      crudo("optica-estela-jinchuk", {
        titulo: "Optica Estela Jinchuk",
        resumen: ["15% de descuento todos los días."],
        condiciones: "El descuento se efectúa en el punto de venta.\nEl beneficio no aplica para la compra de lentes de contacto.\nDescuento no acumulable con otras promociones.",
        categoria: "Moda",
      }),
    );
    assert.equal(e.beneficios.length, 1);
    const [b] = e.beneficios;
    assert.equal(b!.titulo, "15% de descuento");
    assert.deepEqual(b!.productos_elegibles, []);
    assert.equal(b!.tope_monto, null);
    assert.equal(e.comercio!.categoria, "indumentaria");
  });

  it("sin tarjeta nombrada pero con topes por segmento: un tramo por segmento", () => {
    const e = normalizarSantander(
      crudo("heladeria-imperial", { titulo: "Heladería Imperial", resumen: ["15% de descuento todos los días."], condiciones: TOPE_POR_SEGMENTO, categoria: "Ruta Gourmet" }),
    );
    assert.deepEqual(e.beneficios.map((b) => b.tope_monto).sort(), [2000, 4000, 6000]);
  });

  it("heladerías: 50% con Infinite, Black y débito Select según el tope de cada una", () => {
    const e = normalizarSantander(crudo("gelateria-il-porto", HELADERIA));
    const cincuenta = e.beneficios.filter((b) => b.porcentaje === 50);
    assert.deepEqual(
      cincuenta.map((b) => [b.productos_elegibles, b.tope_monto, b.tope_periodo]),
      [
        [["santander-aadvantage-mastercard-black", "santander-aadvantage-visa-infinite", "santander-private", "santander-private-mastercard-black"], 2000, "mes"],
        [["santander-select", "santander-select-mastercard-black"], 4000, "mes"],
        [["santander-select-debito"], 4000, "mes"],
      ],
    );
    const treinta = e.beneficios.filter((b) => b.porcentaje === 30);
    assert.equal(treinta.length, 1);
    assert.ok(!treinta[0]!.productos_elegibles.includes("santander-select-debito"));
  });

  it("Farmacard: días al principio del párrafo, tope solo para la Farmacard", () => {
    const e = normalizarSantander(
      crudo("farmashop", {
        titulo: "Farmashop",
        resumen: [
          "Todos los días 10% de descuento con Santander Farmacard.",
          "Martes, jueves y domingos 15% con Santander y 25% de descuento con Santander Farmacard en categorías seleccionadas.",
        ],
        condiciones: "Conoce más en https://tienda.farmashop.com.uy/\nDescuentos exclusivos para socios Farmacard.\nTope mensual de descuento por socio Farmacard de $U 5.000.",
        categoria: "Farmacia",
      }),
    );
    assert.deepEqual(
      e.beneficios.map((b) => [b.porcentaje, b.dias_semana, b.productos_elegibles, b.tope_monto]),
      [
        [10, [], FARMACARD, 5000],
        [15, [2, 4, 0], [], null],
        [25, [2, 4, 0], FARMACARD, 5000],
      ],
    );
    assert.equal(e.beneficios[2]!.titulo, "25% de descuento en categorías seleccionadas los martes, jueves y domingos");
  });

  it("PedidosYa: días, fechas, crédito Platinum/Infinite/Black, online", () => {
    const e = normalizarSantander(
      crudo("pedidosya-0", {
        titulo: "PedidosYa",
        resumen: ["15% de descuento los martes y los sábados, en restaurantes, con tarjetas de crédito Platinum, Infinite y Black."],
        condiciones:
          "Fecha: Válido días Martes y Sábados desde 11/04/2026 al 31/01/2027.\nBeneficio: 15% en Restaurantes.\nTope mensual por usuario de $3.000.\nOperativa: El descuento se realiza directamente en el checkout de la aplicación PedidosYa al momento de la compra.",
        categoria: "Ruta Gourmet",
      }),
    );
    const [b] = e.beneficios;
    assert.equal(e.beneficios.length, 1);
    assert.equal(e.comercio!.key, "pedidosya");
    assert.deepEqual(b!.dias_semana, [2, 6]);
    assert.deepEqual([b!.vigencia_desde, b!.vigencia_hasta], ["2026-04-11", "2027-01-31"]);
    assert.deepEqual([b!.tope_monto, b!.tope_periodo], [3000, "mes"]);
    assert.equal(b!.canal, "online");
    assert.equal(b!.productos_elegibles.length, 10);
    assert.ok(!b!.productos_elegibles.some((id) => id.endsWith("-debito")));
  });

  it("Buquebus: descuento y cuotas, con el fin del convenio", () => {
    const e = normalizarSantander(
      crudo("buquebus", {
        titulo: "Buquebus",
        resumen: ["10% de descuento en paquetes* a Argentina.", "12 cuotas sin recargo todos los días.", "Valido para todas las tarjetas Santander."],
        condiciones: "Hasta 12 cuotas sin recargo convenio vigente 31/03/2026.\nEl descuento no aplica para tramos aéreos, no es acumulable para otras promociones.",
        categoria: "Viajes y turismo",
      }),
    );
    assert.deepEqual(e.beneficios.map((b) => b.titulo), ["10% de descuento en paquetes a Argentina", "12 cuotas sin recargo"]);
    assert.deepEqual(e.beneficios.map((b) => b.vigencia_hasta), ["2026-03-31", "2026-03-31"]);
    assert.equal(e.beneficios[1]!.cuotas, 12);
  });

  it("\"débito automático\" es una forma de pago, no una tarjeta", () => {
    assert.deepEqual(tarjetasDe("15% de descuento con débito automático en Tarjeta de crédito Santander").ids, activos((p) => p.instrumento === "credito"));
  });

  it("canje de puntos y promos sin porcentaje no son beneficios", () => {
    for (const resumen of ["El comercio acepta canje de puntos Soy Santander.", "Descuento sujeto a promociones."]) {
      const e = normalizarSantander(crudo("x", { titulo: "X", resumen: [resumen], condiciones: "", categoria: null }));
      assert.equal(e.es_beneficio, false);
      assert.equal(e.comercio, null);
    }
  });

  it("sin los datos de la ficha, falla (y los beneficios de antes siguen)", () => {
    assert.throws(() => normalizarSantander({ ...crudo("x", RUTA_GOURMET), datos: undefined }));
  });
});

describe("topes de Santander", () => {
  it("por segmento, con el período del encabezado", () => {
    assert.deepEqual(
      topesDe(TOPE_POR_SEGMENTO).map((t) => [t.monto, t.periodo, t.para]),
      [
        [6000, "mes", PRIVATE],
        [4000, "mes", SELECT],
        [2000, "mes", "resto"],
      ],
    );
  });
});

describe("departamentos de los locales (runner)", () => {
  const locales = new Map<string, string | null>([
    ["bigg|Bulevar Artigas 26 esquina Rambla", "montevideo"],
    ["bigg|Ruta Interbalnearia y Camino de los Horneros", "canelones"],
    ["bigg|Sin ubicar", null],
  ]);
  const local = (direccion: string) => ({ nombre: null, direccion, lat: -34.9, lng: -56.1 });

  it("los de cada local, según el reverse de su punto", () => {
    assert.deepEqual(
      departamentosDeLocales(locales, "bigg", [local("Bulevar Artigas 26 esquina Rambla"), local("Ruta Interbalnearia y Camino de los Horneros")]),
      ["canelones", "montevideo"],
    );
  });

  it("si un local no tiene departamento, o no hay locales, no restringe", () => {
    assert.equal(departamentosDeLocales(locales, "bigg", [local("Bulevar Artigas 26 esquina Rambla"), local("Sin ubicar")]), null);
    assert.equal(departamentosDeLocales(locales, "bigg", []), null);
  });
});
