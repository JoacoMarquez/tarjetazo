// Club ASI (#10): descuentos de la API de Mashkady.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crudoDeDescuento, esDeOtroPrograma, normalizarAsi, type DescuentoMashkady } from "./fuentes/asi.js";

const base: DescuentoMashkady = {
  _id: "6a43b815a2a73046f3879cb0",
  title: "Óptica del Centro",
  percentage: "15%",
  tags: [{ name: "Ópticas" }],
  shortDescription: "Descuento en armazones. No acumulable con otras promociones.",
  usageLimit: "monthly",
  expirationDate: "2027-03-01T00:00:00.000Z",
  selectedAddresses: [
    { title: "Centro", description: "Ejido 1309, Montevideo", department: "Montevideo", lat: "-34.905", lng: "-56.19" },
    { title: "Mercedes", description: "Colón 270, Mercedes", department: "Soriano", lat: "-33.25", lng: "-58.03" },
  ],
};

describe("Club ASI", () => {
  it("arma el beneficio con sus locales y departamentos", () => {
    const c = crudoDeDescuento(base);
    assert.equal(c.external_id, "optica-del-centro-879cb0");
    assert.equal(c.sucursales?.length, 2);
    const e = normalizarAsi(c);
    assert.equal(e.comercio?.categoria, "salud-belleza");
    const [b] = e.beneficios;
    assert.equal(b?.porcentaje, 15);
    assert.deepEqual(b?.departamentos, ["montevideo", "soriano"]);
    assert.equal(b?.vigencia_hasta, "2027-03-01");
    assert.equal(b?.canal, "presencial");
    assert.equal(b?.acumulable, false);
    assert.deepEqual(b?.productos_elegibles, ["club-asi"]);
  });

  it("sin locales es online, y un voucher no es un porcentaje", () => {
    const online = normalizarAsi(crudoDeDescuento({ ...base, selectedAddresses: [], shortDescription: "Ingresá el código al finalizar tu compra en la web." }));
    assert.equal(online.beneficios[0]?.canal, "online");
    assert.equal(normalizarAsi(crudoDeDescuento({ ...base, percentage: "Voucher" })).beneficios.length, 0);
  });

  it("deja afuera los de la Tarjeta Sonrisas de Tres Cruces", () => {
    assert.ok(esDeOtroPrograma({ ...base, tags: [{ name: "Shopping Tres Cruces" }] }));
    assert.ok(!esDeOtroPrograma(base));
  });
});
