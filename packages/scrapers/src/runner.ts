import Anthropic from "@anthropic-ai/sdk";
import { hash } from "./http.js";
import { normalizar, usarReglasDb } from "./normalizador.js";
import { cargarReglasDb } from "./reglas-db.js";
import { aRestaurar } from "./restaurar.js";
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
  marcarPaginaVista,
  firmaTramo,
  marcarVencidos,
  tramosDePagina,
  idsDescartados,
  restaurarBeneficios,
  tramosGuardados,
  recalcularDerivados,
  resolverRevisionesDePagina,
  upsertBeneficios,
} from "./db.js";
import { reversaIde } from "./geo/ide.js";
import { slugDepartamento } from "./geo/departamentos.js";
import type { UsoModelo } from "@tarjetazo/core";
import type { Crudo, Extraido } from "./tipos.js";

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
  tokens: UsoModelo;
}

/** Solo las columnas de `pagina_cruda`: el crudo trae además sus sucursales. */
type Resultado = "beneficios" | "no_es_beneficio" | "sin_tramos";

/** Por qué una página dejó (o no) beneficios; lo muestra Salud de datos (#35). */
function resultadoDe(e: Extraido): Resultado {
  if (e.es_beneficio === false) return "no_es_beneficio";
  return e.beneficios.length > 0 ? "beneficios" : "sin_tramos";
}

function filaDePagina(
  crudo: Crudo,
  hash: string,
  normalizada_en: string | null,
  resultado: { resultado: Resultado; tramos: number } | null = null,
) {
  return {
    fuente_id: crudo.fuente_id,
    external_id: crudo.external_id,
    url_fuente: crudo.url_fuente,
    contenido: crudo.contenido,
    hash,
    fetched_at: crudo.fetched_at,
    normalizada_en,
    // Solo se llega acá con contenido nuevo (o forzado a re-normalizar): el
    // camino "sin cambios" usa `marcarPaginaVista`, que no toca esto.
    hash_desde: new Date().toISOString(),
    resultado: resultado?.resultado ?? null,
    tramos: resultado?.tramos ?? null,
  };
}

/** `fuente:external_id:n` — determinista, para que el upsert sea idempotente. */
function idBeneficio(fuenteId: string, externalId: string, n: number): string {
  return `${fuenteId}:${externalId}:${n}`;
}

export interface OpcionesCorrida {
  fuenteId: string;
  fetch: () => Promise<Crudo[]>;
  /**
   * Normalizador determinista para fuentes con plantilla fija (BBVA). Si está,
   * la fuente nunca pasa por el modelo y no cuesta nada.
   */
  normalizar?: (crudo: Crudo) => Extraido;
  /** Corre el pipeline sin escribir en Supabase ni llamar a Claude. */
  soloFetch?: boolean;
  /** Tope de páginas a normalizar, para probar sin gastar la corrida entera. */
  limite?: number;
}

export async function correr(opciones: OpcionesCorrida): Promise<Reporte> {
  const { fuenteId, fetch, normalizar: propio, soloFetch = false, limite } = opciones;
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
    tokens: { entrada: 0, cache_escritura: 0, cache_lectura: 0, salida: 0 },
  };

  try {
    // Adentro del try: si las reglas no se pueden leer, la corrida queda
    // registrada con su error y se ve en el dashboard.
    const reglas = await cargarReglasDb(db);
    usarReglasDb(reglas);

    // El tope también llega al fetch por entorno: las fuentes que bajan cientos
    // de fichas (BBVA) lo usan para no bajar todo cuando solo se prueban unas pocas.
    if (limite !== undefined) process.env.SCRAPER_LIMITE = String(limite);
    const crudos = (await fetch()).slice(0, limite ?? Infinity);
    reporte.paginas = crudos.length;

    const previos = await hashesGuardados(db, fuenteId);
    const existentes = await idsDeBeneficios(db, fuenteId);
    const descartados = await idsDescartados(db, fuenteId);
    const tramosPrevios = await tramosGuardados(db, fuenteId);
    const vistos = new Set<string>();
    const restaurar: string[] = [];

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
        // Si faltó un día y se dio de baja, vuelve a publicarse (#48).
        for (const id of aRestaurar(fuenteId, crudo.external_id, tramosPrevios.get(crudo.external_id), descartados)) {
          vistos.add(id);
          restaurar.push(id);
        }
        await marcarPaginaVista(db, crudo);
        return;
      }

      if (soloFetch) {
        // Queda con `normalizada_en` en null: la próxima corrida real la
        // normaliza aunque el hash coincida.
        await guardarPagina(db, filaDePagina(crudo, h, null));
        return;
      }

      // Las reglas del backoffice (alias, ignorar) actúan en `mapearProductos`.
      // Un normalizador propio no pasa por ahí, pero tampoco manda nombres de
      // tarjeta a la cola: el de BBVA resuelve todo con su plantilla y nunca
      // informa desconocidos, así que no hay nada a lo que ponerle un alias.
      const extraido = propio ? propio(crudo) : await normalizar(crudo, claude);
      // Comercio fusionado desde el backoffice: se escribe en el que quedó, así
      // la corrida no vuelve a crear el duplicado (#25).
      const destino = extraido.comercio && reglas.comercios.get(extraido.comercio.key);
      if (destino && extraido.comercio) {
        extraido.comercio = { ...extraido.comercio, key: destino };
        extraido.beneficios = extraido.beneficios.map((b) => ({ ...b, comercio_key: destino }));
      }
      if (extraido.uso) {
        reporte.tokens.entrada += extraido.uso.entrada;
        reporte.tokens.cache_escritura += extraido.uso.cache_escritura;
        reporte.tokens.cache_lectura += extraido.uso.cache_lectura;
        reporte.tokens.salida += extraido.uso.salida;
      }

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

      // Qué tramos cambiaron de verdad: una página puede cambiar (un banner, la
      // fecha del pie) y dejar los mismos beneficios. Solo lo nuevo o distinto
      // queda marcado con esta corrida (#19).
      const antes = await tramosDePagina(db, fuenteId, crudo.external_id);
      const filas = extraido.beneficios.map((b, n) => {
        const id = idBeneficio(fuenteId, crudo.external_id, n);
        const fila = {
          ...b,
          id,
          fuente_id: fuenteId,
          fetched_at: crudo.fetched_at,
          estado_revision: "ok" as const,
          updated_at: new Date().toISOString(),
        };
        const previo = antes.get(id);
        const cambio = !previo
          ? "nuevo"
          : previo.firma !== firmaTramo(fila)
            ? previo.firma.includes('"descartado"') ? "restaurado" : "actualizado"
            : null;
        return cambio
          ? { ...fila, corrida_id: corridaId, cambio }
          : { ...fila, corrida_id: previo!.corrida_id, cambio: previo!.cambio };
      });

      for (const fila of filas) {
        vistos.add(fila.id);
        if (fila.cambio === "nuevo" && fila.corrida_id === corridaId) reporte.nuevos++;
        else if (fila.corrida_id === corridaId) reporte.actualizados++;
      }
      await upsertBeneficios(db, filas);

      // La página se volvió a leer entera: lo que tenía pendiente en la cola ya
      // no vale (si algo sigue sin resolverse, se encola de nuevo acá abajo).
      await resolverRevisionesDePagina(db, fuenteId, crudo.external_id);

      if (extraido.productos_desconocidos.length > 0) {
        reporte.a_revisar++;
        await encolarRevision(db, {
          fuente_id: fuenteId,
          // La URL no identifica la página (Itaú comparte 2 entre 247): la clave es esta.
          external_id: crudo.external_id,
          raw: { contenido: crudo.contenido, problemas: extraido.productos_desconocidos },
          motivo: extraido.productos_desconocidos.join(" | ").slice(0, 500),
          url_fuente: crudo.url_fuente,
        });
      }

      await guardarPagina(
        db,
        filaDePagina(crudo, h, new Date().toISOString(), {
          resultado: resultadoDe(extraido),
          tramos: extraido.beneficios.length,
        }),
      );
    }

    // Con muchas páginas caídas no se puede distinguir "la fuente lo quitó" de
    // "no pudimos leerlo": dar de baja media fuente por una caída sería peor
    // que no dar de baja nada.
    // Lo restaurado cuenta como actualizado: volvió a la web.
    if (restaurar.length > 0) {
      await restaurarBeneficios(db, restaurar, corridaId);
      reporte.actualizados += restaurar.length;
      console.error(`  ${restaurar.length} beneficios vuelven a publicarse (sus páginas reaparecieron)`);
    }

    const proporcionCaida = crudos.length > 0 ? reporte.fallidas / crudos.length : 0;
    if (limite !== undefined) {
      // Una corrida con tope mira solo unas pocas páginas: el resto no está
      // "vencido", simplemente no se leyó.
      console.error("  corrida parcial (--limite): no se dan de baja beneficios");
    } else if (crudos.length < Math.max(1, previos.size * 0.5)) {
      // El fetch trajo mucho menos que la vez anterior (o nada): casi seguro
      // la fuente bloqueó al scraper. No es que hayan quitado la mitad del
      // catálogo de un día para otro.
      console.error(
        `  el fetch trajo ${crudos.length} páginas contra ${previos.size} conocidas: no se dan de baja beneficios`,
      );
    } else if (proporcionCaida > 0.2) {
      console.error(
        `  ${reporte.fallidas} de ${crudos.length} páginas fallaron: no se dan de baja beneficios en esta corrida`,
      );
    } else {
      const vencidos = [...existentes].filter((id) => !vistos.has(id));
      await marcarVencidos(db, vencidos, corridaId);
      reporte.vencidos = vencidos.length;
    }

    // Después de las bajas: lo que venció por fecha desde ayer sale de los
    // derivados de su comercio aunque la página no haya cambiado.
    if (!soloFetch) {
      const cambiados = await recalcularDerivados(db);
      if (cambiados > 0) console.error(`  derivados recalculados en ${cambiados} comercios`);
    }

    await cerrarCorrida(db, corridaId, {
      paginas: reporte.paginas,
      sin_cambios: reporte.sin_cambios,
      nuevos: reporte.nuevos,
      actualizados: reporte.actualizados,
      vencidos: reporte.vencidos,
      a_revisar: reporte.a_revisar,
      tokens_entrada: reporte.tokens.entrada,
      tokens_cache_escritura: reporte.tokens.cache_escritura,
      tokens_cache_lectura: reporte.tokens.cache_lectura,
      tokens_salida: reporte.tokens.salida,
    });
    return reporte;
  } catch (e) {
    // Lo gastado en el modelo antes de fallar también cuenta.
    await cerrarCorrida(db, corridaId, {
      error: String(e),
      tokens_entrada: reporte.tokens.entrada,
      tokens_cache_escritura: reporte.tokens.cache_escritura,
      tokens_cache_lectura: reporte.tokens.cache_lectura,
      tokens_salida: reporte.tokens.salida,
    });
    throw e;
  }
}
