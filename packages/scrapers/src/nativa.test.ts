// Nativa (red Cabal): tarjetas de rubro o de listado, combustible de frontera,
// CAUTE y planes de "última cuota gratis". Texto real recortado del sitio.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crudoDeTarjeta, normalizarNativa, tarjetasDelIndice } from "./fuentes/nativa.js";
import type { Crudo } from "./tipos.js";

function crudo(external_id: string, lineas: string[], url = `https://www.nativacabal.com.uy/services/${external_id}/`): Crudo {
  return { fuente_id: "nativa", external_id, url_fuente: url, contenido: lineas.join("\n"), fetched_at: "" };
}

const resumen = (c: Crudo) => {
  const e = normalizarNativa(c);
  return {
    comercio: e.comercio?.key ?? null,
    es_beneficio: e.es_beneficio,
    tramos: e.beneficios.map((b) => [b.comercio_key, b.titulo, b.porcentaje, b.cuotas, b.tope_monto, b.tope_periodo]),
  };
};

describe("Nativa", () => {
  it("una tarjeta de rubro entero va al comercio canónico", () => {
    const cine = crudo("cine", [
      "Cine", "Promoción: 50 % DESCUENTO", "Tipo según Nativa: descuentos-y-promos.", "Entradas, pop y refresco.", "Detalles:",
      "Vas a ver", "Cine con 50% de descuento", "Podés concurrir a cualquier cine adherido a Cabal.",
      "El tope máximo de descuento diario por cuenta es de $ 800.", "El tope máximo de descuento mensual por cuenta es de $ 1500.",
    ]);
    assert.deepEqual(resumen(cine).tramos, [["todo-cines-teatros", "50% de descuento", 50, null, 800, "dia"]]);

    const transporte = crudo("transporte", [
      "Transporte", "Promoción: 6 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "Comprá tu cuponera o pasaje en cuotas.", "Detalles:",
      "Planes de pago sin recargo: de 2 a 6 cuotas.", "Planes de pago con recargo: 12, 15, 18, 20 y 24 cuotas.",
      "LISTADO DE EMPRESAS DEL TRANSPORTE EN HASTA 6 CUOTAS S/R", "AGENCIA CENTRAL", "C.U.T LTDA",
    ]);
    assert.deepEqual(resumen(transporte).tramos, [["todo-pasajes", "6 cuotas sin recargo", null, 6, null, null]]);

    const supers = crudo("tus-supers-3-cuotas", [
      "Tus supermercados", "Promoción: 3 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "3 cuotas sin recargo en comestibles y limpieza.", "Detalles:",
      "Tienda Inglesa y supermercados del grupo TI", "Ta-Ta", "Comprá en Ta-Ta en 3 cuotas sin recargo", "El Dorado", "Frigo", "Kinko",
    ]);
    assert.equal(resumen(supers).comercio, "todo-supermercados");

    const farmacias = crudo("farmacias", [
      "Farmacias y perfumerías", "Promoción: 6 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "6 cuotas sin recargo.", "Detalles:",
      "Todas las farmacias y perfumerías del país hasta en 6 cuotas sin recargo.",
    ]);
    assert.equal(resumen(farmacias).comercio, "todo-farmacias");
  });

  it("el número de la tarjeta manda sobre el \"hasta en 12\" de plantilla de la ficha", () => {
    const jugueterias = crudo("jugueterias-y-librerias", [
      "Jugueterías y librerías", "Promoción: 6 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "Válido para comercios de todo el país!", "Detalles:",
      "Jugueterías y librerías en 6 cuotas sin recargo", "Promoción válida con tu tarjeta Nativa, hasta en 12 cuotas sin recargo.",
      "LISTADO DE EMPRESAS DE JUGUETERÍAS Y LIBRERÍAS HASTA 6 CUOTAS S/R",
    ]);
    assert.deepEqual(resumen(jugueterias).tramos, [["todo-librerias", "6 cuotas sin recargo", null, 6, null, null]]);

    // "50% + 6 CUOTAS": el 50 no es un plan de cuotas.
    const implante = crudo("dr-implante", [
      "Dr. Implante", "Promoción: 50% + 6 CUOTAS", "Tipo según Nativa: acuerdos-nativa, cuotas-sin-recargo, descuentos-y-promos.",
      "Un conjunto de prestaciones para cubrir a toda la familia.", "Detalles:", "Teniendo la posibilidad de pagar hasta en 6 cuotas sin recargo.",
    ]);
    assert.deepEqual(resumen(implante).tramos.map((t) => t.slice(1, 4)), [["50% de descuento", 50, null], ["6 cuotas sin recargo", null, 6]]);
  });

  it("los rubros sin comercio canónico y los listados no se publican", () => {
    const zapaterias = crudo("zapaterias", [
      "Zapaterías", "Promoción: 6 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "Hasta en 6 cuotas sin recargo.", "Detalles:",
      "Promoción válida con tu tarjeta Nativa, 3, 6 y hasta 12 cuotas sin recargo en zapaterías.", "Comercios adheridos en todo el país:",
    ]);
    const marcas = crudo("12-cuotas", [
      "12 cuotas", "Promoción: 12 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "Las mejores marcas en 12 cuotas sin recargo.", "Detalles:",
      "Comercios adheridos:", "VESTIMENTA", "Allie", "Zara", "OTROS", "Farmashop", "ZonaTecno",
    ]);
    const promo121 = crudo("beneficios", [
      "Promo 12-1", "Promoción: 24 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo, descuentos-y-promos.", "En todo el país, la última cuota es gratis!", "Detalles:",
      "Comprá en cuotas y llevate la última de regalo.", "6 CUOTAS", "Renner",
    ], "https://www.nativacabal.com.uy/beneficios/#f=.ultima-cuota-gratis");
    const facturas = crudo("pago-por-servicios", [
      "Pago de Facturas de Servicios", "Promoción: 3 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.",
      "Públicos y privados en redes de cobranza hasta en 3 cuotas sin recargo.", "Detalles:",
    ], "https://www.nativacabal.com.uy/pago-por-servicios/");
    for (const c of [zapaterias, marcas, promo121, facturas]) {
      assert.deepEqual(resumen(c), { comercio: null, es_beneficio: false, tramos: [] }, c.external_id);
    }
  });

  it("\"Buenos Aires\" es de Buquebus, no un comercio con ese nombre", () => {
    const bsas = crudo("bs-as", [
      "Buenos Aires", "Promoción: 12 CUOTAS", "Tipo según Nativa: cuotas-sin-recargo.", "En cuotas sin recargo.", "Detalles:",
      "Buquebus y Colonia Express", "Promoción válida con tu tarjeta Nativa, hasta en 12 cuotas sin recargo.",
    ]);
    assert.deepEqual(resumen(bsas).tramos, [["buquebus", "12 cuotas sin recargo", null, 12, null, null]]);
  });

  it("combustible de frontera: no es un descuento en todas las estaciones, y la fuente es el índice", () => {
    const html = `<article id="post-9823" class="matchHeight post-9823 services services-tipo-descuentos-y-promos">
      <div class="promo-beneficio porcentaje">24<span class="sufijo">%</span><span class="small">DESCUENTO</span></div><h5 class="header">
	<a href="https://www.cabal.com.uy/combustible-sin-recargo/#new_tab">
		Combustible		</a>
</h5>
<div class="promo-descripcion cut">Combustible de Frontera. Combustible con devolución de IMESI.</div></article>`;
    const [t] = tarjetasDelIndice(html);
    const c = crudoDeTarjeta(t!, null);
    assert.equal(c.external_id, "combustible-sin-recargo");
    assert.equal(c.url_fuente, "https://www.nativacabal.com.uy/beneficios/");
    assert.deepEqual(resumen(c), { comercio: null, es_beneficio: false, tramos: [] });
  });

  it("CAUTE: 50% en la cuota de los 3 primeros meses, y el tope de $1.200 es de la promo 12+1", () => {
    const caute = crudo("caute", [
      "CAUTE", "Promoción: 50 % DESCUENTO", "Tipo según Nativa: acuerdos-nativa, descuentos-y-promos.", "Sé socio de Caute / 3 meses al 50%", "Detalles:",
      "Para los clientes de Tarjeta Nativa que se afilien a las prestaciones de CauteAntel, se establece un beneficio promocional en los primeros 3 meses del 50% de descuento en la cuota por una afiliación inicial de 2 años.",
      "Cuota mensual vigente 2022 $ 665 por persona. Los primeros tres meses $ 333.",
      "Farmacia asistencial con 5 franjas de tickets de medicamentos.",
      "La última cuota no la pagás!", "La promo 12-1 en CauteAntel con tu Nativa.", "La última cuota la regala Nativa.",
      "La promo esta vigente para el plan 12 cuotas sin recargo con tu Nativa tanto para pesos y dólares. Tope bonificación por cuenta $1200.",
    ]);
    const e = normalizarNativa(caute);
    assert.equal(e.comercio?.categoria, "salud-belleza");
    assert.deepEqual(resumen(caute).tramos, [
      ["caute", "50% en la cuota de los primeros 3 meses", 50, null, null, null],
      ["caute", "Última cuota gratis", 8.3, null, 1200, "beneficio"],
    ]);
  });

  it("última cuota gratis: el plan más largo de la ficha, aunque los liste con \"o\"", () => {
    const cabreras = crudo("cabreras-motos", [
      "Cabrera’s Motos", "Promoción: 24 CUOTAS", "Tipo según Nativa: ultima-cuota-gratis.", "En Colonia y San José ¡La última cuota es gratis!", "Detalles:",
      "El descuento se realizará en el estado de cuenta y se aplicará hasta un tope máximo de descuento de promociones de $2,500 contabilizados para cada última cuota de los planes especificados.",
      "Los descuentos se otorgarán para compras realizadas únicamente en los planes 12, 15, 18 o 24 cuotas PESOS y en los planes 12,15,18 cuotas DÓLARES , siendo bonificada la última de cada plan.",
    ]);
    assert.deepEqual(resumen(cabreras).tramos, [["cabrera-s-motos", "Última cuota gratis", 4.2, null, 2500, "compra"]]);

    const bethel = crudo("bethel-spa", [
      "Bethel Spa", "Promoción: 12 CUOTAS", "Tipo según Nativa: ultima-cuota-gratis.", "Cuidate en el mejor lugar. ¡La última cuota de tu plan es gratis!", "Detalles:",
      "Válido para el plan: 12 cuotas SIN RECARGO.", "Tope de descuento en la última cuota: $ 1.000",
    ]);
    assert.deepEqual(resumen(bethel).tramos, [["bethel-spa", "Última cuota gratis", 8.3, null, 1000, "compra"]]);
  });

  it("porcentaje con decimales: \"17,5 %\" no es 5%", () => {
    const stm = crudo("stm-nativa", [
      "STM", "Promoción: 17,5 % DESCUENTO", "Tipo según Nativa: descuentos-y-promos.", "Pagá tus boletos con descuento en tu próximo estado de cuenta.", "Detalles:",
      "Usa tu tarjeta STM con Nativa",
    ], "https://www.nativacabal.com.uy/stm-nativa/");
    assert.deepEqual(resumen(stm).tramos, [["stm", "17,5% de descuento", 17.5, null, null, null]]);
  });
});
