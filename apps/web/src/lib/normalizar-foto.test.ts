// Normalización de fotos de tarjetas (#72): una tarjeta inclinada no pasa
// sola. Correr con `pnpm --filter @tarjetazo/web test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { normalizarFoto } from "./normalizar-foto.ts";

/** Una tarjeta ID-1 sintética (vertical, como las de Itaú) sobre fondo transparente. */
async function tarjeta({ angulo = 0, sombra = false } = {}): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700">
    ${sombra ? '<ellipse cx="300" cy="640" rx="170" ry="18" fill="rgba(0,0,0,0.45)"/>' : ""}
    <g transform="rotate(${angulo} 300 330)">
      <rect x="170" y="125" width="260" height="412" rx="18" fill="#e8501e"/>
      <rect x="200" y="160" width="70" height="50" rx="6" fill="#d9d9d9"/>
      <circle cx="300" cy="420" r="60" fill="#b8322a"/>
    </g>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

describe("normalizarFoto", () => {
  it("una tarjeta derecha pasa y sale acostada en 1012×638", async () => {
    const r = await normalizarFoto(await tarjeta());
    assert.ok(r.ok);
    const { width, height } = await sharp(r.bytes).metadata();
    assert.deepEqual([width, height], [1012, 638]);
  });

  it("una sombra debajo no la frena", async () => {
    assert.ok((await normalizarFoto(await tarjeta({ sombra: true }))).ok);
  });

  for (const angulo of [5, 10, 20]) {
    it(`una tarjeta inclinada ${angulo}° no pasa sola`, async () => {
      const r = await normalizarFoto(await tarjeta({ angulo }));
      assert.equal(r.ok, false);
    });
  }
});
