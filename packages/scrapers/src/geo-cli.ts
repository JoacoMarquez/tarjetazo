import { crearCliente } from "./db.js";
import { geocodificarPendientes, importarDeOsm, importarLocalidades } from "./geo/job.js";

const TAREAS = {
  osm: importarDeOsm,
  pendientes: geocodificarPendientes,
  localidades: importarLocalidades,
};

async function main() {
  const tarea = process.argv[2] as keyof typeof TAREAS | undefined;
  if (!tarea || !TAREAS[tarea]) {
    console.error(`Uso: geo <tarea>\nTareas: ${Object.keys(TAREAS).join(", ")}`);
    process.exit(1);
  }
  const r = await TAREAS[tarea](crearCliente());
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
