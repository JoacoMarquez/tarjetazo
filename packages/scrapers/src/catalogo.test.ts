// Catálogo auditado (2026-09-25): equivalencias viejo → nuevo, reglas del
// normalizador y del parser de BBVA para los ids que cambiaron.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EQUIVALENCIAS_PRODUCTO,
  FAMILIAS,
  FAMILIAS_TARJETA,
  FAMILIA_POR_ID,
  PRODUCTOS,
  PRODUCTOS_ACTIVOS,
  expandirProductos,
  familiaDe,
} from "@tarjetazo/core";
import { productos as productosBbva } from "./fuentes/bbva-parser.js";
import { mapearProductos } from "./normalizador.js";

const POR_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
/** Productos que entraron después de la auditoría (con su propia migración). */
const POSTERIORES = new Set<string>();
const mapea = (fuente: string, nombre: string) => mapearProductos(fuente, [nombre]).ids.sort();

describe("catálogo", () => {
  it("no repite ids", () => {
    assert.equal(new Set(PRODUCTOS.map((p) => p.id)).size, PRODUCTOS.length);
  });

  it("los activos tienen url_oficial, salvo los dudosos sin verificar", () => {
    const sinUrl = PRODUCTOS_ACTIVOS.filter((p) => !p.url_oficial && !POSTERIORES.has(p.id)).map((p) => p.id);
    assert.deepEqual(sinUrl, ["itau-debito-sueldo"]);
  });

  it("toda equivalencia apunta a productos activos de la misma fuente", () => {
    for (const [viejo, nuevos] of Object.entries(EQUIVALENCIAS_PRODUCTO)) {
      const p = POR_ID.get(viejo);
      assert.ok(p, `${viejo} no está en PRODUCTOS`);
      for (const id of nuevos) {
        const n = POR_ID.get(id);
        assert.ok(n && n.activo !== false, `${viejo} → ${id} no es un producto activo`);
        assert.equal(n.fuente_id, p.fuente_id, `${viejo} → ${id} cambia de fuente`);
      }
    }
  });

  it("todo producto dado de baja tiene equivalencia (aunque sea vacía)", () => {
    for (const p of PRODUCTOS.filter((x) => x.activo === false)) {
      assert.ok(p.id in EQUIVALENCIAS_PRODUCTO, `${p.id} está de baja sin equivalencia`);
      assert.ok(!EQUIVALENCIAS_PRODUCTO[p.id]!.includes(p.id), `${p.id} se equivale a sí mismo`);
    }
  });

  it("la billetera vieja pasa a los plásticos reales", () => {
    assert.deepEqual(expandirProductos(["santander-amex", "santander-visa"]), ["santander-visa"]);
    assert.deepEqual(expandirProductos(["oca-blue", "oca-blue-debito"]), ["oca-blue-debito"]);
    assert.deepEqual(expandirProductos(["itau-visa-signature"]), ["itau-visa-infinite-volar", "itau-latam-pass-infinite"]);
    assert.deepEqual(expandirProductos(["itau-debito-u25", "itau-pocket", "itau-debito"]), ["itau-debito-volar"]);
    assert.deepEqual(expandirProductos(["bbva-platinum", "bbva-mastercard-platinum"]), ["bbva-mastercard-platinum"]);
    assert.deepEqual(expandirProductos(["bbva-consolid-travel"]), ["bbva-consolid-travel", "bbva-consolid-travel-visa"]);
    assert.deepEqual(expandirProductos(["scotiabank-visa-gold", "brou-visa-black"]), []);
    // Lo que ya estaba: el pack Select entero.
    assert.equal(expandirProductos(["santander-select"]).length, 3);
  });

  it("Personal Bank es la familia de las Infinite de Itaú", () => {
    const f = FAMILIA_POR_ID["itau-personal-bank"];
    assert.ok(f);
    assert.deepEqual(
      f.productos.map((p) => p.id),
      ["itau-visa-infinite-volar", "itau-latam-pass-infinite", "itau-debito-infinite"],
    );
  });

  it("las familias no incluyen productos de baja", () => {
    for (const f of FAMILIAS) for (const p of f.productos) assert.notEqual(p.activo, false, p.id);
    assert.equal(FAMILIA_POR_ID["oca-blue"], undefined);
    assert.equal(FAMILIA_POR_ID["bbva-platinum"], undefined);
    assert.equal(familiaDe(POR_ID.get("bbva-mastercard-platinum")!), "bbva-mastercard-platinum");
  });

  it("el saldo y TuApp no van al catálogo público de tarjetas", () => {
    const ids = FAMILIAS_TARJETA.map((f) => f.id);
    assert.ok(!ids.includes("prex-saldo"));
    assert.ok(!ids.includes("brou-tuapp"));
    assert.ok(ids.includes("prex-mastercard"));
    // Siguen siendo familias: se pueden elegir en "mis tarjetas".
    assert.ok(FAMILIA_POR_ID["prex-saldo"]);
  });

  it("las altas están", () => {
    for (const id of [
      "brou-mastercard-debito", "bbva-consolid-travel-visa", "bbva-abtour-visa", "bbva-abtour-mastercard",
      "bbva-penarol-internacional", "bbva-penarol-oro", "bbva-penarol-platinum",
      "bbva-nacional-internacional", "bbva-nacional-oro", "bbva-nacional-platinum",
      "itau-visa-infinite-volar", "itau-latam-pass-infinite", "itau-debito-infinite", "midinero-alimentacion",
    ]) {
      assert.ok(POR_ID.get(id)?.activo !== false && POR_ID.has(id), id);
    }
  });

  it("redes corregidas", () => {
    assert.equal(POR_ID.get("santander-debito")!.red, "visa");
    assert.equal(POR_ID.get("bbva-sodimac")!.red, "visa");
    assert.equal(POR_ID.get("bbva-comunidad-plus")!.red, "visa");
  });
});

describe("normalizador", () => {
  it("Santander: la Amex ya no se mapea", () => {
    assert.deepEqual(mapea("santander", "American Express"), []);
  });

  it("OCA Blue va a la débito", () => {
    assert.deepEqual(mapea("oca", "OCA Blue"), ["oca-blue-debito"]);
    assert.deepEqual(mapea("oca", "tarjeta de débito OCA Blue"), ["oca-blue-debito"]);
  });

  it("Itaú: Infinite, Personal Bank, U25 y Pocket", () => {
    assert.deepEqual(mapea("itau", "Visa Infinite"), ["itau-latam-pass-infinite", "itau-visa-infinite-volar"]);
    assert.deepEqual(mapea("itau", "Visa Signature"), ["itau-latam-pass-infinite", "itau-visa-infinite-volar"]);
    assert.deepEqual(mapea("itau", "débito Infinite"), ["itau-debito-infinite"]);
    assert.deepEqual(mapea("itau", "Visa LATAM Pass Infinite"), ["itau-latam-pass-infinite"]);
    assert.deepEqual(mapea("itau", "Personal Bank"), ["itau-debito-infinite", "itau-latam-pass-infinite", "itau-visa-infinite-volar"]);
    assert.deepEqual(mapea("itau", "Cuenta U25"), ["itau-debito-volar"]);
    assert.deepEqual(mapea("itau", "Cuenta Pocket"), ["itau-debito-volar"]);
  });

  it("Itaú: los nombres Volar y LATAM Pass", () => {
    assert.deepEqual(mapea("itau", "Visa Volar Internacional"), ["itau-visa"]);
    assert.deepEqual(mapea("itau", "Mastercard Volar Internacional"), ["itau-mastercard"]);
    assert.deepEqual(mapea("itau", "Visa Volar Platinum"), ["itau-visa-platinum"]);
    assert.deepEqual(mapea("itau", "Mastercard Volar Black"), ["itau-mastercard-black"]);
    assert.deepEqual(mapea("itau", "Visa LATAM Pass Internacional"), ["itau-latam-pass"]);
    assert.deepEqual(mapea("itau", "Visa Débito Volar"), ["itau-debito-volar"]);
    assert.deepEqual(mapea("itau", "Volar"), ["itau-debito-volar"]);
    assert.deepEqual(mapea("itau", "Platinum"), ["itau-latam-pass-platinum", "itau-visa-platinum"]);
  });

  it("Itaú: 'crédito' a secas trae las Infinite y no los ids de baja", () => {
    const ids = mapea("itau", "tarjetas de crédito");
    assert.ok(ids.includes("itau-visa-infinite-volar"));
    assert.ok(!ids.includes("itau-visa-signature"));
    assert.ok(!mapea("itau", "tarjetas de débito").some((id) => ["itau-debito", "itau-pocket", "itau-debito-u25", "itau-personal-bank"].includes(id)));
  });

  it("Scotiabank: sin Visa Gold ni Signature", () => {
    assert.deepEqual(mapea("scotiabank", "Visa Signature"), ["scotiabank-visa-infinite"]);
    assert.deepEqual(mapea("scotiabank", "Gold"), ["scotiabank-amex-gold"]);
    // Una "Visa Gold" no cae en la Amex Gold: va a revisión.
    assert.deepEqual(mapearProductos("scotiabank", ["Visa Gold"]).desconocidos, ["Visa Gold"]);
  });

  it("BROU: Black es la Mastercard; Mastercard Débito suma la sin puntos", () => {
    assert.deepEqual(mapea("brou", "Visa Black"), ["brou-recompensa-black"]);
    assert.deepEqual(mapea("brou", "débito Mastercard"), ["brou-mastercard-debito", "brou-recompensa-debito"]);
    assert.deepEqual(mapea("brou", "BROU Recompensa Débito"), ["brou-recompensa-debito"]);
    assert.ok(mapea("brou", "tarjetas de débito").includes("brou-mastercard-debito"));
  });
});

describe("parser de BBVA", () => {
  it("Platinum es solo la Mastercard", () => {
    assert.deepEqual(productosBbva("Tarjetas de Crédito Platinum").ids, ["bbva-mastercard-platinum"]);
  });

  it("Consolid Travel trae la Visa y la Mastercard", () => {
    assert.deepEqual(productosBbva("Tarjetas BBVA Consolid Travel").ids.sort(), ["bbva-consolid-travel", "bbva-consolid-travel-visa"]);
  });

  it("'crédito' a secas no incluye la Visa Platinum", () => {
    assert.ok(!productosBbva("Tarjetas de Crédito BBVA").ids.includes("bbva-platinum"));
  });
});
