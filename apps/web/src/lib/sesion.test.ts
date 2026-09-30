import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esLimiteDePedidos } from "./sesion.ts";

describe("refresh de sesión", () => {
  it("un 429 no cuenta como sesión inválida", () => {
    assert.equal(esLimiteDePedidos({ status: 429 }), true);
    assert.equal(esLimiteDePedidos({ status: 400, code: "over_request_rate_limit" }), true);
  });

  it("los demás errores sí borran la sesión", () => {
    assert.equal(esLimiteDePedidos(null), false);
    assert.equal(esLimiteDePedidos({ status: 400, code: "refresh_token_not_found" }), false);
    assert.equal(esLimiteDePedidos({ status: 401 }), false);
  });
});
