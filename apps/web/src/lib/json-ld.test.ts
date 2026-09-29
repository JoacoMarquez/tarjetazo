import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonLdSeguro } from "./json-ld.ts";

describe("JSON-LD", () => {
  it("un </script> en los datos no cierra el bloque", () => {
    const datos = { streetAddress: "Av. Italia 1234</script><script>alert(1)</script>", name: "A & B > C" };
    const salida = jsonLdSeguro(datos);
    assert.equal(salida.includes("<"), false);
    assert.equal(salida.includes(">"), false);
    assert.deepEqual(JSON.parse(salida), datos);
  });

  it("los separadores de línea U+2028/2029 quedan escapados y el JSON es el mismo", () => {
    const datos = { description: "uno\u2028dos\u2029tres" };
    const salida = jsonLdSeguro(datos);
    assert.equal(/[\u2028\u2029]/.test(salida), false);
    assert.deepEqual(JSON.parse(salida), datos);
  });
});
