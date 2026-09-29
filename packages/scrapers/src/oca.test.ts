// Parser de OCA (sin modelo), con ítems reales de la API tal como los arma el
// fetch en `Crudo.datos` (bajados el 2026-09-29).
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comercioDe, diasDeOca, normalizarOca } from "./fuentes/oca-parser.js";
import type { DatosOca } from "./fuentes/oca.js";
import { PaginaPendiente, type Crudo } from "./tipos.js";

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const TODO_EL_PAIS = Array.from({ length: 19 }, (_, i) => i + 1);

function crudo(external_id: string, datos: Partial<DatosOca> & Pick<DatosOca, "titulo" | "marca" | "tituloBeneficio">): Crudo {
  return {
    fuente_id: "oca",
    external_id,
    url_fuente: "https://oca.uy/beneficios",
    contenido: "",
    fetched_at: "2026-09-29T12:00:00.000Z",
    datos: {
      tituloLista: "",
      descripcion: "",
      condiciones: "",
      dias: TODOS_LOS_DIAS,
      desde: null,
      hasta: null,
      medios: [1, 2, 6, 8, 9],
      productos: [1, 2],
      departamentos: TODO_EL_PAIS,
      categorias: [],
      ...datos,
    } satisfies DatosOca,
  };
}

describe("parser de OCA", () => {
  it("Bela: los días empiezan en lunes y los departamentos van en orden alfabético", () => {
    const e = normalizarOca(
      crudo("bltfd386aee4e3dacee", {
        titulo: "Bela TC",
        marca: "Bela",
        tituloBeneficio: "20% de dto.",
        condiciones:
          "20% de dto. todos los viernes en Bela, hasta el 31/12/2026 inclusive, pagando con tarjetas de crédito Mastercard y Visa.\nPromoción no acumulable con otros descuentos.",
        dias: [4],
        desde: "2026-06-28",
        hasta: "2026-12-31",
        departamentos: [2, 8, 9, 10, 11, 15, 16, 17, 12],
        categorias: ["bienestar"],
      }),
    );
    assert.deepEqual(e.comercio, { key: "bela", nombre: "Bela", categoria: "salud-belleza" });
    const [b] = e.beneficios;
    assert.equal(b!.titulo, "20% de descuento los viernes");
    assert.deepEqual(b!.dias_semana, [5]);
    assert.deepEqual(b!.departamentos, ["canelones", "lavalleja", "maldonado", "montevideo", "paysandu", "rio-negro", "salto", "san-jose", "soriano"]);
    assert.deepEqual(b!.productos_elegibles, ["oca-mastercard", "oca-visa"]);
    assert.deepEqual([b!.vigencia_desde, b!.vigencia_hasta], ["2026-06-28", "2026-12-31"]);
    assert.equal(b!.acumulable, false);
  });

  it("Búho Store: descuento online con tope por cuenta y cuotas solo con Mastercard", () => {
    const e = normalizarOca(
      crudo("blt6d02c7df809a4cc9", {
        titulo: "Buho Store - Ciberdescuentos- TC",
        marca: "Búho Store",
        tituloBeneficio: "10% de dto. + 12 cuotas* en compras web",
        descripcion: "En compras web",
        condiciones:
          "10% de descuento con tarjetas de crédito + 12 cuotas* en Búho Store, del 31 de agosto al 6 de setiembre del 2026.\nEl descuento es exclusivo para compras web, tiene un tope de $3.000 por cuenta y se verá reflejado en el estado de cuenta.\n*Las 12 cuotas son exclusivas para tarjeta de crédito Mastercard de OCA.",
        medios: [3],
      }),
    );
    assert.equal(e.comercio!.key, "buho-store");
    assert.deepEqual(
      e.beneficios.map((b) => [b.tipo, b.porcentaje ?? b.cuotas, b.productos_elegibles, b.tope_monto, b.tope_periodo, b.canal]),
      [
        ["porcentaje", 10, ["oca-mastercard", "oca-visa"], 3000, "beneficio", "online"],
        ["cuotas", 12, ["oca-mastercard"], null, null, "online"],
      ],
    );
  });

  it("TaTa: si la API dice todos los días, valen los del título", () => {
    assert.deepEqual(
      diasDeOca({ dias: TODOS_LOS_DIAS, tituloBeneficio: "20% de dto de lunes a viernes en categorías seleccionadas", condiciones: "" }),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      diasDeOca({ dias: TODOS_LOS_DIAS, tituloBeneficio: "10% de dto.", condiciones: "Promoción válida de lunes a jueves, hasta el 30 de junio del 2026." }),
      [1, 2, 3, 4],
    );
    assert.deepEqual(diasDeOca({ dias: TODOS_LOS_DIAS, tituloBeneficio: "10% de dto.", condiciones: "" }), []);
  });

  it("el comercio: la marca, o el título si la marca no está en él", () => {
    assert.equal(comercioDe({ titulo: "Duty Free - TC", marca: "12 cuotas" }), "Duty Free");
    assert.equal(comercioDe({ titulo: "LOi - Ciberdescuentos - TC", marca: "Electroventas" }), "LOi");
    assert.equal(comercioDe({ titulo: "Kentucky TC", marca: "Kentchucky" }), "Kentucky");
    assert.equal(comercioDe({ titulo: "Megal 20% - TC", marca: "Megal" }), "Megal");
    assert.equal(comercioDe({ titulo: "Gelatería del Club Blue", marca: "Gelatería del Club" }), "Gelatería del Club");
  });

  it("OCA Blue es la débito; 2 puntos de IVA son un 2%", () => {
    const e = normalizarOca(
      crudo("bltb58f57c400d33828", {
        titulo: "STM - Blue",
        marca: "STM",
        tituloBeneficio: "2 puntos de IVA menos en todas tus recargas en STM",
        productos: [3],
        departamentos: [2, 10, 16],
      }),
    );
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.productos_elegibles, b.departamentos]), [[2, ["oca-blue-debito"], ["canelones", "montevideo", "san-jose"]]]);
  });

  it("Metros, préstamos, campañas que agrupan comercios y pruebas no son beneficios", () => {
    const casos: [string, string, string, Partial<DatosOca>][] = [
      ["1.000 Metros de regalo - Blue", "1.000 Metros de regalo", "1.000 Metros de regalo con tu nueva cuenta OCA Blue", { productos: [3], medios: [] }],
      ["BorradeudasPRAM", "Préstamos OCA", "¡30% de descuento en la tasa de tu préstamo!", { productos: [1, 2, 3, 4] }],
      ["Días OCA de Ciberdescuentos", "Días OCA de Ciberdescuentos", "10% de dto. + 12 cuotas* en compras web", {}],
      ["Presentá a un amigo", "Presentá a un amigo", "Presentá un amigo y ganá 2.000 Metros", { medios: [14] }],
      ["Teste 1", "", "teste1", {}],
    ];
    for (const [titulo, marca, tituloBeneficio, extra] of casos) {
      const e = normalizarOca(crudo("x", { titulo, marca, tituloBeneficio, ...extra }));
      assert.equal(e.es_beneficio, false, titulo);
    }
  });

  it("un beneficio que solo dicen las condiciones queda pendiente", () => {
    assert.throws(
      () =>
        normalizarOca(
          crudo("blt4a01fbbd2151dcd4", {
            titulo: "Macromercado - TC",
            marca: "Macromercado",
            tituloBeneficio: "La mejor escala de precios",
            condiciones: "Para tarjeta de crédito Mastercard (no aplica a Visa) 3 cuotas sin recargo en supermercado.",
          }),
        ),
      PaginaPendiente,
    );
  });
});
