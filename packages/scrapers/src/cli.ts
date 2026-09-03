import { fetchBrou } from "./fuentes/brou.js";
import { fetchItau } from "./fuentes/itau.js";
import { fetchOca } from "./fuentes/oca.js";
import { fetchSantander } from "./fuentes/santander.js";
import { correr } from "./runner.js";

const SCRAPERS: Record<string, () => Promise<import("./tipos.js").Crudo[]>> = {
  brou: fetchBrou,
  santander: fetchSantander,
  itau: fetchItau,
  oca: fetchOca,
};

async function main() {
  const args = process.argv.slice(2);
  const fuenteId = args[0];
  const soloFetch = args.includes("--solo-fetch");
  const limiteArg = args.find((a) => a.startsWith("--limite="));
  const limite = limiteArg ? Number(limiteArg.split("=")[1]) : undefined;

  const fetch = fuenteId ? SCRAPERS[fuenteId] : undefined;
  if (!fuenteId || !fetch) {
    console.error(`Uso: scraper <fuente> [--solo-fetch] [--limite=N]
Fuentes: ${Object.keys(SCRAPERS).join(", ")}`);
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
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
