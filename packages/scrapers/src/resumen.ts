import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FUENTES, costoEstimadoUsd, type UsoModelo } from "@tarjetazo/core";

/**
 * Resumen de la corrida diaria para Telegram (#22). Se manda **siempre**, haya
 * o no problemas: si un día no llega, esa es la alerta (el cron no corrió, o
 * falló antes de llegar acá). OCA estuvo 5 días caída sin que nadie se
 * enterara; esto existe para que no se repita.
 */

/** Los chequeos de salud que piden hacer algo (los mismos que cuenta /admin). */
const ACCIONABLES: Record<string, string> = {
  saltos: "saltos entre corridas",
  paginas_sin_beneficios: "páginas sin beneficios",
  porcentaje_alto: "porcentajes sospechosos",
  derivados_desfasados: "comercios con datos viejos",
  manual_por_vencer: "manuales por vencer",
  manual_duplicado: "manuales que ya publica el banco",
};

type Corrida = {
  fuente_id: string;
  empezo_en: string;
  termino_en: string | null;
  paginas: number;
  nuevos: number;
  actualizados: number;
  vencidos: number;
  a_revisar: number;
  /** Páginas que no se pudieron normalizar (quedan para la próxima corrida). */
  fallidas: number;
  /** Páginas que cambiaron y esperan normalización (modo sin modelo). */
  pendientes: number;
  error: string | null;
  tokens_entrada: number;
  tokens_cache_escritura: number;
  tokens_cache_lectura: number;
  tokens_salida: number;
};

export interface OpcionesResumen {
  /** Solo las corridas que empezaron desde acá (el inicio del workflow). */
  desde: string;
  /** Fuentes que el workflow intentó correr. */
  fuentes: string[];
  urlAdmin: string;
  urlLog?: string;
  /** Resultado del paso de scrapers en el workflow ("success", "failure"…). */
  estadoWorkflow?: string;
  manual?: boolean;
}

const nombre = (id: string) => FUENTES.find((f) => f.id === id)?.nombre ?? id;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Desde cuántas páginas fallidas una corrida que terminó cuenta como problema. */
const FALLIDAS_PROBLEMA = 3;

type CorridaLinea = Pick<Corrida, "termino_en" | "nuevos" | "actualizados" | "vencidos" | "a_revisar" | "fallidas" | "error"> & {
  pendientes?: number;
};

/**
 * La línea de una fuente. Una corrida con páginas fallidas no está "bien"
 * aunque haya terminado: esas páginas no se actualizaron (así pasó en silencio
 * cuando se acabó el saldo del modelo). Exportada para los tests.
 */
export function lineaCorrida(nombreFuente: string, c: CorridaLinea): { linea: string; problema: boolean } {
  if (c.error) return { linea: `❌ ${nombreFuente}: ${c.error.split("\n")[0]!.slice(0, 120)}`, problema: true };
  if (!c.termino_en) return { linea: `⏳ ${nombreFuente}: sigue abierta`, problema: true };
  const fallidas = c.fallidas ?? 0;
  const cambios = [
    c.nuevos && `+${c.nuevos} ${c.nuevos === 1 ? "nuevo" : "nuevos"}`,
    c.actualizados && `${c.actualizados} ${c.actualizados === 1 ? "cambió" : "cambiaron"}`,
    c.vencidos && `−${c.vencidos} ${c.vencidos === 1 ? "baja" : "bajas"}`,
    c.a_revisar && `${c.a_revisar} a revisar`,
    fallidas && `${fallidas} ${fallidas === 1 ? "página falló" : "páginas fallaron"}`,
    // Modo sin modelo: no es un problema, es lo que se eligió; queda a la vista.
    c.pendientes && `${c.pendientes} ${c.pendientes === 1 ? "espera" : "esperan"} normalización`,
  ].filter(Boolean);
  const problema = fallidas >= FALLIDAS_PROBLEMA;
  return { linea: `${problema ? "⚠️" : "✅"} ${nombreFuente}: ${cambios.length ? cambios.join(", ") : "sin cambios"}`, problema };
}

export async function armarResumen(db: SupabaseClient, o: OpcionesResumen): Promise<string> {
  const [corridas, cola, salud] = await Promise.all([
    db
      .from("corrida")
      .select(
        "fuente_id, empezo_en, termino_en, paginas, nuevos, actualizados, vencidos, a_revisar, fallidas, pendientes, error, tokens_entrada, tokens_cache_escritura, tokens_cache_lectura, tokens_salida",
      )
      .gte("empezo_en", o.desde)
      .order("empezo_en", { ascending: false }),
    db.from("beneficio_revision").select("id", { count: "exact", head: true }).eq("resuelto", false),
    db.rpc("salud_resumen"),
  ]);
  if (corridas.error) throw new Error(`leyendo corridas: ${corridas.error.message}`);

  // La última de cada fuente en esta ventana.
  const ultima = new Map<string, Corrida>();
  for (const c of (corridas.data ?? []) as Corrida[]) if (!ultima.has(c.fuente_id)) ultima.set(c.fuente_id, c);

  const lineas: string[] = [];
  let problemas = 0;
  const uso: UsoModelo = { entrada: 0, cache_escritura: 0, cache_lectura: 0, salida: 0 };
  for (const f of o.fuentes) {
    const c = ultima.get(f);
    if (!c) {
      problemas++;
      lineas.push(`⚠️ ${nombre(f)}: no corrió`);
      continue;
    }
    uso.entrada += c.tokens_entrada;
    uso.cache_escritura += c.tokens_cache_escritura;
    uso.cache_lectura += c.tokens_cache_lectura;
    uso.salida += c.tokens_salida;
    const { linea, problema } = lineaCorrida(nombre(f), c);
    lineas.push(linea);
    if (problema) problemas++;
  }

  const alertas: string[] = [];
  if (salud.error) {
    alertas.push(`no pude correr los chequeos (${salud.error.message})`);
  } else {
    for (const r of (salud.data ?? []) as { tipo: string; cantidad: number }[]) {
      const n = Number(r.cantidad);
      if (n > 0 && ACCIONABLES[r.tipo]) alertas.push(`${ACCIONABLES[r.tipo]}: ${n}`);
    }
  }

  const titulo =
    problemas > 0
      ? `🔴 Tarjetazo: ${plural(problemas, "fuente con problema", "fuentes con problemas")}`
      : "🟢 Tarjetazo: todo corrió bien";
  const partes = [
    `${titulo}${o.manual ? " (corrida manual)" : ""}`,
    "",
    ...lineas,
  ];
  if (o.estadoWorkflow && o.estadoWorkflow !== "success" && problemas === 0) {
    partes.push("", `El paso de scrapers terminó en «${o.estadoWorkflow}»: mirá el log.`);
  }
  partes.push("");
  partes.push(`Cola de revisión: ${cola.error ? "?" : (cola.count ?? 0)}`);
  partes.push(`Salud: ${alertas.length ? alertas.join(" · ") : "sin alertas"}`);
  const costo = costoEstimadoUsd(uso);
  partes.push(`Modelo: ≈ USD ${costo.toFixed(2)} (estimado; la referencia es el saldo de la consola)`);
  partes.push("", o.urlAdmin);
  // Si algo cambió, directo a la lista de qué cambió.
  if ([...ultima.values()].some((c) => c.nuevos || c.actualizados || c.vencidos)) {
    partes.push(`Novedades: ${o.urlAdmin.replace(/\/$/, "")}/novedades`);
  }
  if (o.urlLog) partes.push(o.urlLog);
  return partes.join("\n");
}

/**
 * Esperas entre intentos (cuatro en total). Además del ajuste de red de
 * `redParaTelegram`, que un tropiezo de unos segundos no alcance para perder
 * el mensaje.
 */
const ESPERAS_MS = [2_000, 5_000, 15_000];
/** Tope para respetar el retry_after de un 429 sin colgar el workflow. */
const ESPERA_MAX_MS = 60_000;

/** No vale la pena reintentar un 4xx que no sea 429: token o chat mal puestos. */
class ErrorTelegram extends Error {
  constructor(
    message: string,
    readonly reintentable: boolean,
    readonly esperaMs?: number,
  ) {
    super(message);
  }
}

export interface OpcionesEnvio {
  /** Para los tests: sin red y sin esperar de verdad. */
  fetch?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

/**
 * Los runners de GitHub resuelven api.telegram.org a IPv4 y a IPv6, pero no
 * tienen ruta IPv6. Node (happy eyeballs, `autoSelectFamily`) le da a cada
 * dirección solo 250 ms para conectar antes de pasar a la otra; IPv4 suele
 * tardar ~150 ms, así que con un pico de latencia expira, IPv6 da ENETUNREACH
 * y `fetch` falla con `AggregateError [ETIMEDOUT]` a los ~260 ms, lejos del
 * timeout del pedido. IPv4 primero y un margen razonable por intento.
 */
function redParaTelegram() {
  setDefaultResultOrder("ipv4first");
  setDefaultAutoSelectFamilyAttemptTimeout(5_000);
}

/**
 * Sin credenciales de Telegram imprime el mensaje: sirve para probar a mano.
 * Reintenta los cortes de red, los 429 y los 5xx; si igual no sale, tira el
 * último error.
 */
export async function enviarTelegram(texto: string, o: OpcionesEnvio = {}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const f = o.fetch ?? (redParaTelegram(), fetch);
  const dormir = o.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = o.log ?? console.error;

  for (let intento = 0; ; intento++) {
    try {
      await enviarUnaVez(f, token, chat, texto);
      return true;
    } catch (e) {
      const reintentable = !(e instanceof ErrorTelegram) || e.reintentable;
      if (!reintentable || intento >= ESPERAS_MS.length) throw e;
      const espera = Math.min(e instanceof ErrorTelegram && e.esperaMs ? e.esperaMs : ESPERAS_MS[intento]!, ESPERA_MAX_MS);
      log(`Telegram: falló el intento ${intento + 1} (${describirError(e)}); reintento en ${espera / 1000} s`);
      await dormir(espera);
    }
  }
}

async function enviarUnaVez(f: typeof fetch, token: string, chat: string, texto: string) {
  const res = await f(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.ok) return;
  const cuerpo = await res.text();
  let retryAfter: number | undefined;
  try {
    retryAfter = (JSON.parse(cuerpo) as { parameters?: { retry_after?: number } }).parameters?.retry_after;
  } catch {
    // Un 502 de un proxy no trae JSON.
  }
  throw new ErrorTelegram(
    `Telegram devolvió ${res.status}: ${cuerpo.slice(0, 200)}`,
    res.status === 429 || res.status >= 500,
    retryAfter ? retryAfter * 1000 : undefined,
  );
}

/** "fetch failed" solo no dice nada: la causa (ETIMEDOUT, ECONNRESET…) sí. */
export function describirError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const causa = e.cause as { code?: string; message?: string } | undefined;
  const detalle = causa?.code ?? causa?.message;
  return detalle ? `${e.message}: ${detalle}` : e.message;
}
