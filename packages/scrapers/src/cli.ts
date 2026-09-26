import { normalizarBbva } from "./fuentes/bbva-parser.js";
import { fetchMidinero, normalizarMidinero } from "./fuentes/midinero.js";
import { fetchNativa, normalizarNativa } from "./fuentes/nativa.js";
import { fetchClubElPais, normalizarClubElPais } from "./fuentes/club-el-pais.js";
import { fetchAnda, normalizarAnda } from "./fuentes/anda.js";
import { fetchBrou } from "./fuentes/brou.js";
import { fetchItau } from "./fuentes/itau.js";
import { fetchItauLandings } from "./fuentes/itau-landings.js";
import { fetchOca } from "./fuentes/oca.js";
import { fetchSantander } from "./fuentes/santander.js";
import { fetchScotiabank } from "./fuentes/scotiabank.js";
import { fetchBbva } from "./fuentes/bbva.js";
import { correr } from "./runner.js";
import { revalidarRevisiones } from "./revision.js";
import { crearCliente, recalcularDerivados } from "./db.js";
import { armarResumen, enviarTelegram } from "./resumen.js";
import { correrCatalogo } from "./catalogo/runner.js";

type Crudo = import("./tipos.js").Crudo;
type Extraido = import("./tipos.js").Extraido;
const NORMALIZADORES: Record<string, (c: Crudo) => Extraido> = {
  bbva: normalizarBbva,
  midinero: normalizarMidinero,
  nativa: normalizarNativa,
  "club-el-pais": normalizarClubElPais,
  anda: normalizarAnda,
};
const SCRAPERS: Record<string, () => Promise<Crudo[]>> = {
  brou: fetchBrou,
  santander: fetchSantander,
  // El feed trae las campañas; las landings, los comercios adheridos que el
  // feed resume en un solo "15% menos en restaurantes".
  itau: async () => [...(await fetchItau()), ...(await fetchItauLandings())],
  oca: fetchOca,
  scotiabank: fetchScotiabank,
  bbva: fetchBbva,
  midinero: fetchMidinero,
  nativa: fetchNativa,
  "club-el-pais": fetchClubElPais,
  anda: fetchAnda,
};

async function main() {
  const args = process.argv.slice(2);
  const fuenteId = args[0];

  // Una corrida interrumpida deja su fila abierta y bloquea la siguiente.
  if (fuenteId === "destrabar") {
    const db = crearCliente();
    const { count, error } = await db
      .from("corrida")
      .update(
        { termino_en: new Date().toISOString(), error: "interrumpida" },
        { count: "exact" },
      )
      .is("termino_en", null);
    if (error) throw new Error(error.message);
    console.log(`corridas interrumpidas cerradas: ${count}`);
    return;
  }

  // Catálogo de tarjetas (#27): semanal, deja sugerencias para la bandeja.
  if (fuenteId === "catalogo") {
    const limiteArg = args.find((a) => a.startsWith("--limite="));
    const fuentes = args.slice(1).filter((a) => !a.startsWith("--"));
    const r = await correrCatalogo(crearCliente(), {
      fuentes: fuentes.length && fuentes[0] !== "todas" ? fuentes : undefined,
      limite: limiteArg ? Number(limiteArg.split("=")[1]) : undefined,
    });
    console.log(`páginas: ${r.paginas} | extraídas: ${r.extraidas} | tarjetas: ${r.tarjetas} | sugerencias nuevas: ${r.sugerencias} | fallidas: ${r.fallidas}`);
    return;
  }

  // Resumen para Telegram: lo corre el workflow al final, pase lo que pase.
  if (fuenteId === "resumen") {
    const cron = Object.keys(SCRAPERS);
    const pedidas = (process.env.RESUMEN_FUENTES ?? "todas").trim();
    let texto: string;
    try {
      texto = await armarResumen(crearCliente(), {
        // Sin inicio conocido, las últimas 12 horas.
        desde: process.env.RESUMEN_DESDE || new Date(Date.now() - 12 * 3600e3).toISOString(),
        fuentes: pedidas === "todas" ? cron : pedidas.split(/[\s,]+/).filter(Boolean),
        urlAdmin: process.env.ADMIN_URL ?? "https://tarjetazo-one.vercel.app/admin",
        urlLog: process.env.RESUMEN_URL_LOG || undefined,
        estadoWorkflow: process.env.RESUMEN_ESTADO || undefined,
        manual: process.env.RESUMEN_MANUAL === "1",
      });
    } catch (e) {
      // Si no se puede ni leer la base, igual avisar: eso también es un problema.
      texto = `🔴 Tarjetazo: no pude armar el resumen\n\n${String(e).slice(0, 300)}\n\n${process.env.RESUMEN_URL_LOG ?? ""}`;
    }
    console.log(texto);
    const enviado = await enviarTelegram(texto);
    console.log(enviado ? "\nenviado a Telegram" : "\n(sin TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: no se envió)");
    return;
  }

  // Recalcular a mano los derivados de comercio (el cron ya lo hace al cerrar).
  if (fuenteId === "derivados") {
    const n = await recalcularDerivados(crearCliente());
    console.log(`derivados recalculados en ${n} comercios`);
    return;
  }

  if (fuenteId === "revisiones") {
    const r = await revalidarRevisiones(crearCliente());
    console.log(`revisadas: ${r.revisadas} | resueltas: ${r.resueltas} | pendientes: ${r.pendientes.length}`);
    for (const p of r.pendientes) console.log(`  [${p.fuente_id}] ${p.motivo.slice(0, 110)}`);
    return;
  }

  const soloFetch = args.includes("--solo-fetch");
  const limiteArg = args.find((a) => a.startsWith("--limite="));
  const limite = limiteArg ? Number(limiteArg.split("=")[1]) : undefined;

  const fetch = fuenteId ? SCRAPERS[fuenteId] : undefined;
  if (!fuenteId || !fetch) {
    console.error(`Uso: scraper <fuente> [--solo-fetch] [--limite=N]
Fuentes: ${Object.keys(SCRAPERS).join(", ")}
También: scraper revisiones   (revalida la cola de revisión manual)
         scraper derivados    (recalcula best_pct / conteos de cada comercio)
         scraper resumen      (arma y manda el resumen diario a Telegram)
         scraper catalogo [santander|brou|bbva] [--limite=N]  (catálogo de tarjetas → sugerencias)
         scraper destrabar    (cierra corridas que quedaron interrumpidas)`);
    process.exit(1);
  }

  const reporte = await correr({ fuenteId, fetch, normalizar: NORMALIZADORES[fuenteId], soloFetch, limite });
  console.log(
    [
      `fuente:       ${reporte.fuente_id}`,
      `páginas:      ${reporte.paginas}`,
      `sin cambios:  ${reporte.sin_cambios}`,
      `nuevos:       ${reporte.nuevos}`,
      `actualizados: ${reporte.actualizados}`,
      `vencidos:     ${reporte.vencidos}`,
      `a revisar:    ${reporte.a_revisar}`,
      `sucursales:   ${reporte.sucursales}`,
      `fallidas:     ${reporte.fallidas}`,
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
