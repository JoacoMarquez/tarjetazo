// Parser de Scotiabank (sin modelo), con items reales del catálogo tal como
// los arma el fetch en `Crudo.datos` (bajados el 2026-09-28).
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS } from "@tarjetazo/core";
import {
  comercioDelTitulo,
  departamentosDe,
  diasDe,
  normalizarScotiabank,
  tarjetasDe,
  topesDelLegal,
  vigenciaDelLegal,
} from "./fuentes/scotiabank-parser.js";
import type { DatosScotiabank } from "./fuentes/scotiabank.js";
import type { Crudo } from "./tipos.js";

const INDICE = "https://www.scotiabank.com.uy/Personas/Tarjetas/Beneficios/default";

function crudo(external_id: string, datos: DatosScotiabank, url_fuente = INDICE): Crudo {
  return { fuente_id: "scotiabank", external_id, url_fuente, contenido: "", fetched_at: "2026-09-28T12:00:00.000Z", datos };
}

const TODAS = PRODUCTOS.filter((p) => p.fuente_id === "scotiabank" && p.activo !== false).map((p) => p.id).sort();
const CREDITO = PRODUCTOS.filter((p) => p.fuente_id === "scotiabank" && p.activo !== false && p.instrumento === "credito").map((p) => p.id).sort();
const PREMIUM = [
  "scotiabank-amex-copa-platinum", "scotiabank-amex-gold", "scotiabank-amex-platinum",
  "scotiabank-debito-premium", "scotiabank-visa-infinite", "scotiabank-visa-platinum",
];
const ordenados = (ids: string[]) => [...ids].sort();

describe("parser de Scotiabank: items reales", () => {
  it("porcentaje con tope de compra en USD: se pasa a devolución con cada porcentaje", () => {
    const e = normalizarScotiabank(crudo("las-espinas-2026-01-13", {
      titulo: "LAS ESPINAS",
      categoria: "restaurantes",
      descuentos: [
        { pct: "25% de ahorro", texto: "con tarjetas de Crédito Platinum, Infinite, Gold y Débito Premium" },
        { pct: "15% de ahorro", texto: "con tarjetas de Crédito y Débito." },
      ],
      dias: "Todos los días",
      departamento: "Maldonado",
      desde: "2026-01-13",
      hasta: "2030-12-23",
      legal: "Tope de compra para efectuar el descuento USD 2.000 o su equivalente en pesos.\nBeneficio exclusivo para tarjetas emitidas por Scotiabank Uruguay SA\nEl descuento se aplica en el momento de abonar la factura.",
    }));
    assert.deepEqual(e.comercio, { key: "las-espinas", nombre: "LAS ESPINAS", categoria: "restaurantes" });
    assert.equal(e.beneficios.length, 2);
    const [alto, general] = e.beneficios;
    assert.equal(alto!.titulo, "25% de descuento");
    assert.equal(alto!.descuento_raw, "25% de ahorro con tarjetas de Crédito Platinum, Infinite, Gold y Débito Premium");
    assert.deepEqual(ordenados(alto!.productos_elegibles), PREMIUM);
    assert.deepEqual([alto!.tope_monto, alto!.tope_moneda, alto!.tope_periodo], [500, "USD", "compra"]);
    assert.deepEqual(ordenados(general!.productos_elegibles), TODAS);
    assert.deepEqual([general!.tope_monto, general!.tope_moneda, general!.tope_periodo], [300, "USD", "compra"]);
    assert.deepEqual(alto!.departamentos, ["maldonado"]);
    assert.deepEqual(e.productos_desconocidos, []);
  });

  it("cuotas: un tramo con el máximo, solo tarjetas de crédito, y el departamento del título", () => {
    const e = normalizarScotiabank(crudo("albanes-florida-2022-01-01", {
      titulo: "Albanes - Florida",
      categoria: "interior",
      descuentos: [{ pct: "12 y 18 cuotas sin interés", texto: "con Tarjetas de Crédito" }],
      dias: "Todos los días",
      departamento: "",
      desde: "2022-01-01",
      hasta: "3022-06-20",
      legal: "Todos los días, 12 y 18 cuotas sin interés con Tarjetas de Crédito Scotiabank. Promoción exclusiva para tarjetas emitidas por Scotiabank Uruguay S.A.",
    }));
    assert.equal(e.comercio?.key, "albanes");
    assert.equal(e.beneficios.length, 1);
    const b = e.beneficios[0]!;
    assert.equal(b.tipo, "cuotas");
    assert.equal(b.cuotas, 18);
    assert.equal(b.porcentaje, null);
    assert.equal(b.titulo, "Hasta 18 cuotas sin interés");
    assert.equal(b.descuento_raw, "12 y 18 cuotas sin interés con Tarjetas de Crédito");
    assert.deepEqual(ordenados(b.productos_elegibles), CREDITO);
    assert.deepEqual(b.departamentos, ["florida"]);
    assert.equal(b.tope_monto, null);
  });

  it("fecha comodín (3022) → sin fecha de fin; 'Tope de $X por compra' es tope de compra (devolución = % × X)", () => {
    const e = normalizarScotiabank(crudo("3-musas-2024-02-01", {
      titulo: "3 Musas",
      categoria: "librerias",
      descuentos: [
        { pct: "25% de ahorro", texto: "con tarjetas de Crédito Platinum, Infinite, Gold y Débito Premium." },
        { pct: "15% de ahorro", texto: "con tarjetas de Crédito y Débito." },
      ],
      dias: "Todos los días",
      departamento: "maldonado",
      desde: "2024-02-01",
      hasta: "3022-01-01",
      legal: "Todos los días 15% de descuento con Tarjetas de Débito y Crédito y 25% Tarjetas de Crédito Gold, Platinum e Infinite. El descuento se realiza en el establecimiento al momento de la compra. Tope de $20.000 (pesos uruguayos veinte mil) por compra. Promoción válida para Tarjetas de Crédito emitidas por Scotiabank Uruguay S.A.",
    }));
    for (const b of e.beneficios) {
      assert.equal(b.vigencia_desde, "2024-02-01");
      assert.equal(b.vigencia_hasta, null);
    }
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_moneda, b.tope_periodo]), [
      [25, 5000, "UYU", "compra"],
      [15, 3000, "UYU", "compra"],
    ]);
    assert.equal(e.comercio?.categoria, "libreria-juguetes");
  });

  it("días: los del tramo ('de lunes a miércoles') y un tope por porcentaje", () => {
    const e = normalizarScotiabank(crudo("kinko-2025-12-08", {
      titulo: "Kinko",
      categoria: "supermercados",
      descuentos: [
        { pct: "15% de ahorro", texto: "Todos los días con Tarjetas de Crédito Visa Infinite, Visa Platinum, American Express Platinum y Gold y Tarjetas de Débito Premium." },
        { pct: "10% de ahorro", texto: "de lunes a miércoles con Tarjas de Crédito y Tarjetas de Débito Scotiabank." },
      ],
      dias: "Todos los días",
      departamento: "",
      desde: "2025-12-08",
      hasta: "2026-12-31",
      legal: "Todos los días 15% de ahorro con Tarjetas de Crédito Visa Platinum, Visa Infinite, Amex Oro, Amex Platinum y Débito Premium. Tope de descuento por compra de $3.000.\n-Todos los lunes, martes y miércoles 10% de ahorro con Tarjetas de Crédito y Debito Scotiabank. Tope de descuento por compra de $2.000.-\nEl descuento se realiza al momento de la compra en el establecimiento. Promoción válida para tarjetas emitidas por Scotiabank Uruguay S.A.\"",
    }));
    const [quince, diez] = e.beneficios;
    assert.deepEqual(quince!.dias_semana, []);
    assert.deepEqual(ordenados(quince!.productos_elegibles), PREMIUM);
    assert.deepEqual([quince!.tope_monto, quince!.tope_periodo], [3000, "compra"]);
    assert.deepEqual(diez!.dias_semana, [1, 2, 3]);
    assert.deepEqual(ordenados(diez!.productos_elegibles), TODAS);
    assert.deepEqual([diez!.tope_monto, diez!.tope_periodo], [2000, "compra"]);
    assert.equal(quince!.vigencia_hasta, "2026-12-31");
  });

  it("días del catálogo, tarjetas y fechas de los legales, tope mensual", () => {
    const e = normalizarScotiabank(crudo("combustible-2025-12-15", {
      titulo: "Combustible",
      categoria: "platinumcard,automovil",
      descuentos: [{ pct: "10% de ahorro", texto: "jueves y domingos en carga de combustible." }],
      dias: "custom:Jueves y Domingos",
      departamento: "montevideo",
      desde: "2025-12-15",
      hasta: "2030-12-31",
      legal: "Legal COMBUSTIBLE:\nEl descuento del 10% en carga de combustible es únicamente los días jueves y domingos y se realiza en el estado de cuenta del cliente y aplica únicamente a las tarjetas de crédito The Platinum Card American Express emitidas por Scotiabank Uruguay SA (tarjeta que hace referencia en la imagen). Tope máximo de descuento por cuenta en el período de la promoción (por cuenta y por mes) $1.200 (mil doscientos pesos uruguayos). El descuento no aplica sobre la devolución de IMESI, en el caso de carga de combustibles en estaciones de servicio que apliquen esta devolución. Quedan excluidas las tarjetas American Express Platinum del programa ConnectMiles. Promoción válida desde 1/10/2025 a 31/12/2026.",
    }));
    const b = e.beneficios[0]!;
    assert.deepEqual(b.dias_semana, [4, 0]);
    assert.deepEqual(b.productos_elegibles, ["scotiabank-amex-platinum"]);
    // Las fechas de los legales mandan sobre las del catálogo (2030 sería un comodín).
    assert.equal(b.vigencia_desde, "2025-10-01");
    assert.equal(b.vigencia_hasta, "2026-12-31");
    assert.deepEqual([b.tope_monto, b.tope_moneda, b.tope_periodo], [1200, "UYU", "mes"]);
    assert.equal(e.comercio?.categoria, "transporte");
  });

  it("departamentos en lista; las tarjetas de los legales suman a las del catálogo", () => {
    const e = normalizarScotiabank(crudo("rey-clothes-shoes-2023-06-28", {
      titulo: "Rey Clothes & Shoes",
      categoria: "vestimenta",
      descuentos: [{ pct: "15% de ahorro", texto: "con tarjetas de crédito." }],
      dias: "Todos los días",
      departamento: "Durazno, Tacuarembó, Flores, Florida",
      desde: "2023-06-28",
      hasta: "3022-01-01",
      legal: "Todos los días 15% de descuento con tarjetas de crédito y débito Scotiabank. El descuento se realiza en el momento de la compra en el establecimiento. Tope de $10.000 (pesos uruguayos diez mil) por compra. Promoción válida para tarjetas emitidas por Scotiabank Uruguay S.A.",
    }));
    const b = e.beneficios[0]!;
    assert.deepEqual(b.departamentos, ["durazno", "flores", "florida", "tacuarembo"]);
    assert.deepEqual(ordenados(b.productos_elegibles), TODAS);
    assert.equal(e.comercio?.categoria, "indumentaria");
  });

  it("varios tramos con un tope por grupo de tarjetas", () => {
    const e = normalizarScotiabank(crudo("plaza-de-chueca-2022-01-01", {
      titulo: "Plaza de Chueca",
      categoria: "restaurantes",
      descuentos: [
        { pct: "25% de ahorro", texto: "con tarjetas Platinum, Infinite, Gold y débito Premium./" },
        { pct: "15% de ahorro", texto: "con Tarjetas de crédito y débito." },
      ],
      dias: "Todos los días",
      departamento: "",
      desde: "2022-01-01",
      hasta: "3024-10-01",
      legal: "El descuento se realiza al momento de la compra. Tope de devolución por compra para tarjetas Platinum, Infinite, Gold y Débito Premium $2500 y para tarjetas de crédito y débito clásicas $1500. Promoción exclusiva para tarjetas emitidas por Scotiabank. Uruguay S.A.",
    }));
    assert.deepEqual(e.beneficios.map((b) => [b.porcentaje, b.tope_monto, b.tope_periodo]), [
      [25, 2500, "compra"],
      [15, 1500, "compra"],
    ]);
    assert.deepEqual(e.beneficios[0]!.departamentos, []);
  });

  it("fechas concretas en los legales y tope por cuenta y promoción", () => {
    const e = normalizarScotiabank(crudo("almenara-2026-09-18", {
      titulo: "Almenara",
      categoria: "supermercados",
      descuentos: [
        { pct: "25% de Ahorro", texto: " con Tarjetas Platinum, Infinite, Gold y Débito Premium." },
        { pct: "15% de Ahorro", texto: "con Tarjetas de Crédito y Débito." },
      ],
      dias: "custom:Del 19 al 27 de septiembre",
      departamento: "",
      desde: "2026-09-18",
      hasta: "2026-09-30",
      legal: "ALMENARA - Entretenimiento\n15% de descuento con Tarjetas de Crédito y Débito y 25% de descuento con Tarjetas Platinum, Infinite, Gold y Débito Premium. Promoción válida desde el 19/09/2026 al 27/09/2026. El descuento se realiza en el estado de cuenta del cliente en hasta 30 días hábiles de realizado el consumo, aplica exclusivamente para compras realizadas en el establecimiento. Tope por cuenta y promoción de $1.000 (pesos uruguayos mil). Promoción válida para tarjetas emitidas por Scotiabank Uruguay S.A.",
    }, "https://www.scotiabank.com.uy/Personas/Tarjetas/Beneficios/Supermercados/almenara"));
    for (const b of e.beneficios) {
      // "Del 19 al 27 de septiembre" son fechas, no días de la semana.
      assert.deepEqual(b.dias_semana, []);
      assert.equal(b.vigencia_desde, "2026-09-19");
      assert.equal(b.vigencia_hasta, "2026-09-27");
      assert.deepEqual([b.tope_monto, b.tope_periodo], [1000, "beneficio"]);
      assert.equal(b.url_fuente, "https://www.scotiabank.com.uy/Personas/Tarjetas/Beneficios/Supermercados/almenara");
    }
  });

  it("sin porcentaje ni cuotas no es un beneficio", () => {
    const e = normalizarScotiabank(crudo("telepeaje-2022-01-01", {
      titulo: "Telepeaje",
      categoria: "automovil",
      descuentos: [{ pct: "", texto: "Solicitá tu TAG de forma gratuita" }],
      dias: "Todos los días",
      departamento: "",
      desde: "2022-01-01",
      hasta: "3022-06-20",
      legal: "Contratando el servicio de TELEPEAJE a través de Tarjeta de Crédito VISA, AMERICAN EXPRESS y MASTERCARD emitidas por Scotiabank Uruguay S.A. Te obsequiamos el TAG en forma Gratuita.",
    }));
    assert.equal(e.es_beneficio, false);
    assert.equal(e.comercio, null);
    assert.deepEqual(e.beneficios, []);
  });

  it("ficha sin porcentaje en el catálogo: el tramo sale de los legales (U$D es dólares)", () => {
    const e = normalizarScotiabank(crudo("old-christians-club-2025-10-30", {
      titulo: "Old Christians Club",
      categoria: "deportes",
      descuentos: [{ pct: "", texto: "Con la nueva Visa Infinite del OCC difrutá Todos los días de múltiples beneficios. Ingresá aquí y descubrilos." }],
      dias: "Todos los días",
      departamento: "",
      desde: "2025-10-30",
      hasta: "3200-03-15",
      legal: "Todos los días 15% de descuento para tarjetas de crédito Visa Infinite de Scotiabank para compras realizadas en la página web www.oldchristians.org. Y en su espacio de “OCC SHOP” ubicado en su cede central y sucursales. Tope de descuento por compra de U$D 75.-",
    }));
    assert.equal(e.beneficios.length, 1);
    const b = e.beneficios[0]!;
    assert.equal(b.porcentaje, 15);
    assert.deepEqual(b.productos_elegibles, ["scotiabank-visa-infinite"]);
    assert.deepEqual([b.tope_monto, b.tope_moneda, b.tope_periodo], [75, "USD", "compra"]);
    assert.equal(b.canal, "ambos");
  });

  it("topes distintos por local que no se pueden asignar: sin tope y a revisión", () => {
    const e = normalizarScotiabank(crudo("la-pasiva-2024-12-01", {
      titulo: "La Pasiva",
      categoria: "restaurantes",
      descuentos: [
        { pct: "25% de ahorro", texto: "con Tarjetas de Crédito Platinum, Infinite, Gold y Débito Premium." },
        { pct: "15% de ahorro", texto: "con Tarjetas de Crédito y Débito." },
        { pct: "", texto: "21 de Setiembre, Agraciada, Punta y Piríapolis." },
      ],
      dias: "Todos los días",
      departamento: "maldonado, montevideo",
      desde: "2024-12-01",
      hasta: "3022-01-01",
      legal: "La Pasiva, Piriápolis: El descuento se realiza en el estado de cuenta del cliente a los 20 días hábiles de realizado el consumo. Tope de descuento por mes y por cuenta de $5000 (pesos uruguayos cinco mil). La Pasiva, Punta del Este - Gorlero: El descuento se realiza al momento de la compra. Tope de compra $10.000 (pesos uruguayos diez mil). La Pasiva 21 de setiembre , Montevideo: Todos los días 15% de descuento con Tarjetas de Crédito y Débito Scotiabank y 25% con tarjetas de Crédito Platinum, Infinite y Oro y Débito Premium. Tope de $3.000 de descuento por compra. El descuento se realiza en el momento de la compra en el establecimiento.",
    }));
    // El tercer "descuento" es una lista de locales: se descarta.
    assert.equal(e.beneficios.length, 2);
    for (const b of e.beneficios) assert.equal(b.tope_monto, null);
    assert.deepEqual(e.beneficios[0]!.departamentos, ["maldonado", "montevideo"]);
    assert.ok(e.productos_desconocidos.every((p) => p.startsWith("tramo ")));
    assert.equal(e.productos_desconocidos.length, 2);
  });

  it("'Tope de $25.000 por compra' con venta por la web: tope de compra (Centro Color)", () => {
    const e = normalizarScotiabank(crudo("centro-color-2025-10-01", {
      titulo: "Centro Color",
      categoria: "shoppings",
      descuentos: [{ pct: "15% de ahorro", texto: "con tarjetas de Crédito y Débito." }],
      dias: "Todos los días",
      departamento: "",
      desde: "2025-10-01",
      hasta: "3026-10-31",
      legal: "Todos los días 15% de ahorro con tarjetas de Crédito y Débito. Tope de $25.000 (pesos uruguayos veinticinco mil) por compra. El descuento aplica para ventas efectuadas por la web propia o por pedidos telefónicos directos a la empresa.",
    }));
    assert.equal(e.beneficios.length, 1);
    const b = e.beneficios[0]!;
    assert.deepEqual([b.porcentaje, b.tope_monto, b.tope_moneda, b.tope_periodo], [15, 3750, "UYU", "compra"]);
  });

  it("'Tope de devolución: USD 500' va al tramo de porcentaje en dólares; las cuotas no tienen tope (Maximstore)", () => {
    const e = normalizarScotiabank(crudo("maximstore-2024-11-15", {
      titulo: "Maximstore",
      categoria: "tecnologia",
      descuentos: [
        { pct: "15% de ahorro", texto: "con tarjetas de crédito." },
        { pct: "12 y 18 cuotas", texto: "sin recargo." },
      ],
      dias: "Todos los días",
      departamento: "",
      desde: "2024-11-15",
      hasta: "3022-01-01",
      legal: "Todos los días 15% de descuento con Tarjetas de Crédito Scotiabank. Tope de devolución: USD 500. El descuento se realiza en el momento de la compra en el establecimiento. Promoción válida para tarjetas emitidas por Scotiabank Uruguay S.A.",
    }));
    const [pct, cuotas] = e.beneficios;
    assert.equal(pct!.tipo, "porcentaje");
    assert.deepEqual([pct!.tope_monto, pct!.tope_moneda, pct!.tope_periodo], [500, "USD", "compra"]);
    assert.equal(cuotas!.tipo, "cuotas");
    assert.equal(cuotas!.tope_monto, null);
  });

  it("'Cines 50%' solo vale en cines: no va al alias `cines` (todo-cines-teatros) sino a un comercio propio", () => {
    const e = normalizarScotiabank(crudo("cines-50-2026-06-18", {
      titulo: "Cines 50%",
      categoria: "cines",
      descuentos: [{ pct: "50% de ahorro", texto: "en cines de todo el país con tarjetas débito Premium y débito Infinite." }],
      dias: "Todos los días",
      departamento: "",
      desde: "2026-06-18",
      hasta: "2026-12-31",
      legal: "Todos los días 50% de descuento con Tarjetas de Débito Premium y Tarjetas de Débito Infinite emitidas por Scotiabank Uruguay S.A. El beneficio aplica todos los días en todos los cines del país*. Tope máximo de descuento por cuenta y por mes de $1.500 (mil quinientos pesos uruguayos). El descuento se realiza en la cuenta del cliente en hasta 30 días hábiles de realizada la compra. Promoción válida desde 1/06/2026 a 31/12/2026”.\n*El Descuento únicamente aplicará a las compras realizadas en establecimientos que tengan como giro exclusivo el de Cine.",
    }));
    assert.deepEqual(e.comercio, { key: "salas-de-cine", nombre: "Salas de cine", categoria: "entretenimiento" });
    assert.equal(e.beneficios.length, 1);
    const b = e.beneficios[0]!;
    assert.equal(b.comercio_key, "salas-de-cine");
    assert.deepEqual([b.porcentaje, b.tope_monto, b.tope_periodo], [50, 1500, "mes"]);
  });

  it("sin los datos del catálogo tira (la página queda fallida y sus beneficios siguen)", () => {
    const c: Crudo = { fuente_id: "scotiabank", external_id: "x", url_fuente: INDICE, contenido: "X", fetched_at: "2026-09-28T12:00:00.000Z" };
    assert.throws(() => normalizarScotiabank(c), /no trae los datos del catálogo/);
  });
});

describe("parser de Scotiabank: piezas", () => {
  it("tarjetas: niveles, 'Débito Premium', 'crédito y débito Premium', Débito Infinite", () => {
    assert.deepEqual(tarjetasDe("con Tarjetas Platinum, Infinite, Gold y Débito Premium.").ids, PREMIUM);
    assert.deepEqual(tarjetasDe("con Tarjetas de Débito y Crédito Premium.").ids, PREMIUM);
    assert.deepEqual(tarjetasDe("con tarjetas de crédito.").ids, CREDITO);
    assert.deepEqual(tarjetasDe("de todo el país con tarjetas débito Premium y débito Infinite.").ids, ["scotiabank-debito-premium"]);
    assert.deepEqual(tarjetasDe("jueves y domingos en carga de combustible.").nombres, []);
  });

  it("días", () => {
    assert.deepEqual(diasDe("Todos los días"), []);
    assert.deepEqual(diasDe("De lunes a viernes"), [1, 2, 3, 4, 5]);
    assert.deepEqual(diasDe("Jueves y Domingos"), [4, 0]);
    assert.deepEqual(diasDe("el primer y último domingo de cada mes"), [0]);
    assert.deepEqual(diasDe("Del 19 al 27 de septiembre"), []);
  });

  it("departamentos: nombres libres, Punta del Este, Mercedes; nacional/web = todo el país", () => {
    assert.deepEqual(departamentosDe("punta del este, maldonado"), ["maldonado"]);
    assert.deepEqual(departamentosDe("Montevideo,Maldonado"), ["maldonado", "montevideo"]);
    assert.deepEqual(departamentosDe("colonia, mercedes"), ["colonia", "soriano"]);
    assert.deepEqual(departamentosDe("nacional"), []);
    assert.deepEqual(departamentosDe("web"), []);
  });

  it("comercio del título: solo se saca la sucursal si es un lugar", () => {
    assert.deepEqual(comercioDelTitulo("Salón Ocre - Treinta y Tres"), { nombre: "Salón Ocre", departamento: "treinta-y-tres" });
    assert.deepEqual(comercioDelTitulo("Arrecife - La Paloma"), { nombre: "Arrecife", departamento: "rocha" });
    assert.deepEqual(comercioDelTitulo("BIGA - pizza & pasta"), { nombre: "BIGA - pizza & pasta", departamento: null });
    assert.deepEqual(comercioDelTitulo("Plantado - Hyatt Centric Montevideo").departamento, null);
    assert.deepEqual(comercioDelTitulo("Zule | Panadería y Café").nombre, "Zule");
    assert.deepEqual(comercioDelTitulo("Cines 50%").nombre, "Cines");
  });

  it("vigencia de los legales", () => {
    assert.deepEqual(vigenciaDelLegal("La promoción es válida para todas las compras realizadas del 1° al 31 de julio de 2023 con tarjetas"), { desde: "2023-07-01", hasta: "2023-07-31" });
    assert.deepEqual(vigenciaDelLegal("Promoción válida únicamente los viernes, sábado y domingo desde el 3 de julio 2026 al 27 de septiembre 2026 y es exclusiva"), { desde: "2026-07-03", hasta: "2026-09-27" });
    assert.deepEqual(vigenciaDelLegal("Beneficio válido hasta el 31 de agosto de 2024."), { desde: null, hasta: "2024-08-31" });
    assert.deepEqual(vigenciaDelLegal("Tope de compra $10.000."), { desde: null, hasta: null });
  });

  it("topes: por porcentaje explícito, tope de compra, sin período escrito (por compra, como el modelo)", () => {
    const porPct = topesDelLegal("La devolución se realiza en el momento. Tope máximo de devolución del 15%: $1.500 (mil quinientos pesos). Tope máximo de devolución del 25%: $2.500 (dos mil quinientos pesos).");
    assert.deepEqual(porPct.map((t) => [t.pct, t.monto, t.sobre, t.periodo]), [[15, 1500, "devolucion", "compra"], [25, 2500, "devolucion", "compra"]]);
    const compra = topesDelLegal("Tope de factura o compra para obtener el descuento $ 15.000.");
    assert.deepEqual(compra.map((t) => [t.monto, t.sobre, t.periodo]), [[15000, "compra", "compra"]]);
    const despues = topesDelLegal("El descuento se verá reflejado en el estado de cuenta del cliente después de los 15 días de efectuada la compra. Tope de descuento: $3.000.");
    assert.deepEqual(despues.map((t) => [t.monto, t.sobre, t.periodo]), [[3000, "devolucion", "compra"]]);
    const avista = topesDelLegal("El descuento se realiza en el momento de la compra y el tope de devolución por compra para el 15% es de $1.800 pesos uruguayos y para el 25% de $5.000 pesos uruguayos.");
    assert.deepEqual(avista.map((t) => [t.pct, t.monto]), [[15, 1800], [25, 5000]]);
    // "Tope de $X por compra", sin decir de qué: de compra (Pura Vida, Wantan).
    const porCompra = topesDelLegal("El descuento se realiza en el establecimiento al momento de la compra. Tope de $20.000 (pesos uruguayos veinte mil) por compra. No aplica el descuento a ventas realizadas a través de plataformas como ser “Pedidos Ya”.");
    assert.deepEqual(porCompra.map((t) => [t.monto, t.sobre, t.periodo]), [[20000, "compra", "compra"]]);
    const pegado = topesDelLegal("Tope de $15.000 (pesos uruguayos quince mil) por compra.No aplica el descuento a ventas realizadas a través de plataformas.");
    assert.deepEqual(pegado.map((t) => [t.monto, t.sobre]), [[15000, "compra"]]);
    // Si dice que es de descuento, lo es.
    const deDescuento = topesDelLegal("Tope de $3.000 de descuento por compra. El descuento se realiza en el momento.");
    assert.deepEqual(deDescuento.map((t) => [t.monto, t.sobre, t.periodo]), [[3000, "devolucion", "compra"]]);
    const maximo = topesDelLegal("Tope máximo de descuento $1500 (pesos uruguayos mil quinientos) por compra.");
    assert.deepEqual(maximo.map((t) => [t.monto, t.sobre]), [[1500, "devolucion"]]);
    const usd = topesDelLegal("Tope de devolución: USD 500. El descuento se realiza en el momento de la compra en el establecimiento.");
    assert.deepEqual(usd.map((t) => [t.monto, t.moneda, t.sobre]), [[500, "USD", "devolucion"]]);
  });
});
