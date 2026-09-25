import { crearCliente } from "./db.js";
import { geocodificarPendientes, importarDeOsm, importarLocalidades } from "./geo/job.js";
import { sugerirUbicacionesOsm } from "./geo/sugerir.js";

const TAREAS = {
  osm: importarDeOsm,
  pendientes: geocodificarPendientes,
  localidades: importarLocalidades,
};

async function main() {
  const tarea = process.argv[2];
  if (tarea === "sugerir") {
    // Sugerencias de ubicación para el backoffice (/admin/comercios).
    const limite = Number(process.argv[3]) || undefined;
    const r = await sugerirUbicacionesOsm(crearCliente(), limite);
    console.log([`buscados:       ${r.buscados}`, `con resultado:  ${r.con_resultado}`, `sugerencias:    ${r.sugerencias}`].join("\n"));
    return;
  }
  if (!tarea || !(tarea in TAREAS)) {
    console.error(`Uso: geo <tarea>\nTareas: ${[...Object.keys(TAREAS), "sugerir [límite]"].join(", ")}`);
    process.exit(1);
  }
  const r = await TAREAS[tarea as keyof typeof TAREAS](crearCliente());
  console.log(
    [
      `tarea:             ${tarea}`,
      `encontrados:       ${r.encontrados}`,
      `guardados:         ${r.guardados}`,
      `sin departamento:  ${r.sin_departamento}`,
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
