import { fetchBrou } from "./fuentes/brou.js";
import { fetchItau } from "./fuentes/itau.js";
import { fetchItauLandings } from "./fuentes/itau-landings.js";
import { fetchOca } from "./fuentes/oca.js";
import { fetchSantander } from "./fuentes/santander.js";
import { correr } from "./runner.js";
import { revalidarRevisiones } from "./revision.js";
import { crearCliente } from "./db.js";

const SCRAPERS: Record<string, () => Promise<import("./tipos.js").Crudo[]>> = {
  brou: fetchBrou,
  santander: fetchSantander,
  // El feed trae las campañas; las landings, los comercios adheridos que el
  // feed resume en un solo "15% menos en restaurantes".
  itau: async () => [...(await fetchItau()), ...(await fetchItauLandings())],
  oca: fetchOca,
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
         scraper destrabar    (cierra corridas que quedaron interrumpidas)`);
    process.exit(1);
  }

  const reporte = await correr({ fuenteId, fetch, soloFetch, limite });
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
