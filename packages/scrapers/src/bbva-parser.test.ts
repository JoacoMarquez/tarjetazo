// Tarjetas de marca de BBVA en el parser: clubes (Peñarol, Nacional), Abtour,
// Consolid, Comunidad Plus y Sodimac. Frases tomadas de las fichas reales.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS } from "@tarjetazo/core";
import { normalizarBbva, productos, topesDeClub } from "./fuentes/bbva-parser.js";

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
