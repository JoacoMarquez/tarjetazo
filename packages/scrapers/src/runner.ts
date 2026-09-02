import Anthropic from "@anthropic-ai/sdk";
import { hash } from "./http.js";
import { normalizar } from "./normalizador.js";
import {
  abrirCorrida,
  asegurarComercio,
  cerrarCorrida,
  crearCliente,
  encolarRevision,
  guardarPagina,
  hashesGuardados,
  idsDeBeneficios,
  marcarVencidos,
  upsertBeneficios,
} from "./db.js";
import type { Crudo } from "./tipos.js";

export interface Reporte {
  fuente_id: string;
  paginas: number;
  sin_cambios: number;
  nuevos: number;
  actualizados: number;
  vencidos: number;
  a_revisar: number;
}

/** `fuente:external_id:n` — determinista, para que el upsert sea idempotente. */
function idBeneficio(fuenteId: string, externalId: string, n: number): string {
  return `${fuenteId}:${externalId}:${n}`;
}

export interface OpcionesCorrida {
  fuenteId: string;
  fetch: () => Promise<Crudo[]>;
  /** Corre el pipeline sin escribir en Supabase ni llamar a Claude. */
  soloFetch?: boolean;
  /** Tope de páginas a normalizar, para probar sin gastar la corrida entera. */
  limite?: number;
}

export async function correr(opciones: OpcionesCorrida): Promise<Reporte> {
  const { fuenteId, fetch, soloFetch = false, limite } = opciones;
  const db = crearCliente();
  const claude = new Anthropic();
  const corridaId = await abrirCorrida(db, fuenteId);

  const reporte: Reporte = {
    fuente_id: fuenteId,
    paginas: 0,
    sin_cambios: 0,
    nuevos: 0,
    actualizados: 0,
    vencidos: 0,
    a_revisar: 0,
  };

  try {
    const crudos = (await fetch()).slice(0, limite ?? Infinity);
    reporte.paginas = crudos.length;

    const previos = await hashesGuardados(db, fuenteId);
    const existentes = await idsDeBeneficios(db, fuenteId);
    const vistos = new Set<string>();

    for (const crudo of crudos) {
      const h = await hash(crudo.contenido);
      const sinCambios = previos.get(crudo.external_id) === h;

      if (sinCambios) {
        reporte.sin_cambios++;
        // La página no cambió: sus beneficios siguen vigentes tal cual están.
        const prefijo = `${fuenteId}:${crudo.external_id}:`;
        for (const id of existentes) if (id.startsWith(prefijo)) vistos.add(id);
        await guardarPagina(db, { ...crudo, hash: h, normalizada_en: null });
        continue;
      }

      if (soloFetch) {
        await guardarPagina(db, { ...crudo, hash: h, normalizada_en: null });
        continue;
      }

      const extraido = await normalizar(crudo, claude);

      // Solo creamos el comercio si la página dejó al menos un beneficio: si
      // no, quedaría un comercio vacío en la web (pasa con las páginas de
      // shoppings, que listan locales sin describir ningún beneficio).
      if (extraido.comercio && extraido.beneficios.length > 0) {
        await asegurarComercio(db, extraido.comercio);
      }

      const filas = extraido.beneficios.map((b, n) => ({
        ...b,
        id: idBeneficio(fuenteId, crudo.external_id, n),
        fuente_id: fuenteId,
        fetched_at: crudo.fetched_at,
        estado_revision: "ok" as const,
        updated_at: new Date().toISOString(),
      }));

      for (const fila of filas) {
        vistos.add(fila.id);
        if (existentes.has(fila.id)) reporte.actualizados++;
        else reporte.nuevos++;
      }
      await upsertBeneficios(db, filas);

      if (extraido.productos_desconocidos.length > 0) {
        reporte.a_revisar++;
        await encolarRevision(db, {
          fuente_id: fuenteId,
          raw: { contenido: crudo.contenido, problemas: extraido.productos_desconocidos },
          motivo: extraido.productos_desconocidos.join(" | ").slice(0, 500),
          url_fuente: crudo.url_fuente,
        });
      }

      await guardarPagina(db, {
        ...crudo,
        hash: h,
        normalizada_en: new Date().toISOString(),
      });
    }

    const vencidos = [...existentes].filter((id) => !vistos.has(id));
    await marcarVencidos(db, vencidos);
    reporte.vencidos = vencidos.length;

    await cerrarCorrida(db, corridaId, {
      paginas: reporte.paginas,
      sin_cambios: reporte.sin_cambios,
      nuevos: reporte.nuevos,
      actualizados: reporte.actualizados,
      vencidos: reporte.vencidos,
      a_revisar: reporte.a_revisar,
    });
    return reporte;
  } catch (e) {
    await cerrarCorrida(db, corridaId, { error: String(e) });
    throw e;
  }
}
