// Tarjetas de marca de BBVA en el parser: clubes (Peñarol, Nacional), Abtour,
// Consolid, Comunidad Plus y Sodimac. Frases tomadas de las fichas reales.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS } from "@tarjetazo/core";
import { comercioDeLaFicha, diasDeLaPromo, normalizarBbva, productos, topes, topesDeClub } from "./fuentes/bbva-parser.js";

const ids = (frase: string) => productos(frase).ids.sort();
const ACTIVOS = new Set(PRODUCTOS.filter((p) => p.activo !== false).map((p) => p.id));

describe("parser de BBVA: tarjetas de marca", () => {
  it("Peñarol con niveles nombrados", () => {
    assert.deepEqual(ids("Tarjetas de Crédito Internacionales, Oro y Platinum BBVA Club Atlético Peñarol"), [
      "bbva-penarol-internacional", "bbva-penarol-oro", "bbva-penarol-platinum",
    ]);
  });

  it("Peñarol sin nivel: los tres", () => {
    assert.deepEqual(ids("Tarjetas de crédito BBVA Club Atlético Peñarol"), [
      "bbva-penarol-internacional", "bbva-penarol-oro", "bbva-penarol-platinum",
    ]);
  });

  it("Nacional: solo los niveles que nombra", () => {
    assert.deepEqual(ids("Tarjetas de Crédito Internacional, Oro BBVA Club Nacional de Football"), [
      "bbva-nacional-internacional", "bbva-nacional-oro",
    ]);
    assert.deepEqual(ids("Tarjetas de Crédito Platinum BBVA Club Nacional de Football"), ["bbva-nacional-platinum"]);
  });

  it("'Internacional' no es el Club Nacional", () => {
    const r = ids("Tarjetas de Crédito Internacional, Oro, Pymes y Corporativas");
    assert.ok(!r.some((id) => id.startsWith("bbva-nacional")));
    assert.deepEqual(r, ["bbva-credito", "bbva-mastercard-internacional", "bbva-mastercard-oro", "bbva-oro"]);
  });

  it("Abtour: la Visa y la Mastercard", () => {
    for (const frase of ["la tarjeta de crédito BBVA Abtour.", "la Tarjeta de Crédito Abtour."]) {
      assert.deepEqual(ids(frase), ["bbva-abtour-mastercard", "bbva-abtour-visa"]);
    }
  });

  it("los niveles de una tarjeta de marca no suman las genéricas", () => {
    assert.deepEqual(ids("Tarjetas de Crédito BBVA Comunidad Plus Internacional, Oro e Infinite."), ["bbva-comunidad-plus"]);
    assert.deepEqual(ids("Tarjetas de Crédito BBVA Sodimac"), ["bbva-sodimac"]);
  });

  it("todo lo que devuelve es un producto activo del catálogo", () => {
    const frases = [
      "Tarjetas de crédito BBVA Club Atlético Peñarol",
      "Tarjetas de Crédito Internacionales, Oro y Platinum BBVA Club Nacional de Football",
      "la tarjeta de crédito BBVA Abtour.",
      "la tarjeta de crédito BBVA Consolid Travel.",
      "Tarjetas de Crédito BBVA Comunidad Plus Internacional, Oro e Infinite.",
      "Tarjetas de Crédito BBVA Sodimac",
      "Tarjetas de Crédito BBVA",
      "Tarjetas de Débito",
    ];
    for (const f of frases) for (const id of productos(f).ids) assert.ok(ACTIVOS.has(id), `${f} → ${id}`);
  });
});

describe("parser de BBVA: ficha de Nacional", () => {
  // Recorte de la ficha real vida-activa-nacional-cuota-y-butaca (2026-09-26).
  const contenido = [
    "Nacional - Descuento en cuota de socio y compra/renovación de butacas",
    "Vigencia: 31 de Diciembre 2026",
    "Descuento:",
    "10% Off en cuota de socio y compra/renovación de butacas con Tarjetas de Crédito Internacionales, Oro y Platinum BBVA Club Nacional de Football",
    "10% Off adicional para socios del Club Nacional de Football",
    "Por compras mayores a $800 pesos uruguayos realizadas con Tarjetas de Crédito Internacionales, Oro y Platinum BBVA Club Nacional de Football, aportas $12 pesos uruguayos al club.",
    "",
    "Legales:",
    "Promoción válida del 1 de enero de 2026 al 31 de diciembre de 2026 para clientes de tarjetas de crédito BBVA Club Nacional de Football Máster Card.",
    "Se verá reflejado en el estado de cuenta en un plazo máximo de 30 días y el tope de devolución será de $3.700 pesos uruguayos para tarjetas Internacionales, $5.000 pesos uruguayos para tarjetas Oro y $6.300 pesos uruguayos para tarjetas Platinum, por cierre de estado de cuenta.",
    "El 10% adicional para socios se aplicará en el punto de venta sin tope de devolución.",
    "",
    "Rubro según BBVA: vida-activa.",
  ].join("\n");

  it("solo las tarjetas del club, un tramo por tope", () => {
    const r = normalizarBbva({
      fuente_id: "bbva", external_id: "vida-activa-nacional-cuota-y-butaca", url_fuente: "https://www.bbva.com.uy/x",
      contenido, fetched_at: "2026-09-26T00:00:00Z",
    });
    assert.deepEqual(r.beneficios.map((b) => b.titulo), [
      "10% de descuento en cuota de socio y compra/renovación de butacas con Internacional",
      "10% de descuento en cuota de socio y compra/renovación de butacas con Oro",
      "10% de descuento en cuota de socio y compra/renovación de butacas con Platinum",
    ]);
    // El comercio es el club, no la promo.
    assert.deepEqual(r.comercio && [r.comercio.key, r.comercio.nombre], ["club-nacional-de-football", "Club Nacional de Football"]);
    assert.ok(r.beneficios.every((b) => b.comercio_key === "club-nacional-de-football"));
    assert.deepEqual(
      r.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_periodo, [...b.productos_elegibles]]),
      [
        [10, 3700, "mes", ["bbva-nacional-internacional"]],
        [10, 5000, "mes", ["bbva-nacional-oro"]],
        [10, 6300, "mes", ["bbva-nacional-platinum"]],
      ],
    );
  });
});

describe("parser de BBVA: topes de los clubes", () => {
  it("uno por nivel, con y sin 'pesos'", () => {
    assert.deepEqual(
      [...topesDeClub("El tope de devolución será compartido para cuota social, abonos de básquet y estacionamiento, siendo de $1.500 para Tarjetas Internacionales, $2.000 para Tarjetas Oro y $2.500 para Tarjetas Platinum.")],
      [["internacional", 1500], ["oro", 2000], ["platinum", 2500]],
    );
  });

  it("el mismo para los tres niveles", () => {
    assert.deepEqual(
      [...topesDeClub("El descuento se aplicará en el estado de cuenta en un plazo máximo de 30 días y el tope de devolución será de $1.000 pesos uruguayos para tarjetas internacionales, Oro y Platinum, por cierre de estado de cuenta.")],
      [["internacional", 1000], ["oro", 1000], ["platinum", 1000]],
    );
  });

  it("sin topes por nivel, nada", () => {
    assert.equal(topesDeClub("el tope de devolución será de 4000 pesos uruguayos por cierre de estado de cuenta.").size, 0);
  });

  it("'Platinium' abre el grupo de las altas (ficha de 1900)", () => {
    const contenido = [
      "1900",
      "Vigencia: 30 de Junio 2027",
      "Descuento:",
      "20% Off con Tarjetas de Crédito Internacional, Oro BBVA Club Nacional de Football",
      "30% Off con Tarjetas de Crédito Platinum BBVA Club Nacional de Football",
      "",
      "Legales:",
      "TARJETAS DE CRÉDITO",
      "Tarjetas de crédito Internacionales, Oro.",
      "El descuento será de un 20%, se aplicará un 10% en el punto de venta, sin tope de devolución. El 10% restante se verá reflejado en el estado de cuenta, el tope de devolución será de 4000 pesos uruguayos por cierre de estado de cuenta.",
      "Tarjetas de crédito Platinium.",
      "El descuento será de un 30%, se aplicará un 15% en el punto de venta, sin tope de devolución. El 15% restante se verá reflejado en el estado de cuenta, el tope de devolución será de 6000 pesos uruguayos por cierre de estado de cuenta.",
      "",
      "Rubro según BBVA: gastronomia.",
    ].join("\n");
    const r = normalizarBbva({ fuente_id: "bbva", external_id: "gastronomia-1900", url_fuente: "https://x", contenido, fetched_at: "" });
    assert.deepEqual(r.beneficios.map((b) => [b.porcentaje, b.tope_monto]), [[20, 4000], [30, 6000]]);
  });
});

describe("parser de BBVA: topes con otra redacción", () => {
  it("'con un tope de devolución de N pesos' bajo un encabezado", () => {
    const t = topes([
      "TARJETAS DE DÉBITO",
      "El descuento será de un 20%, el cual se verá reflejado en el estado de cuenta, con un tope de devolución de 4000 pesos uruguayos por cierre de estado de cuenta.",
      "Tarjetas de crédito Infinite, Platinum y Black",
      "El descuento será de un 30%, el cual se verá reflejado en el estado de cuenta, con un tope de devolución de 6000 pesos uruguayos por cierre de estado de cuenta.",
    ].join("\n"));
    assert.deepEqual(t.get("debito"), { monto: 4000, moneda: "UYU", periodo: "mes" });
    assert.deepEqual(t.get("alto"), { monto: 6000, moneda: "UYU", periodo: "mes" });
  });

  it("sin encabezados (Consolid): el tope general vale para el tramo", () => {
    const contenido = [
      "Consolid - Turismo internacional",
      "Vigencia: 31 de Diciembre 2026",
      "Descuento:",
      "Martes y Jueves 10% Off con la tarjeta de crédito BBVA Consolid Travel.",
      "",
      "Legales:",
      "El descuento será de un 10%, el cual se verá reflejado en el estado de cuenta, con un tope de devolución de 6000 pesos uruguayos por cierre de estado de cuenta. El descuento se verá reflejado en un plazo máximo de 30 días.",
      "",
      "Rubro según BBVA: viajes.",
    ].join("\n");
    const r = normalizarBbva({ fuente_id: "bbva", external_id: "viajes-consolid-turismo-internacional", url_fuente: "https://x", contenido, fetched_at: "" });
    assert.deepEqual(r.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_periodo, b.tope_moneda]), [[10, 6000, "mes", "UYU"]]);
  });

  it("'tope de devolución 2.000 pesos' sin 'de'", () => {
    assert.equal(topes("Se aplicará un 10% en el punto de venta, con tope de devolución 2.000 pesos uruguayos por mes.").get("general")?.monto, 2000);
  });

  it("el general no pisa el tope de un grupo", () => {
    const t = topes([
      "El tope de devolución será de 9000 pesos uruguayos.",
      "TARJETAS DE DÉBITO",
      "El descuento será de un 20%, con un tope de devolución de 1500 pesos uruguayos.",
    ].join("\n"));
    assert.equal(t.get("general")?.monto, 9000);
    assert.equal(t.get("debito")?.monto, 1500);
  });
});

describe("parser de BBVA: topes en dólares", () => {
  it("Consolid primera compra: USD 100 por única vez", () => {
    // Recorte de la ficha real viajes-consolid (pagina_cruda, 2026-09-27).
    const contenido = [
      "Consolid",
      "Vigencia: 28 de Febrero 2027",
      "Descuento:",
      "10% Off en primera compra con la tarjeta de crédito BBVA Consolid Travel.*",
      "",
      "Legales:",
      "Promoción válida del 06 de abril de 2026 al 28 de febrero de 2027.",
      "El descuento será de un 10%, el cual se verá reflejado en el estado de cuenta. Tope de descuento por cuenta de tarjeta de crédito por primera compra por única vez para tarjetas Consolid sera de USD100 dolares americanos. El descuento realizado se verá reflejado en un plazo máximo de 30 días.",
      "",
      "Rubro según BBVA: viajes.",
    ].join("\n");
    const r = normalizarBbva({ fuente_id: "bbva", external_id: "viajes-consolid", url_fuente: "https://x", contenido, fetched_at: "" });
    assert.deepEqual(
      r.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_moneda, b.tope_periodo]),
      [[10, 100, "USD", "beneficio"]],
    );
  });

  it("reconoce USD100, USD 100, U$S 100 y US$ 100", () => {
    for (const monto of ["USD100", "USD 100", "U$S 100", "US$ 100", "usd 100"]) {
      assert.deepEqual(
        topes(`El tope de devolución será de ${monto} por cierre de estado de cuenta.`).get("general"),
        { monto: 100, moneda: "USD", periodo: "mes" },
        monto,
      );
    }
  });

  it("miles con punto y período por día", () => {
    assert.deepEqual(
      topes("Tope de descuento: U$S 1.000 por tarjeta, por día.").get("general"),
      { monto: 1000, moneda: "USD", periodo: "dia" },
    );
  });

  it("un monto en dólares de otra oración no es el tope", () => {
    assert.equal(topes("Sin tope de devolución. Compras mayores a USD 50 participan del sorteo.").size, 0);
  });

  it("los topes en pesos siguen igual", () => {
    assert.deepEqual(
      topes("el tope de devolución será de 4000 pesos uruguayos por cierre de estado de cuenta.").get("general"),
      { monto: 4000, moneda: "UYU", periodo: "mes" },
    );
  });
});

const ficha = (external_id: string, lineas: string[]) =>
  normalizarBbva({ fuente_id: "bbva", external_id, url_fuente: "https://x", contenido: lineas.join("\n"), fetched_at: "" });

describe("parser de BBVA: promos de un día", () => {
  // Recortes de las fichas reales (pagina_cruda, 2026-10-03).
  it("'Miércoles 25% en BAS': el comercio es BAS y vale los miércoles", () => {
    const r = ficha("moda-miercoles-25", [
      "Miércoles 25% en BAS",
      "Envíos a todo el país",
      "Vigencia: 31 de diciembre de 2026",
      "25% Off con Tarjetas de Crédito BBVA Comunidad Plus Internacional, Oro e Infinite",
      "El descuento aplica a las compras con Tarjetas de Crédito Comunidad Plus BBVA.",
      "",
      "Legales:",
      "Promoción válida los días miércoles hasta el 31 de diciembre de 2026 para clientes de Tarjeta de Crédito Comunidad Plus BBVA emitidas por BBVA Uruguay S.A..",
      "",
      "Rubro según BBVA: moda.",
    ]);
    assert.deepEqual(r.comercio && [r.comercio.key, r.comercio.nombre], ["bas", "BAS"]);
    assert.deepEqual(r.beneficios.map((b) => [b.comercio_key, b.porcentaje, b.dias_semana]), [["bas", 25, [3]]]);
  });

  it("'Miércoles de 10%': el comercio sale de la web (Ta-Ta)", () => {
    const r = ficha("hogar-y-decoracion-miercoles-10", [
      "Miércoles de 10%",
      "Envíos a todo el país",
      "Vigencia: 31 de diciembre de 2026",
      "10% Off con Tarjetas de Crédito BBVA Comunidad Plus Internacional, Oro e Infinite.",
      "Beneficio aplica en tata.com.uy únicamente en pagos online. No aplica sobre productos identificados como SHOP en tata.com.uy",
      "",
      "Legales:",
      "Promoción válida los días miércoles hasta el 31 de diciembre de 2026 para clientes de Tarjeta de Crédito Comunidad Plus BBVA emitidas por BBVA Uruguay S.A..",
      "",
      "Rubro según BBVA: hogar-y-decoracion.",
    ]);
    assert.equal(r.comercio?.key, "tata");
    assert.deepEqual(r.beneficios.map((b) => [b.comercio_key, b.dias_semana]), [["tata", [3]]]);
  });

  it("'Miércoles de Sodimac': Sodimac, los miércoles", () => {
    const r = ficha("hogar-y-decoracion-sodimac-miercoles-de-descuentos", [
      "Miércoles de Sodimac",
      "Vigencia: 30 de abril 2027",
      "Descuentos:",
      "10% Off con Tarjetas de Crédito BBVA Sodimac",
      "El descuento aplica a las compras con Tarjetas de Crédito BBVA Sodimac los días Miércoles en www.sodimac.com.uy y las cuatro tiendas Sodimac (Giannattasio, Sayago, Malvin y Maldonado).",
      "",
      "Legales:",
      "TARJETAS DE CRÉDITO BBVA SODIMAC",
      "El descuento aplicará a las compras realizadas los días Miércoles. El mismo será de un 10%, con un tope de devolución de 1000 pesos uruguayos por cierre de estado de cuenta, en el cual se verá reflejado en un plazo máximo de 30 días.",
      "",
      "Rubro según BBVA: hogar-y-decoracion.",
    ]);
    assert.equal(r.comercio?.key, "sodimac");
    assert.deepEqual(r.beneficios.map((b) => [b.comercio_key, b.dias_semana, b.tope_monto]), [["sodimac", [3], 1000]]);
  });

  it("encabezados que son solo días (Atlántico Trampoline Park)", () => {
    const r = ficha("experiencias-atlantico-trampoline-park", [
      "Atlántico Trampoline Park",
      "Descuento:",
      "Lunes a Viernes:",
      "30% Off con Tarjetas de Débito",
      "Sábados y Domingos:",
      "15% Off con Tarjetas de Débito",
      "",
      "Legales:",
      "Promoción válida del 01 de abril de 2026 al 30 de abril de 2027, para tarjetas de crédito y débito emitidas por BBVA Uruguay S.A.",
      "",
      "Rubro según BBVA: experiencias.",
    ]);
    assert.deepEqual(r.beneficios.map((b) => [b.porcentaje, b.dias_semana]), [[30, [1, 2, 3, 4, 5]], [15, [6, 0]]]);
  });

  it("horarios de atención y adicionales de un día no restringen la ficha", () => {
    // viajes-aquarella-hotel y cuidado-personal-farmacia-paris-notti.
    assert.deepEqual(diasDeLaPromo([
      "Aquarella Hotel",
      "15% Off en Tarifa publicada en temporada Baja. Para acceder al descuento, la reserva en el hotel deberá ser realizada telefónicamente al 0800-8757 de lunes a viernes de 9:00 a 18:00 hs, previo al alojamiento.",
    ].join("\n")), []);
    assert.deepEqual(diasDeLaPromo([
      "Farmacia París y Notti",
      "Descuentos todos los días de la semana:",
      "Descuento especial los días Martes",
      "El descuento será de un 20%, se aplicará un 10% en el punto de venta, sin tope de devolución. El 10% restante se verá reflejado en el estado de cuenta, el tope de devolución será de 2000 pesos uruguayos por cierre de estado de cuenta. El descuento realizado en el estado de cuenta se verá reflejado en un plazo máximo de 30 días.Los días martes se sumará un descuento especial que aplicará a las Tarjetas de Crédito del Centro de Farmacias del Uruguay.",
    ].join("\n")), []);
    // Una calle con nombre de día tampoco (gastronomia-grido).
    assert.deepEqual(diasDeLaPromo("Grido\nAv. José Belloni 4643 Esq. Domingo Arena."), []);
  });
});

describe("parser de BBVA: el comercio de la ficha", () => {
  it("promos para sacar la tarjeta: la marca (Abtour, Consolid)", () => {
    assert.deepEqual(comercioDeLaFicha([
      "Si aún no tenés la tarjeta, solicitala y sumá un 5% OFF en tu compra.",
      "Agencia de viajes en Montevideo",
      "5% Off en primera compra con la Tarjeta de Crédito Abtour.*",
      "Consultá todos los paquetes disponibles en www.abtour.com.uy o con un agente de viajes en Abtour Viajes.",
    ].join("\n")), { key: "abtour", nombre: "Abtour" });
    assert.deepEqual(comercioDeLaFicha([
      "Si aún no tenes la tarjeta, solicitala y sumá 10% off en tu compra",
      "Agencia de viajes",
      "10% Off en primera compra con la tarjeta de crédito BBVA Consolid Travel.*",
    ].join("\n")), { key: "consolid", nombre: "Consolid" });
  });

  it("clubes: el club, y la promo como detalle", () => {
    assert.deepEqual(comercioDeLaFicha("Peñarol - Descuento en compra y renovación de butacas"), {
      key: "club-atletico-penarol", nombre: "Club Atlético Peñarol", detalle: "compra y renovación de butacas",
    });
    assert.deepEqual(comercioDeLaFicha("Peñarol - Entradas de Campeonato Uruguayo"), {
      key: "club-atletico-penarol", nombre: "Club Atlético Peñarol", detalle: "Entradas de Campeonato Uruguayo",
    });
    assert.equal(comercioDeLaFicha("Nacional - Descuento en abonos de básquetbol").key, "club-nacional-de-football");
    // La tienda del club es otro comercio.
    assert.equal(comercioDeLaFicha("Tienda Oficial Club Nacional de Football").key, "tienda-oficial-club-nacional-de-football");
  });

  it("los nombres de siempre no cambian", () => {
    for (const [titulo, key] of [
      ["100% Artesanal", "100-artesanal"],
      ["Ta-ta", "ta-ta"],
      ["Alianza Cultural Uruguay - Estados Unidos", "alianza-cultural-uruguay-estados-unidos"],
      ["Sodimac Oportunidades Exclusivas", "sodimac-oportunidades-exclusivas"],
    ]) assert.equal(comercioDeLaFicha(`${titulo}\nwww.otro.com.uy`).key, key, titulo);
  });
});
