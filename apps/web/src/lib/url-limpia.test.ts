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

  it("no deja /admin en la página anterior ni en los mapas de calor", () => {
    const p = propiedadesSinTokens({
      $current_url: "https://a.uy/",
      $prev_pageview_pathname: "/admin/beneficios",
      $prev_pageview_duration: 12,
      $heatmap_data: { "https://a.uy/admin/beneficios?q=x": [1], "https://a.uy/?code=1": [2] },
    });
    assert.deepEqual(p, { $current_url: "https://a.uy/", $heatmap_data: { "https://a.uy/": [2] } });
  });

  it("si los mapas de calor eran todos de /admin, no viajan", () => {
    const p = propiedadesSinTokens({ $prev_pageview_pathname: "/comparar", $heatmap_data: { "https://a.uy/admin": [1] } });
    assert.deepEqual(p, { $prev_pageview_pathname: "/comparar" });
  });
});
