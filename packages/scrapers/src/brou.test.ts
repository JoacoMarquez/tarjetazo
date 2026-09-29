// Parser de BROU (sin modelo), con fichas reales tal como las arma el fetch en
// `Crudo.datos` (bajadas el 2026-09-29).
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comercioDe, normalizarBrou, tarjetasDe } from "./fuentes/brou-parser.js";
import { datosDeFicha, type DatosBrou } from "./fuentes/brou.js";
import { PaginaPendiente, type Crudo } from "./tipos.js";

function crudo(external_id: string, datos: Omit<DatosBrou, "categoria"> & { categoria?: string | null }): Crudo {
  return {
    fuente_id: "brou",
    external_id,
    url_fuente: `https://beneficios.brou.com.uy/beneficios/${external_id}`,
    contenido: "",
    fetched_at: "2026-09-29T12:00:00.000Z",
    datos: { categoria: null, ...datos },
  };
}

const VISA_CREDITO = ["brou-visa", "brou-visa-gold", "brou-visa-platinum"];
const RECOMPENSA_CREDITO = ["brou-recompensa", "brou-recompensa-black", "brou-recompensa-gold", "brou-recompensa-platinum"];
const ordenar = (xs: string[]) => [...xs].sort();

describe("tarjetas de BROU", () => {
  it("marca, instrumento y niveles", () => {
    assert.deepEqual(
      tarjetasDe("con tarjetas de crédito BROU VISA Platinum y BROU Recompensa Mastercard Platinum y Black.").ids,
      ["brou-recompensa-black", "brou-recompensa-platinum", "brou-visa-platinum"],
    );
    assert.deepEqual(
      tarjetasDe("con tarjetas de crédito BROU VISA Internacional y Oro y BROU Recompensa Mastercard Internacional y Oro.").ids,
      ["brou-recompensa", "brou-recompensa-gold", "brou-visa", "brou-visa-gold"],
    );
  });

  it("el instrumento de adelante vale para las marcas que siguen; el de atrás, solo para la suya", () => {
    assert.deepEqual(
      tarjetasDe("con tarjetas de crédito y débito VISA, BROU Recompensa Mastercard y MI BROU Tarjeta Joven.").ids,
      ordenar([...VISA_CREDITO, "brou-visa-debito", ...RECOMPENSA_CREDITO, "brou-recompensa-debito", "brou-mi-brou"]),
    );
    assert.deepEqual(
      tarjetasDe("con tarjetas BROU Recompensa Mastercard Crédito y tarjetas BROU Recompensa Mastercard Débito").ids,
      ordenar([...RECOMPENSA_CREDITO, "brou-recompensa-debito"]),
    );
    assert.deepEqual(tarjetasDe("con tus tarjetas de crédito BROU Recompensa Mastercard y VISA crédito.").ids, ordenar([...RECOMPENSA_CREDITO, ...VISA_CREDITO]));
  });

  it("\"débito Mastercard\" a secas son las dos de débito; \"Recompensa\", la del programa", () => {
    assert.deepEqual(tarjetasDe("con tarjetas de débito Mastercard.").ids, ["brou-mastercard-debito", "brou-recompensa-debito"]);
    assert.deepEqual(tarjetasDe("con tarjetas de débito BROU Recompensa Mastercard.").ids, ["brou-recompensa-debito"]);
  });

  it("PYME y corporativas no están en el catálogo; la VISA Black no existe; la VISA Infinite va a revisión", () => {
    const pyme = tarjetasDe("con Tarjetas de Crédito BROU Recompensa Mastercard, y Tarjetas de Crédito BROU PYME Mastercard y BROU PYME Mastercard Platinum.");
    assert.deepEqual(pyme.ids, RECOMPENSA_CREDITO);
    assert.equal(tarjetasDe("para Tarjeta de Débito Corporativa y Tarjetas de Crédito BROU PYME Mastercard").soloEmpresas, true);
    assert.deepEqual(tarjetasDe("con tarjetas de crédito BROU VISA Platinum y Black").desconocidos, []);
    assert.deepEqual(tarjetasDe("y BROU VISA Platino e Infinite").desconocidos, ["visa credito infinite"]);
  });

  it("\"todas las tarjetas\" y \"medios de pago de Tu Banco\" no nombran ninguna", () => {
    const t = tarjetasDe("con todas las tarjetas de crédito y débito del Banco República en GR Joyeros.");
    assert.deepEqual([t.ids, t.nombra, t.generica], [[], false, true]);
    assert.equal(tarjetasDe("con los medios de pago de Tu Banco").generica, true);
  });
});

describe("parser de BROU", () => {
  it("niveles en líneas separadas: cada tarjeta en su mejor porcentaje", () => {
    const e = normalizarBrou(
      crudo("cuatroases", {
        nombre: "Cuatroases",
        valores: ["25 % DTO", "15 % DTO"],
        resumen: "Disfrutá de los descuentos que te ofrece Tu Banco en Cuatroases pagando con los Medios de Pago seleccionados",
        vigencia: "28/02/2027",
        descripcion: [
          "Aprovechá los siguientes beneficios que te ofrecen los Medios de Pago seleccionados de Tu Banco:",
          "25% de descuento abonando con tarjetas de crédito BROU VISA Platino y BROU Recompensa Mastercard Platino y Black.",
          "15% de descuento abonando con tarjetas de crédito y débito VISA, BROU Recompensa Mastercard y MI BROU Tarjeta Joven.",
          "10% de descuento abonando con tarjetas de débito Mastercard.",
        ],
        condiciones: ["Vigencia hasta el 28/2/27", "El descuento aplica en el punto de venta al momento de la compra.", "Excepciones: No aplica a productos corporativos."],
        categoria: "Moda",
      }),
    );
    assert.deepEqual(e.comercio, { key: "cuatroases", nombre: "Cuatroases", categoria: "indumentaria" });
    assert.deepEqual(
      e.beneficios.map((b) => [b.porcentaje, b.productos_elegibles]),
      [
        [25, ["brou-recompensa-black", "brou-recompensa-platinum", "brou-visa-platinum"]],
        [15, ["brou-mi-brou", "brou-recompensa", "brou-recompensa-debito", "brou-recompensa-gold", "brou-visa", "brou-visa-debito", "brou-visa-gold"]],
        [10, ["brou-mastercard-debito"]],
      ],
    );
    for (const b of e.beneficios) {
      assert.equal(b.vigencia_hasta, "2027-02-28");
      assert.equal(b.canal, "presencial");
    }
  });

  it("2x1 de cine: el tramo en una línea y las tarjetas en las siguientes", () => {
    const e = normalizarBrou(
      crudo("cine-sarandi-salto", {
        nombre: "Cine Sarandí Salto",
        valores: [],
        resumen: "2x1 en tus entradas con los Medios de Pago seleccionados de Tu Banco.",
        vigencia: "31/05/2027",
        descripcion: [
          "Aprovechá 2x1 en entradas pagando con:",
          "Tarjetas de Crédito VISA y BROU Recompensa Mastercard.",
          "Tarjetas de Débito VISA, BROU Recompensa Mastercard y MI BROU Tarjeta Joven.",
        ],
        condiciones: ["El beneficio no tiene tope de entradas.", "Excepciones: No aplica a productos corporativos."],
      }),
    );
    assert.equal(e.beneficios.length, 1);
    const [b] = e.beneficios;
    assert.equal(b!.tipo, "2x1");
    assert.equal(b!.titulo, "2x1 en entradas");
    assert.deepEqual(b!.productos_elegibles, ordenar([...VISA_CREDITO, ...RECOMPENSA_CREDITO, "brou-visa-debito", "brou-recompensa-debito", "brou-mi-brou"]));
    assert.equal(b!.vigencia_hasta, "2027-05-31");
  });

  it("SODRE: cada tramo con el tope de sus tarjetas", () => {
    const e = normalizarBrou(
      crudo("beneficio-sodre", {
        nombre: "SODRE",
        valores: ["50 % DTO", "20 % DTO"],
        resumen: "Disfrutá de hasta un 50% de descuento en todas las obras de Los Cuerpos Estables del SODRE",
        vigencia: "28/02/2027",
        descripcion: [
          "50% de dto. con las tarjetas de crédito BROU Recompensa Mastercard Platino y Black, y BROU VISA Platino e Infinite.",
          "20% de dto. con las tarjetas de crédito y débito BROU VISA y BROU Recompensa Mastercard.",
        ],
        condiciones: [
          "Tope del descuento tarjetas de crédito y débito VISA, BROU Recompensa Mastercard: $ 1.000 por cuenta y por mes.",
          "Tope del descuento tarjetas de crédito BROU Recompensa Mastercard Platino y Black, y BROU VISA Platino e Infinite: $ 4.000 por cuenta y por mes.",
          "Vigencia: 01/03/2026 al 28/02/2027.",
        ],
      }),
    );
    assert.deepEqual(
      e.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_periodo]),
      [
        [50, 4000, "mes"],
        [20, 1000, "mes"],
      ],
    );
    assert.deepEqual([e.beneficios[0]!.vigencia_desde, e.beneficios[0]!.vigencia_hasta], ["2026-03-01", "2027-02-28"]);
    assert.deepEqual(e.productos_desconocidos, ["visa credito infinite"]);
  });

  it("Recompensa en farmacias: días, tope mensual y sin las PYME", () => {
    const e = normalizarBrou(
      crudo("farmacias", {
        nombre: "Farmacias",
        valores: ["10 % DTO"],
        resumen: "10% de descuento en Farmacias con BROU",
        vigencia: "30/04/2027",
        descripcion: [
          "La promoción comprende un 10% de descuento en el rubro FARMACIAS todos los miércoles, sábados y domingos abonando con Tarjetas de Crédito BROU Recompensa Mastercard, y Tarjetas de Crédito BROU PYME Mastercard y BROU PYME Mastercard Platinum.",
        ],
        condiciones: [
          "Tope de devolución mensual por cuenta: FARMACIAS: $ 1000 (Mil Pesos Uruguayos).",
          "Promoción valida desde el 01/07/2022 hasta el 30/04/2027 para compras realizadas en la República Oriental del Uruguay abonadas con Tarjetas de Crédito BROU Recompensa Mastercard.",
        ],
      }),
    );
    const [b] = e.beneficios;
    assert.deepEqual(b!.dias_semana, [3, 6, 0]);
    assert.deepEqual(b!.productos_elegibles, RECOMPENSA_CREDITO);
    assert.deepEqual([b!.tope_monto, b!.tope_periodo], [1000, "mes"]);
    assert.equal(b!.vigencia_hasta, "2027-04-30");
  });

  it("dos porcentajes sobre cosas distintas no se pisan", () => {
    const e = normalizarBrou(
      crudo("clinicadelasonrisa-salud", {
        nombre: "Clínica de la Sonrisa",
        valores: ["20 % DTO", "15 % DTO"],
        resumen: "20% y 15% de descuento con tarjetas seleccionadas del Banco República",
        vigencia: null,
        descripcion: [
          "Abonando con las tarjetas de crédito y débito VISA y Mastercard del Banco República obtenés los siguientes beneficios:",
          "20% de descuento en las entregas iniciales de los tratamientos sobre implantes, ortodoncia, estética dental y profilaxis.",
          "15% de descuento en el resto de los tratamientos que no incluyan laboratorio.",
        ],
        condiciones: ["Beneficios sujetos a vigencia del convenio."],
      }),
    );
    assert.deepEqual(e.beneficios.map((b) => b.porcentaje), [20, 15]);
    assert.deepEqual(e.beneficios[0]!.productos_elegibles, e.beneficios[1]!.productos_elegibles);
    assert.ok(e.beneficios[1]!.productos_elegibles.includes("brou-mastercard-debito"));
  });

  it("\"todas las tarjetas\": vale con cualquiera", () => {
    const e = normalizarBrou(
      crudo("moda-joyeros-gr", {
        nombre: "GR Joyeros",
        valores: ["15 % DTO"],
        resumen: "15% de descuento con todas las tarjetas del Banco República.",
        vigencia: null,
        descripcion: ["Obtené un 15% de descuento con todas las tarjetas de crédito y débito del Banco República en GR Joyeros."],
        condiciones: ["Sin tope de descuento en tus compras.", "Aplicación del descuento: en el punto de venta presencial (no web)."],
      }),
    );
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.productos_elegibles, b.canal]), [[15, [], "presencial"]]);
  });

  it("solo para tarjetas PYME: no es un beneficio del catálogo", () => {
    const e = normalizarBrou(
      crudo("adobe-pymes", {
        nombre: "ADOBE PYMES",
        valores: ["14 % DTO"],
        resumen: "¡Obtené un 14% de descuento en la facturación anual de Adobe!",
        vigencia: "30/04/2027",
        descripcion: ["Obtené un 14% de descuento en la facturación anual de Adobe en herramientas de diseño, distribución y administración de archivos PDF."],
        condiciones: ["Beneficios exclusivos para Tarjeta de Débito Corporativa y Tarjetas de Crédito BROU PYME Mastercard y BROU PYME Mastercard Platinum."],
      }),
    );
    assert.equal(e.es_beneficio, false);
  });

  it("lo que depende de ser socio queda pendiente", () => {
    assert.throws(
      () =>
        normalizarBrou(
          crudo("espacio-mascota", {
            nombre: "Espacio Mascota",
            valores: ["10 % DTO", "5 % DTO"],
            resumen: "Aprovechá los siguientes descuentos en Espacio Mascota",
            vigencia: "30/11/2026",
            descripcion: [
              "Aprovechá un 10% de descuento en los puntos de venta, una promoción válida exclusivamente para aquellos clientes NO SOCIOS que abonen con tarjetas de crédito y débito VISA, BROU Recompensa Mastercard y MI BROU Tarjeta Joven.",
              "Además aprovechá un 5% de descuento adicional para clientes SOCIOS de la tienda que ya perciben un 10% de descuento y que abonen con tarjetas de crédito y débito VISA, BROU Recompensa Mastercard y MI BROU.",
            ],
            condiciones: [],
          }),
        ),
      PaginaPendiente,
    );
  });

  it("un badge que no aparece en el texto deja la página pendiente", () => {
    assert.throws(
      () =>
        normalizarBrou(
          crudo("x", {
            nombre: "X",
            valores: ["30 % DTO"],
            resumen: "Descuentos con tarjetas BROU",
            vigencia: null,
            descripcion: ["20% de descuento con tarjetas de crédito VISA."],
            condiciones: [],
          }),
        ),
      PaginaPendiente,
    );
  });

  it("sin badges ni tramos no es un beneficio", () => {
    const e = normalizarBrou(
      crudo("multipagos-ebrou", { nombre: "Multipagos eBROU", valores: [], resumen: "Multipagos eBROU", vigencia: null, descripcion: ["Conocé los beneficios que tiene multipagos eBROU:"], condiciones: [] }),
    );
    assert.equal(e.es_beneficio, false);
  });
});

describe("comercio y ficha de BROU", () => {
  it("el nombre sin lo que es de la campaña", () => {
    assert.equal(comercioDe("Beneficios en Cifer"), "Cifer");
    assert.equal(comercioDe("Beneficio AUF"), "AUF");
    assert.equal(comercioDe("Semana BROU en DISTRICOMP"), "DISTRICOMP");
    assert.equal(comercioDe("ADOBE PYMES"), "ADOBE");
    assert.equal(comercioDe("Aprendé inglés en Executive"), "Executive");
    assert.equal(comercioDe("Beneficios de Invierno"), "Beneficios de Invierno");
  });

  it("lee los campos de la ficha", () => {
    const html = `<section id="beneficio-detail"><ol class="breadcrumb"><li><a href="//beneficios.brou.com.uy/">Inicio</a></li>
      <li><a href="//beneficios.brou.com.uy/moda">Moda</a></li><li class="active">La Dolfina</li></ol>
      <h1>La Dolfina </h1><div class="descuento"><h2>25 <small class="porcentaje">%</small><small class="descuento_txt">DTO</small> </h2>
      <h2>15 <small class="porcentaje">%</small><small class="descuento_txt">DTO</small> </h2></div>
      <h3>Disfrutá de los descuentos</h3><div class="info-beneficio"><div class="col-12"><p>Vigencia:
        28/02/2027                  </p></div></div>
      <div class="col-12 mb-5"><h3><b>Aprovechá:</b></h3><ul><li><strong>25% de descuento</strong> con tarjetas de crédito BROU VISA Platinum.</li></ul></div>
      <!-- CONDICIONES --><div class="accordion-body"><ul><li>Vigencia hasta el 28/02/2027</li><li>Excepciones: No aplica a productos corporativos.</li></ul></div></div></div>
      </section><section class="cont-relacionados"></section>`;
    assert.deepEqual(datosDeFicha(html), {
      nombre: "La Dolfina",
      valores: ["25 % DTO", "15 % DTO"],
      resumen: "Disfrutá de los descuentos",
      vigencia: "28/02/2027",
      descripcion: ["Aprovechá:", "25% de descuento con tarjetas de crédito BROU VISA Platinum."],
      condiciones: ["Vigencia hasta el 28/02/2027", "Excepciones: No aplica a productos corporativos."],
      categoria: "Moda",
    });
  });
});
