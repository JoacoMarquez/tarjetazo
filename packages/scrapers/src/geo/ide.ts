import type { Punto, PrecisionGeo } from "./tipos.js";
import { dentroDeUruguay } from "./tipos.js";

const BASE = "https://direcciones.ide.uy/api/v1/geocode";

/**
 * El geocodificador oficial (IDE Uruguay) resuelve en dos pasos: `candidates`
 * interpreta el texto libre y devuelve la calle normalizada sin coordenadas, y
 * `find` convierte ese candidato en un punto.
 */
interface Candidato {
  type: string;
  idCalle: number;
  nomVia: string | null;
  portalNumber: number | null;
  idLocalidad: number;
  localidad: string | null;
  departamento: string | null;
  address: string | null;
  lat: number;
  lng: number;
  ranking: number;
}

const PRECISION_POR_TIPO: Record<string, PrecisionGeo> = {
  CALLEyPORTAL: "exacta",
  POI: "exacta",
  CRUCE: "exacta",
  CALLE: "calle",
  LOCALIDAD: "localidad",
};

async function pedir<T>(ruta: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(`${BASE}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function geocodificarIde(
  texto: string,
  soloLocalidad = false,
): Promise<Punto | null> {
  const candidatos = await pedir<Candidato[]>("candidates", {
    q: texto,
    limit: "5",
    ...(soloLocalidad ? { soloLocalidad: "true" } : {}),
  });
  const c = candidatos?.[0];
  if (!c) return null;

  const punto = await pedir<Candidato[]>("find", {
    type: c.type,
    idcalle: String(c.idCalle),
    ...(c.portalNumber ? { portal: String(c.portalNumber) } : {}),
    ...(c.departamento ? { departamento: c.departamento } : {}),
    ...(c.localidad ? { localidad: c.localidad } : {}),
  });
  const p = punto?.[0];
  if (!p || !dentroDeUruguay(p.lat, p.lng)) return null;

  return {
    lat: p.lat,
    lng: p.lng,
    precision: PRECISION_POR_TIPO[p.type] ?? "aproximada",
    fuente: "ide_uy",
    direccion_normalizada: p.address ?? c.address,
    departamento: p.departamento ?? c.departamento,
    localidad: p.localidad ?? c.localidad,
  };
}

/**
 * Punto → dirección. Lo usamos para completar el departamento de los locales de
 * OSM, que muchas veces no traen `addr:state`.
 */
export async function reversaIde(lat: number, lng: number): Promise<Punto | null> {
  const r = await pedir<Candidato[]>("reverse", {
    latitud: String(lat),
    longitud: String(lng),
    limit: "1",
  });
  const p = r?.[0];
  if (!p) return null;
  return {
    lat,
    lng,
    precision: PRECISION_POR_TIPO[p.type] ?? "aproximada",
    fuente: "ide_uy",
    direccion_normalizada: p.address,
    departamento: p.departamento,
    localidad: p.localidad,
  };
}

/** Localidades de un departamento, para el buscador de zona del mapa. */
export async function localidadesDe(
  departamento: string,
): Promise<{ id: number; nombre: string; codigoPostal: number | null }[]> {
  const url = new URL("https://direcciones.ide.uy/api/v0/geocode/localidades");
  url.searchParams.set("departamento", departamento);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  return (await res.json()) as { id: number; nombre: string; codigoPostal: number | null }[];
}
