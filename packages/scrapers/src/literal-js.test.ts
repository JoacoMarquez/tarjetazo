// Lector de literales JS y su uso en el catálogo de Scotiabank: los datos se
// leen sin ejecutar el código de la página.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { argumentosDeLlamadas, leerLiteral } from "./literal-js.js";
import { catalogo, detalle } from "./fuentes/scotiabank.js";

describe("literales JS", () => {
  it("lee lo que publica Scotiabank: claves sin comillas, comillas simples, comas finales, comentarios", () => {
    const { valor } = leerLiteral(`{
      titulo: 'Pizzer\\u00eda Rodel\\u00fa',
      'con-guion': "doble \\"comilla\\"",
      orden: 1, pct: -2.5,
      // subtitulo: [''],
      descuentos: [ { pct: '25% de ahorro', texto: 'con Tarjetas Platinum.' }, ],
      activo: true, nada: null, falta: undefined,
    }`);
    assert.deepEqual(JSON.parse(JSON.stringify(valor)), {
      titulo: "Pizzería Rodelú",
      "con-guion": 'doble "comilla"',
      orden: 1,
      pct: -2.5,
      descuentos: [{ pct: "25% de ahorro", texto: "con Tarjetas Platinum." }],
      activo: true,
      nada: null,
    });
  });

  it("no acepta código: llamadas, variables ni expresiones", () => {
    assert.throws(() => leerLiteral("{ a: fetch('x') }"));
    assert.throws(() => leerLiteral("{ a: window.constructor }"));
    assert.throws(() => leerLiteral("{ a: 1 + 1 }"));
    assert.throws(() => leerLiteral("{ a: `plantilla` }"));
  });

  it("__proto__ es una clave más, no toca el prototipo", () => {
    const { valor } = leerLiteral("{ __proto__: { admin: true }, a: 1 }") as { valor: Record<string, unknown> };
    assert.equal(Object.getPrototypeOf(valor), null);
    assert.equal(({} as Record<string, unknown>).admin, undefined);
  });

  it("toma los argumentos de cada llamada y saltea la definición de la función", () => {
    const src = `function pushBenefit(data) { _allBenefits.push(data); }
      pushBenefit({ a: 1 }); pushBenefit(algo()); setBenefit('DETALLE', { b: 2 });`;
    assert.deepEqual(JSON.parse(JSON.stringify(argumentosDeLlamadas(src, "pushBenefit"))), [[{ a: 1 }]]);
    assert.deepEqual(JSON.parse(JSON.stringify(argumentosDeLlamadas(src, "setBenefit"))), [["DETALLE", { b: 2 }]]);
  });
});

describe("catálogo de Scotiabank", () => {
  const item = `{ categoria: 'restaurantes', departamento: 'montevideo', dias: 'Todos los días',
    desde: '2026-01-01', hasta: '3022-01-01', titulo: 'Pizzería Rodelú', orden: 1,
    descuentos: [ { pct: '25% de ahorro', texto: 'con Tarjetas de Crédito.' } ], legal: 'Tope $10.000.' }`;

  it("arma los items como antes y descarta los de menos de 5 campos", () => {
    const html = `<script>var _allBenefits = []; function pushBenefit(data) {}</script>
      <script>pushBenefit(${item});</script><script>pushBenefit({ titulo: 'corto' });</script>`;
    const items = catalogo(html);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.titulo, "Pizzería Rodelú");
    assert.equal(items[0]!.descuentos?.[0]?.pct, "25% de ahorro");
  });

  it("un script de la página no se ejecuta", () => {
    const g = globalThis as { __escapo?: boolean };
    const html = `<script>pushBenefit(${item}); window.constructor.constructor('globalThis.__escapo = true')();
      pushBenefit({ titulo: (globalThis.__escapo = true), a: 1, b: 2, c: 3, d: 4 });</script>`;
    const items = catalogo(html);
    assert.equal(g.__escapo, undefined);
    assert.equal(items.length, 1);
  });

  it("lee el DETALLE de la ficha", () => {
    const html = `<script>setBenefit('BENEFICIO', { titulo: 'x' });
      setBenefit('DETALLE', { info: [ { type: 'text', content: 'Hola' }, ], legales: 'Condiciones' });</script>`;
    assert.deepEqual(JSON.parse(JSON.stringify(detalle(html))), { info: [{ type: "text", content: "Hola" }], legales: "Condiciones" });
  });
});
