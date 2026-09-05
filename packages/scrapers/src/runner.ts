import Anthropic from "@anthropic-ai/sdk";
import { hash } from "./http.js";
import { normalizar } from "./normalizador.js";
import {
  abrirCorrida,
  asegurarComercio,
  cerrarCorrida,
  crearCliente,
  encolarRevision,
  conReintentos,
  guardarPagina,
  guardarSucursalesDeFuente,
  hayCorridaAbierta,
  hashesGuardados,
  idsDeBeneficios,
  marcarVencidos,
  upsertBeneficios,
} from "./db.js";
import { reversaIde } from "./geo/ide.js";
import { slugDepartamento } from "./geo/departamentos.js";
import type { Crudo } from "./tipos.js";

export interface Reporte {
  fuente_id: string;
  paginas: number;
  sin_cambios: number;
  nuevos: number;
  actualizados: number;
  vencidos: number;
  a_revisar: number;
  sucursales: number;
  fallidas: number;
}

/** Solo las columnas de `pagina_cruda`: el crudo trae además sus sucursales. */
function filaDePagina(crudo: Crudo, hash: string, normalizada_en: string | null) {
  return {
    fuente_id: crudo.fuente_id,
    external_id: crudo.external_id,
    url_fuente: crudo.url_fuente,
    contenido: crudo.contenido,
    hash,
    fetched_at: crudo.fetched_at,
    normalizada_en,
  };
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
  if (await hayCorridaAbierta(db, fuenteId)) {
    throw new Error(
      `ya hay una corrida de ${fuenteId} sin terminar; esperá a que cierre o marcala como terminada`,
    );
  }
  const corridaId = await abrirCorrida(db, fuenteId);

  const reporte: Reporte = {
    fuente_id: fuenteId,
    paginas: 0,
    sin_cambios: 0,
    nuevos: 0,
    actualizados: 0,
    vencidos: 0,
    a_revisar: 0,
    sucursales: 0,
    fallidas: 0,
  };

  try {
    const crudos = (await fetch()).slice(0, limite ?? Infinity);
    reporte.paginas = crudos.length;

    const previos = await hashesGuardados(db, fuenteId);
    const existentes = await idsDeBeneficios(db, fuenteId);
    const vistos = new Set<string>();

    for (const crudo of crudos) {
      try {
        await procesarPagina(crudo);
      } catch (e) {
        // Una página que falla no puede tirar abajo la fuente entera: queda
        // registrada y la próxima corrida la vuelve a intentar, porque sin
        // hash guardado no cuenta como "sin cambios".
        reporte.fallidas++;
        // Sus beneficios siguen vigentes: que no hayamos podido leerlos no
        // significa que la fuente los haya dado de baja.
        const prefijo = `${fuenteId}:${crudo.external_id}:`;
        for (const id of existentes) if (id.startsWith(prefijo)) vistos.add(id);
        console.error(`  fallo en ${crudo.external_id}: ${String(e).slice(0, 160)}`);
      }
    }

    async function procesarPagina(crudo: Crudo) {
      const h = await hash(crudo.contenido);
      const sinCambios = previos.get(crudo.external_id) === h;

      if (sinCambios) {
        reporte.sin_cambios++;
        // La página no cambió: sus beneficios siguen vigentes tal cual están.
        const prefijo = `${fuenteId}:${crudo.external_id}:`;
        for (const id of existentes) if (id.startsWith(prefijo)) vistos.add(id);
        await guardarPagina(db, filaDePagina(crudo, h, null));
        return;
      }

      if (soloFetch) {
        await guardarPagina(db, filaDePagina(crudo, h, null));
        return;
      }

      const extraido = await normalizar(crudo, claude);

      // Solo creamos el comercio si la página dejó al menos un beneficio: si
      // no, quedaría un comercio vacío en la web (pasa con las páginas de
      // shoppings, que listan locales sin describir ningún beneficio).
      if (extraido.comercio && extraido.beneficios.length > 0) {
        await asegurarComercio(db, extraido.comercio);

        // Recién acá sabemos a qué comercio pertenecen los locales que la
        // fuente publicó junto al beneficio. El punto ya viene dado; lo único
        // que falta es el departamento, que resuelve el reverse oficial.
        const filas = [];
        for (const s of crudo.sucursales ?? []) {
          const r = await reversaIde(s.lat, s.lng);
          const departamento = slugDepartamento(r?.departamento ?? null);
          if (!departamento) continue;
          filas.push({
            comercio_key: extraido.comercio.key,
            nombre: s.nombre,
            direccion: s.direccion,
            localidad: r?.localidad ?? null,
            departamento,
            geom: `SRID=4326;POINT(${s.lng} ${s.lat})`,
            precision: "exacta" as const,
            fuente_direccion: fuenteId,
            geocoded_at: new Date().toISOString(),
          });
        }
        reporte.sucursales += await guardarSucursalesDeFuente(
          db,
          extraido.comercio.key,
          filas,
        );
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

      await guardarPagina(db, filaDePagina(crudo, h, new Date().toISOString()));
    }

    // Con muchas páginas caídas no se puede distinguir "la fuente lo quitó" de
    // "no pudimos leerlo": dar de baja media fuente por una caída sería peor
    // que no dar de baja nada.
    const proporcionCaida = crudos.length > 0 ? reporte.fallidas / crudos.length : 0;
    if (limite !== undefined) {
      // Una corrida con tope mira solo unas pocas páginas: el resto no está
      // "vencido", simplemente no se leyó.
      console.error("  corrida parcial (--limite): no se dan de baja beneficios");
    } else if (proporcionCaida > 0.2) {
      console.error(
        `  ${reporte.fallidas} de ${crudos.length} páginas fallaron: no se dan de baja beneficios en esta corrida`,
      );
    } else {
      const vencidos = [...existentes].filter((id) => !vistos.has(id));
      await marcarVencidos(db, vencidos);
      reporte.vencidos = vencidos.length;
    }

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
