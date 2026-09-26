// Pronto+ (#10): promos escritas a mano, leídas con reglas.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arreglarCodificacion, crudoDePagina, departamentos, dias, direccionesDe, nombreDeTitulo, normalizarPronto, vigencia } from "./fuentes/pronto.js";

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
