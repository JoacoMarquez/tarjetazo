// Toda tabla que crean las migraciones tiene que tener RLS. api_guardia solo
// cubre /rpc: una tabla nueva sin `enable row level security` quedaría
// legible y escribible por anon con los permisos por defecto de Supabase.
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const creadas = new Set();
const conRls = new Set();
const nombre = (n) => n.replace(/^public\./i, "").replace(/"/g, "").toLowerCase();

for (const archivo of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  // Sin comentarios: un "create table" en un comentario no cuenta.
  const sql = readFileSync(new URL(archivo, dir), "utf8").replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
    const t = nombre(m[1]);
    if (!t.includes(".")) creadas.add(t);
  }
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w."]+)/gi)) creadas.delete(nombre(m[1]));
  for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?([\w."]+)\s+rename\s+to\s+([\w"]+)/gi)) {
    const [de, a] = [nombre(m[1]), nombre(m[2])];
    if (creadas.delete(de)) creadas.add(a);
    if (conRls.delete(de)) conRls.add(a);
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/gi)) conRls.add(nombre(m[1]));
}

const faltan = [...creadas].filter((t) => !conRls.has(t)).sort();
if (faltan.length > 0) {
  console.error(`Tablas sin "enable row level security": ${faltan.join(", ")}`);
  process.exit(1);
}
console.log(`RLS ok en ${creadas.size} tablas`);
