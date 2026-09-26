// Tarjetas de marca de BBVA en el parser: clubes (Peñarol, Nacional), Abtour,
// Consolid, Comunidad Plus y Sodimac. Frases tomadas de las fichas reales.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS } from "@tarjetazo/core";
import { normalizarBbva, productos } from "./fuentes/bbva-parser.js";

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
    "",
    "Rubro según BBVA: vida-activa.",
  ].join("\n");

  it("un tramo, solo para las tarjetas del club", () => {
    const r = normalizarBbva({
      fuente_id: "bbva", external_id: "vida-activa-nacional-cuota-y-butaca", url_fuente: "https://www.bbva.com.uy/x",
      contenido, fetched_at: "2026-09-26T00:00:00Z",
    });
    assert.equal(r.beneficios.length, 1);
    assert.equal(r.beneficios[0]!.porcentaje, 10);
    assert.deepEqual([...r.beneficios[0]!.productos_elegibles].sort(), [
      "bbva-nacional-internacional", "bbva-nacional-oro", "bbva-nacional-platinum",
    ]);
  });
});
