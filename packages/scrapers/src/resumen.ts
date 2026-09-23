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

export async function armarResumen(db: SupabaseClient, o: OpcionesResumen): Promise<string> {
  const [corridas, cola, salud] = await Promise.all([
    db
      .from("corrida")
      .select(
        "fuente_id, empezo_en, termino_en, paginas, nuevos, actualizados, vencidos, a_revisar, error, tokens_entrada, tokens_cache_escritura, tokens_cache_lectura, tokens_salida",
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
    if (c.error) {
      problemas++;
      lineas.push(`❌ ${nombre(f)}: ${c.error.split("\n")[0]!.slice(0, 120)}`);
    } else if (!c.termino_en) {
      problemas++;
      lineas.push(`⏳ ${nombre(f)}: sigue abierta`);
    } else {
      const cambios = [
        c.nuevos && `+${c.nuevos} ${c.nuevos === 1 ? "nuevo" : "nuevos"}`,
        c.actualizados && `${c.actualizados} ${c.actualizados === 1 ? "cambió" : "cambiaron"}`,
        c.vencidos && `−${c.vencidos} ${c.vencidos === 1 ? "baja" : "bajas"}`,
        c.a_revisar && `${c.a_revisar} a revisar`,
      ].filter(Boolean);
      lineas.push(`✅ ${nombre(f)}: ${cambios.length ? cambios.join(", ") : "sin cambios"}`);
    }
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
  if (o.urlLog) partes.push(o.urlLog);
  return partes.join("\n");
}

/** Sin credenciales de Telegram imprime el mensaje: sirve para probar a mano. */
export async function enviarTelegram(texto: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Telegram devolvió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}
