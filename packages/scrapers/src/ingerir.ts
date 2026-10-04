import { readFileSync } from "node:fs";
import { BeneficioNormalizadoSchema, type BeneficioNormalizado } from "@tarjetazo/core";
import { asegurarComercio, crearCliente, guardarSucursalesDeFuente, upsertBeneficios } from "./db.js";
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
 * Sirve también para las páginas que un parser propio dejó pendientes: los
 * tramos que la página tenía de antes y ya no están se dan de baja, como en
 * una corrida.
 *
 * Entrada: JSON con una lista de páginas
 *   { fuente_id, external_id, url_fuente, comercio: {nombre, categoria},
 *     tramos: BeneficioNormalizado[] (sin url_fuente; `comercio_key` solo si
 *       el tramo es de otro comercio que ya existe, como `todo-farmacias`),
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
    // Existe aunque esté pendiente (`normalizada_en` null).
    const { data: pagina } = await db
      .from("pagina_cruda").select("external_id")
      .eq("fuente_id", p.fuente_id).eq("external_id", p.external_id).maybeSingle();
    if (!pagina) {
      console.error(`  ${p.external_id}: no está en pagina_cruda, se saltea`);
      continue;
    }
    // Lo que la página tenía y ya no está se da de baja, como en una corrida.
    // Lo oculto por el admin no se toca: pasado a descartado, la restauración
    // de #48 lo volvería a publicar.
    // `_` y `%` son comodines de LIKE: sin escaparlos se mezclan páginas vecinas.
    const esc = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: antes } = await db
      .from("beneficio").select("id, estado_revision")
      .eq("fuente_id", p.fuente_id)
      .like("id", `${esc(p.fuente_id)}:${esc(p.external_id)}:%`)
      .neq("estado_revision", "descartado");
    const ocultos = new Set((antes ?? []).filter((b) => b.estado_revision === "oculto").map((b) => b.id as string));
    const darDeBaja = async (quedan: Set<string>) => {
      const ids = (antes ?? []).map((b) => b.id as string).filter((id) => !quedan.has(id) && !ocultos.has(id));
      if (ids.length === 0) return;
      await db.from("beneficio")
        .update({ estado_revision: "descartado", cambio: "baja", updated_at: new Date().toISOString() })
        .in("id", ids);
    };
    const marcar = (resultado: "beneficios" | "no_es_beneficio", tramos: number) =>
      db.from("pagina_cruda").update({ normalizada_en: new Date().toISOString(), resultado, tramos })
        .eq("fuente_id", p.fuente_id).eq("external_id", p.external_id);

    if (!p.comercio || p.tramos.length === 0) {
      await darDeBaja(new Set());
      await marcar("no_es_beneficio", 0);
      continue;
    }
    // Un comercio fusionado desde el backoffice se escribe en el que quedó,
    // como en una corrida (#25).
    const slug = slugificar(p.comercio.nombre);
    const { data: alias } = await db.from("comercio_alias").select("comercio_key").eq("alias_key", slug).maybeSingle();
    const comercio_key = (alias?.comercio_key as string | undefined) ?? slug;
    const filas = [];
    for (const [n, t] of p.tramos.entries()) {
      const parsed = BeneficioNormalizadoSchema.safeParse({ ...t, comercio_key: t.comercio_key ?? comercio_key, url_fuente: p.url_fuente });
      if (!parsed.success) {
        invalidos++;
        console.error(`  ${p.external_id} tramo ${n}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        continue;
      }
      const id = `${p.fuente_id}:${p.external_id}:${n}`;
      filas.push({
        ...parsed.data,
        id,
        fuente_id: p.fuente_id,
        fetched_at: new Date().toISOString(),
        estado_revision: ocultos.has(id) ? ("oculto" as const) : ("ok" as const),
        updated_at: new Date().toISOString(),
      });
    }
    if (filas.length === 0) continue;

    if (filas.some((f) => f.comercio_key === comercio_key)) {
      await asegurarComercio(db, { key: comercio_key, ...p.comercio });
      comercios++;
    }
    await upsertBeneficios(db, filas);
    beneficios += filas.length;
    await darDeBaja(new Set(filas.map((f) => f.id)));

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

    await marcar("beneficios", filas.length);
  }
  console.log(`ingeridos: ${beneficios} beneficios en ${comercios} comercios, ${sucursales} sucursales | tramos inválidos: ${invalidos}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
