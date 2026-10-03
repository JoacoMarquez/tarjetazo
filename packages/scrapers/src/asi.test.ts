// Club ASI (#10): descuentos de la API de Mashkady.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crudoDeDescuento, esDeOtroPrograma, normalizarAsi, tramosPorDia, type DescuentoMashkady } from "./fuentes/asi.js";

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

  it("un tramo por día cuando el porcentaje cambia según el día", () => {
    const hotel = normalizarAsi(
      crudoDeDescuento({
        ...base,
        title: "Hotel Casino San Eugenio del Cuareim",
        percentage: "10%",
        tags: [{ name: "Hotelería" }],
        shortDescription:
          "El Hotel Casino San Eugenio del Cuareim es el establecimiento hotelero más destacado de Artigas.\n\nCon tu cupón accedés a 10% de descuento en alojamiento los viernes, sábados y domingos, y 5% de descuento de lunes a jueves. Además, si realizás alguno de los paseos ofrecidos por el hotel, sumás un 5% adicional sobre el costo de la habitación.\n\nPresentá tu beneficio al momento de hacer la reserva o al check-in.",
      }),
    ).beneficios;
    assert.deepEqual(
      hotel.map((b) => [b.porcentaje, b.dias_semana, b.titulo]),
      [
        [10, [0, 5, 6], "10% de descuento de viernes a domingo"],
        [5, [1, 2, 3, 4], "5% de descuento de lunes a jueves"],
      ],
    );
    const bunker = normalizarAsi(
      crudoDeDescuento({ ...base, title: "Bunker", shortDescription: "Con tu cupón accedés a 15% OFF los días martes y 10% OFF todos los días. Presentá tu cupón al momento de la compra." }),
    ).beneficios;
    assert.deepEqual(bunker.map((b) => [b.porcentaje, b.dias_semana]), [[15, [2]], [10, []]]);
  });

  it("los horarios de atención no son días del descuento", () => {
    const horarios = [
      "Moda para toda la familia.\n✨ ¡20% OFF en toda la tienda! ✨\n\n🕗 Horarios de atención\nLunes a viernes:\n8:00 – 12:00 ⏰ | 14:30 – 18:30 🌞\nSábado:\n8:30 – 12:30 🛒",
      "Abierto de lunes a sábados de 9:00 a 12:00 y 15:00 a 19:00. Presentá tu cupón al momento de la compra.",
    ];
    for (const shortDescription of horarios) {
      const [b, otro] = normalizarAsi(crudoDeDescuento({ ...base, shortDescription })).beneficios;
      assert.deepEqual(b?.dias_semana, []);
      assert.equal(otro, undefined);
    }
    // Santa Teresa: el 10% es todos los días; "Jueves: 20%" va antes del número y no se lee.
    assert.deepEqual(tramosPorDia("• 10% de descuento todos los dias en medicamentos.\n• jueves: 20% de descuento en medicamentos y 15% en perfumeria."), [
      { porcentaje: 10, dias: [] },
    ]);
  });
});
