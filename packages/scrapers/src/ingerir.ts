import { readFileSync } from "node:fs";
import { BeneficioNormalizadoSchema, type BeneficioNormalizado } from "@tarjetazo/core";
import {
  asegurarComercio,
  crearCliente,
  guardarSucursalesDeFuente,
  hashesGuardados,
  upsertBeneficios,
} from "./db.js";
import { reversaIde } from "./geo/ide.js";
import { slugDepartamento } from "./geo/departamentos.js";
import { slugificar } from "./slug.js";

/**
 * Ingesta de beneficios ya normalizados (sin pasar por el modelo): sirve para
 * un backfill hecho a mano o revisado. Pasa por las mismas guardas que el
 * normalizador —schema Zod, ids deterministas, upsert idempotente— y deja el
 * hash de la página como normalizada, así el cron no la vuelve a pagar hasta
 * que la fuente la cambie.
 *
 * Entrada: JSON con una lista de páginas
 *   { fuente_id, external_id, url_fuente, comercio: {nombre, categoria},
 *     tramos: BeneficioNormalizado[] (sin comercio_key/url_fuente),
 *     sucursales?: [{nombre, direccion, lat, lng}] }
 */
interface Pagina {
  fuente_id: string;
  external_id: string;
  url_fuente: string;
  comercio: { nombre: string; categoria: string } | null;
  tramos: Partial<BeneficioNormalizado>[];
  sucursales?: { nombre: string | null; direccion: string; lat: number; lng: number }[];
}

async function main() {
  const archivo = process.argv[2];
  if (!archivo) throw new Error("uso: ingerir <archivo.json>");
  const paginas = JSON.parse(readFileSync(archivo, "utf8")) as Pagina[];
  const db = crearCliente();
  let beneficios = 0, comercios = 0, sucursales = 0, invalidos = 0;

  for (const p of paginas) {
    const hashes = await hashesGuardados(db, p.fuente_id);
    if (!hashes.has(p.external_id)) {
      console.error(`  ${p.external_id}: no está en pagina_cruda, se saltea`);
      continue;
    }
    if (!p.comercio || p.tramos.length === 0) {
      await db.from("pagina_cruda").update({ normalizada_en: new Date().toISOString() })
        .eq("fuente_id", p.fuente_id).eq("external_id", p.external_id);
      continue;
    }
    const comercio_key = slugificar(p.comercio.nombre);
    const filas = [];
    for (const [n, t] of p.tramos.entries()) {
      const parsed = BeneficioNormalizadoSchema.safeParse({ ...t, comercio_key, url_fuente: p.url_fuente });
      if (!parsed.success) {
        invalidos++;
        console.error(`  ${p.external_id} tramo ${n}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        continue;
      }
      filas.push({
        ...parsed.data,
        id: `${p.fuente_id}:${p.external_id}:${n}`,
        fuente_id: p.fuente_id,
        fetched_at: new Date().toISOString(),
        estado_revision: "ok" as const,
        updated_at: new Date().toISOString(),
      });
    }
    if (filas.length === 0) continue;

    await asegurarComercio(db, { key: comercio_key, ...p.comercio });
    comercios++;
    await upsertBeneficios(db, filas);
    beneficios += filas.length;

    const conDepto = [];
    for (const s of p.sucursales ?? []) {
      const r = await reversaIde(s.lat, s.lng);
      const departamento = slugDepartamento(r?.departamento ?? null);
      if (!departamento) continue;
      conDepto.push({
        comercio_key, nombre: s.nombre, direccion: s.direccion, localidad: r?.localidad ?? null,
        departamento, geom: `SRID=4326;POINT(${s.lng} ${s.lat})`, precision: "exacta" as const,
        fuente_direccion: p.fuente_id, geocoded_at: new Date().toISOString(),
      });
    }
    sucursales += await guardarSucursalesDeFuente(db, comercio_key, conDepto);

    await db.from("pagina_cruda").update({ normalizada_en: new Date().toISOString() })
      .eq("fuente_id", p.fuente_id).eq("external_id", p.external_id);
  }
  console.log(`ingeridos: ${beneficios} beneficios en ${comercios} comercios, ${sucursales} sucursales | tramos inválidos: ${invalidos}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
