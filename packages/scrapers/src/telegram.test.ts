// Envío del resumen a Telegram: reintentos y qué no se reintenta.
// Correr con `pnpm --filter @tarjetazo/scrapers test`.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { describirError, enviarTelegram } from "./resumen.js";

/** Un fetch falso que va devolviendo (o tirando) lo que se le pasa, en orden. */
function fetchFalso(respuestas: (Response | Error)[]) {
  const llamadas: RequestInit[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    llamadas.push(init);
    const r = respuestas.shift();
    if (!r) throw new Error("se pidió de más");
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { f, llamadas };
}

/** Como lo tira undici en los runners cuando no conecta. */
const corteDeRed = () => {
  const causa = Object.assign(new AggregateError([new Error(), new Error()]), { code: "ETIMEDOUT" });
  return new TypeError("fetch failed", { cause: causa });
};

describe("enviarTelegram", () => {
  const antes = { ...process.env };
  let esperas: number[];
  let logs: string[];
  const opciones = (f: typeof fetch) => ({
    fetch: f,
    dormir: async (ms: number) => void esperas.push(ms),
    log: (m: string) => void logs.push(m),
  });

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "t";
    process.env.TELEGRAM_CHAT_ID = "c";
    esperas = [];
    logs = [];
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  it("sin credenciales no manda nada", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { f, llamadas } = fetchFalso([]);
    assert.equal(await enviarTelegram("hola", opciones(f)), false);
    assert.equal(llamadas.length, 0);
  });

  it("reintenta los cortes de red y termina enviando", async () => {
    const { f, llamadas } = fetchFalso([corteDeRed(), corteDeRed(), new Response("{}")]);
    assert.equal(await enviarTelegram("hola", opciones(f)), true);
    assert.equal(llamadas.length, 3);
    assert.deepEqual(esperas, [2_000, 5_000]);
    assert.match(logs[0]!, /intento 1 \(fetch failed: ETIMEDOUT\)/);
  });

  it("después de cuatro intentos tira el último error", async () => {
    const { f, llamadas } = fetchFalso([corteDeRed(), corteDeRed(), corteDeRed(), corteDeRed()]);
    await assert.rejects(enviarTelegram("hola", opciones(f)), /fetch failed/);
    assert.equal(llamadas.length, 4);
    assert.deepEqual(esperas, [2_000, 5_000, 15_000]);
  });

  it("en un 429 espera lo que pide Telegram", async () => {
    const limite = new Response(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 7 } }), { status: 429 });
    const { f } = fetchFalso([limite, new Response("{}")]);
    assert.equal(await enviarTelegram("hola", opciones(f)), true);
    assert.deepEqual(esperas, [7_000]);
  });

  it("reintenta un 5xx sin JSON", async () => {
    const { f } = fetchFalso([new Response("<html>Bad Gateway</html>", { status: 502 }), new Response("{}")]);
    assert.equal(await enviarTelegram("hola", opciones(f)), true);
    assert.deepEqual(esperas, [2_000]);
  });

  it("no reintenta un 4xx: el token o el chat están mal", async () => {
    const { f, llamadas } = fetchFalso([new Response('{"ok":false,"description":"Unauthorized"}', { status: 401 })]);
    await assert.rejects(enviarTelegram("hola", opciones(f)), /Telegram devolvió 401/);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(esperas, []);
  });
});

describe("describirError", () => {
  it("suma el código de la causa al 'fetch failed'", () => {
    assert.equal(describirError(corteDeRed()), "fetch failed: ETIMEDOUT");
    assert.equal(describirError(new Error("otro")), "otro");
  });
});
