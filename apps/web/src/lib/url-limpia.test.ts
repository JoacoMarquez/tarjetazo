import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { propiedadesSinTokens, urlSinTokens } from "./url-limpia.ts";

describe("URLs sin tokens para la analítica", () => {
  it("saca el código y los errores de Auth de la query", () => {
    assert.equal(urlSinTokens("https://tarjetazo.uy/auth/callback?code=abc&next=%2Fapp"), "https://tarjetazo.uy/auth/callback?next=%2Fapp");
    assert.equal(urlSinTokens("https://tarjetazo.uy/login?error=x&error_description=y"), "https://tarjetazo.uy/login");
  });

  it("saca los tokens del fragmento", () => {
    assert.equal(urlSinTokens("https://tarjetazo.uy/#access_token=a&refresh_token=b&type=recovery"), "https://tarjetazo.uy/#type=recovery");
  });

  it("deja igual lo demás", () => {
    assert.equal(urlSinTokens("https://tarjetazo.uy/?bancos=brou#mapa"), "https://tarjetazo.uy/?bancos=brou#mapa");
    assert.equal(urlSinTokens("no es url"), "no es url");
  });

  it("limpia todas las propiedades con URLs", () => {
    const p = propiedadesSinTokens({ $current_url: "https://a.uy/?code=1", $referrer: "https://a.uy/login?error=e", n: 3 });
    assert.deepEqual(p, { $current_url: "https://a.uy/", $referrer: "https://a.uy/login", n: 3 });
  });
});
