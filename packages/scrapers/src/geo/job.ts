import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodificar } from "./index.js";
import { reversaIde, localidadesDe } from "./ide.js";
import { localesDeCadenas } from "./osm.js";
import { slugDepartamento, DEPARTAMENTOS } from "./departamentos.js";

/** PostGIS acepta WKT con SRID a través de PostgREST. */
function punto(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export interface ReporteGeo {
  encontrados: number;
  guardados: number;
  sin_departamento: number;
}

/**
 * Trae de OSM las sucursales de las cadenas conocidas. Es la única fuente de
 * direcciones que tenemos hoy: los bancos publican "locales adheridos" sin
 * decir cuáles.
 */
export async function importarDeOsm(db: SupabaseClient): Promise<ReporteGeo> {
  const { data: comercios } = await db.from("comercio").select("key");
  const existentes = new Set((comercios ?? []).map((c) => c.key as string));

  const locales = await localesDeCadenas();
  const reporte: ReporteGeo = { encontrados: locales.length, guardados: 0, sin_departamento: 0 };
  const filas = [];

  for (const l of locales) {
    // Solo importamos locales de comercios que algún beneficio menciona.
    if (!existentes.has(l.comercio_key)) continue;

    let departamento = slugDepartamento(l.estado);
    let direccion = [l.calle, l.numero].filter(Boolean).join(" ");
    let localidad = l.ciudad;

    // OSM casi nunca trae addr:state; el reverse oficial lo completa.
    if (!departamento || !direccion) {
      const r = await reversaIde(l.lat, l.lng);
      departamento ??= slugDepartamento(r?.departamento ?? null);
      direccion ||= r?.direccion_normalizada ?? "";
      localidad ??= r?.localidad ?? null;
    }

    if (!departamento) {
      reporte.sin_departamento++;
      continue;
    }

    filas.push({
      comercio_key: l.comercio_key,
      nombre: l.nombre,
      direccion: direccion || (localidad ?? "sin dirección"),
      localidad,
      departamento,
      geom: punto(l.lat, l.lng),
      precision: l.calle ? "exacta" : "aproximada",
      fuente_direccion: "osm",
      osm_id: l.osm_id,
      geocoded_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    const { error } = await db.from("sucursal").upsert(lote, { onConflict: "osm_id" });
    if (error) throw new Error(`guardando sucursales: ${error.message}`);
    reporte.guardados += lote.length;
  }
  return reporte;
}

/** Geocodifica las sucursales que tienen dirección pero todavía no tienen punto. */
export async function geocodificarPendientes(db: SupabaseClient): Promise<ReporteGeo> {
  const { data, error } = await db
    .from("sucursal")
    .select("id, direccion, localidad, departamento")
    .is("geom", null);
  if (error) throw new Error(`leyendo sucursales: ${error.message}`);

  const reporte: ReporteGeo = { encontrados: data?.length ?? 0, guardados: 0, sin_departamento: 0 };
  for (const s of data ?? []) {
    const texto = [s.direccion, s.localidad, s.departamento].filter(Boolean).join(", ");
    const p = await geocodificar(db, texto);
    if (!p) continue;
    const { error: e } = await db
      .from("sucursal")
      .update({
        geom: punto(p.lat, p.lng),
        precision: p.precision,
        fuente_direccion: p.fuente,
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (e) throw new Error(`guardando punto: ${e.message}`);
    reporte.guardados++;
  }
  return reporte;
}

/** Localidades del país, para que el mapa pueda centrarse en una zona. */
export async function importarLocalidades(db: SupabaseClient): Promise<ReporteGeo> {
  const reporte: ReporteGeo = { encontrados: 0, guardados: 0, sin_departamento: 0 };

  for (const depto of DEPARTAMENTOS) {
    const nombre = depto.replace(/-/g, " ").toUpperCase();
    const locs = await localidadesDe(nombre);
    reporte.encontrados += locs.length;

    const filas = [];
    for (const l of locs) {
      const p = await geocodificar(db, `${l.nombre}, ${nombre}`);
      filas.push({
        id: l.id,
        nombre: l.nombre,
        departamento: depto,
        codigo_postal: l.codigoPostal,
        geom: p ? punto(p.lat, p.lng) : null,
      });
    }
    if (filas.length === 0) continue;
    const { error } = await db.from("localidad").upsert(filas, { onConflict: "id" });
    if (error) throw new Error(`guardando localidades de ${depto}: ${error.message}`);
    reporte.guardados += filas.length;
  }
  return reporte;
}
