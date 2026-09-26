// Para qué tarjetas es un beneficio (alcanceTarjetas), con el catálogo real.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTOS_ACTIVOS, alcanceTarjetas } from "@tarjetazo/core";

const de = (fuente: string, filtro: (p: (typeof PRODUCTOS_ACTIVOS)[number]) => boolean) =>
  PRODUCTOS_ACTIVOS.filter((p) => p.fuente_id === fuente && filtro(p)).map((p) => p.id);

describe("alcanceTarjetas", () => {
  it("lista vacía o todas las de la fuente: nada que aclarar", () => {
    assert.equal(alcanceTarjetas("bbva", []), null);
    assert.equal(alcanceTarjetas("bbva", de("bbva", () => true)), null);
  });

  it("una sola tarjeta se nombra (el 30% de 1900)", () => {
    assert.equal(alcanceTarjetas("bbva", ["bbva-nacional-platinum"]), "Nacional BBVA Mastercard Platinum");
  });

  it("los niveles de un club, con el nombre común una vez", () => {
    assert.equal(
      alcanceTarjetas("bbva", ["bbva-penarol-internacional", "bbva-penarol-oro", "bbva-penarol-platinum"]),
      "Peñarol BBVA Mastercard Internacional, Oro y Platinum",
    );
  });

  it("un pack entero se nombra por el pack", () => {
    assert.equal(
      alcanceTarjetas("santander", ["santander-select", "santander-select-mastercard-black", "santander-select-debito"]),
      "Pack Trilogy Soy Santander Select",
    );
  });

  it("todas las de un instrumento, por el instrumento", () => {
    assert.equal(alcanceTarjetas("brou", de("brou", (p) => p.instrumento === "debito")), "tarjetas de débito");
    // Con una sola débito, se la nombra.
    assert.equal(alcanceTarjetas("bbva", ["bbva-debito"]), "Débito BBVA");
    assert.equal(alcanceTarjetas("itau", de("itau", (p) => p.instrumento === "credito")), "tarjetas de crédito");
  });

  it("con más de 3 no enumera", () => {
    const genericas = ["bbva-credito", "bbva-mastercard-internacional", "bbva-oro", "bbva-mastercard-oro", "bbva-mastercard-platinum", "bbva-black", "bbva-infinite"];
    assert.equal(alcanceTarjetas("bbva", genericas), "algunas tarjetas de crédito");
    assert.equal(alcanceTarjetas("bbva", genericas, Infinity)?.split(", ").length, 4);
  });

  it("ids viejos pasan por las equivalencias; los de baja no cuentan", () => {
    assert.equal(alcanceTarjetas("oca", ["oca-blue"]), "OCA Blue Débito");
    assert.equal(alcanceTarjetas("santander", ["santander-amex"]), null);
  });
});
