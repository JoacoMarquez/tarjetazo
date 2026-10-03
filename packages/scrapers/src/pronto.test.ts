// Pronto+ (#10): promos escritas a mano, leídas con reglas.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arreglarCodificacion, crudoDePagina, dias, direccionesDe, nombreDeTitulo, normalizarPronto, vigencia } from "./fuentes/pronto.js";
import { departamentos } from "./geo/lugares.js";

function pagina(titulo: string, cuerpo: string): string {
  return `<html><head><title>${titulo}</title></head><body><main>${cuerpo}</main></body></html>`;
}

describe("Pronto+", () => {
  it("saca el comercio del título", () => {
    assert.equal(nombreDeTitulo("10% OFF en Farmacia Cooper"), "Farmacia Cooper");
    assert.equal(nombreDeTitulo("Hasta 25% DTO Buffet Jureré"), "Buffet Jureré");
    assert.equal(nombreDeTitulo("Promo Óptica Focal"), "Óptica Focal");
    assert.equal(nombreDeTitulo("35% OFF en Cabify - Tarjeta Visa Pronto"), "Cabify");
  });

  it("lee días, vigencia y departamentos de las frases de siempre", () => {
    assert.deepEqual(dias("aplica los dias lunes, martes y miercoles."), [1, 2, 3]);
    assert.deepEqual(dias("valido de viernes a domingo hasta 31 de julio"), [0, 5, 6]);
    assert.deepEqual(vigencia("valido desde 1ero de noviembre hasta el 31 de octubre de 2026."), { desde: "2025-11-01", hasta: "2026-10-31" });
    assert.deepEqual(vigencia("valido hasta el 31/05/2026"), { desde: null, hasta: "2026-05-31" });
    // "Treinta y Tres 752" es una calle de San Carlos.
    assert.deepEqual(departamentos("treinta y tres 752, san carlos."), ["maldonado"]);
    assert.deepEqual(departamentos("consulta flores de bach"), []);
  });

  it("arma el beneficio de KFC y saltea las páginas que no son de un comercio", () => {
    const c = crudoDePagina(
      "https://www.pronto.com.uy/promo-kfc/",
      pagina("KFC", "Disfrutá del 15% de descuento en KFC. Aplica los días lunes, martes y miércoles. El descuento se aplica en el estado de cuenta. Tope de descuento: $500 y por cuenta por mes. No acumulable. Válido hasta el 31/12/2026"),
    )!;
    assert.equal(c.external_id, "kfc");
    const [b] = normalizarPronto(c).beneficios;
    assert.equal(b?.porcentaje, 15);
    assert.equal(b?.tipo, "reintegro");
    assert.deepEqual(b?.dias_semana, [1, 2, 3]);
    assert.equal(b?.tope_monto, 500);
    assert.equal(b?.tope_periodo, "mes");
    assert.equal(crudoDePagina("https://www.pronto.com.uy/restaurantes/", pagina("", "9 puntos de IVA")), null);
  });

  it("\"Hasta X%\" queda en el título si hay tramos menores, y vale el número de las condiciones si es uno solo", () => {
    const beneficio = (slug: string, nombre: string, texto: string) =>
      normalizarPronto({ fuente_id: "pronto", external_id: slug, url_fuente: `https://www.pronto.com.uy/${slug}/`, contenido: `${nombre}\nDetalle:\n${texto}`, fetched_at: "2026-10-01T00:00:00.000Z" }).beneficios[0];
    const ude = beneficio(
      "ude",
      "UDE",
      "Hasta 50% de descuento en UDE\nCondiciones:\nAplica en punto de venta del los centros educativos de Centro, Pocitos, Punta del Este, Colonia y Ciencias Agrarias.\n50% en Carreras y Cursos Técnicos.\n40% en Carreras Universitarias, Posgrados y Maestrías.\n- 30% en Carreras y Cursos Técnicos.\n- 25% en Carreras Universitarias, Posgrados y Maestrías.",
    );
    assert.equal(ude?.titulo, "Hasta 50% de descuento");
    assert.equal(ude?.descuento_raw, "Hasta 50%");
    const gelato = beneficio(
      "mondo-gelato",
      "Mondo Gelato",
      "Hasta 50% de descuento en Mondo Gelato\nCondiciones\n25% de descuento\n.\nTope del descuento: $400\nEl descuento se realiza en el estado de cuenta.\nVálido de viernes a domingo hasta 31 de julio de 2026.",
    );
    assert.equal(gelato?.titulo, "25% de descuento");
    assert.equal(gelato?.porcentaje, 25);
    assert.deepEqual(gelato?.dias_semana, [0, 5, 6]);
    // Sin números en las condiciones, el "hasta" se queda.
    const optivision = beneficio("optivision", "OPTIVISION", "Hasta 20% de descuento en optivision\nCondiciones del descuento:\nAplica en el punto de venta.");
    assert.equal(optivision?.titulo, "Hasta 20% de descuento");
  });

  it("saca las direcciones del texto para ubicar el local", () => {
    assert.deepEqual(direccionesDe("Se aplica en el local de Montevideo, Av. Italia 5625 Bis. Válido"), [
      { direccion: "Av Italia 5625 Bis, Montevideo", departamento: "montevideo" },
    ]);
    assert.deepEqual(direccionesDe("Aplica en el punto de venta de Fransisco Fondar 651, Trinidad\nLos descuentos"), [
      { direccion: "Fransisco Fondar 651, Trinidad", departamento: "flores" },
    ]);
    assert.deepEqual(
      direccionesDe("- Solano García 2499, Montevideo y Sarandí 393, Rivera. -").map((d) => d.departamento),
      ["montevideo", "rivera"],
    );
    assert.deepEqual(direccionesDe("Se aplica en la web ingresando el código PRONTO10"), []);
  });

  it("arregla el UTF-8 codificado dos veces", () => {
    assert.equal(arreglarCodificacion("AccedÃ© con tu Visa"), "Accedé con tu Visa");
    assert.equal(arreglarCodificacion("Accedé"), "Accedé");
  });
});
