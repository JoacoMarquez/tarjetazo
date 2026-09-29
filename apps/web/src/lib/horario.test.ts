import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { horarioLegible } from "./horario.ts";

describe("horarios de OpenStreetMap", () => {
  it("las formas de siempre", () => {
    assert.deepEqual(horarioLegible("Mo-Fr 09:00-20:00; Sa 09:00-13:00"), ["Lun a vie: 9 a 20", "Sáb: 9 a 13"]);
    assert.deepEqual(horarioLegible("Mo-Su 08:00-22:00"), ["Lun a dom: 8 a 22"]);
    assert.deepEqual(horarioLegible("Mo-Fr 08:30-12:30,14:00-18:30"), ["Lun a vie: 8:30 a 12:30 y 14 a 18:30"]);
    assert.deepEqual(horarioLegible("Mo-Sa 09:00-21:00; Su off"), ["Lun a sáb: 9 a 21", "Dom: cerrado"]);
    assert.deepEqual(horarioLegible("Mo,We,Fr 10:00-18:00"), ["Lun, mié y vie: 10 a 18"]);
    assert.deepEqual(horarioLegible("24/7"), ["Abierto las 24 horas"]);
    assert.deepEqual(horarioLegible("10:00-22:00"), ["Todos los días: 10 a 22"]);
    assert.deepEqual(horarioLegible("Fr-Mo 09:00-20:00"), ["Vie a lun: 9 a 20"]);
    assert.deepEqual(horarioLegible("Mo-Th, Sa, Su 09:00-21:00; Fr 09:00-22:00"), ["Lun a jue, sáb y dom: 9 a 21", "Vie: 9 a 22"]);
  });

  it("lo que no entiende no se muestra", () => {
    assert.equal(horarioLegible("Jan-Mar Mo-Fr 09:00-18:00"), null);
    assert.equal(horarioLegible("Mo-Fr sunrise-sunset"), null);
    assert.equal(horarioLegible(""), null);
    assert.equal(horarioLegible(null), null);
  });
});
