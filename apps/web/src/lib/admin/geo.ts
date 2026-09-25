import "server-only";

import { Departamento } from "@tarjetazo/core";

/**
 * Geocodificar una dirección cargada a mano con el servicio oficial (IDE
 * Uruguay), en dos pasos como en el job de geo: `candidates` interpreta el
 * texto y `find` devuelve el punto. Gratis y sin clave.
 */
const BASE = "https://direcciones.ide.uy/api/v1/geocode";

type Candidato = {
  type: string;
  idCalle: number;
  portalNumber: number | null;
  localidad: string | null;
  departamento: string | null;
  address: string | null;
  lat: number;
  lng: number;
};

const PRECISION: Record<string, string> = {
  CALLEyPORTAL: "exacta",
  POI: "exacta",
  CRUCE: "exacta",
  CALLE: "calle",
  LOCALIDAD: "localidad",
};

async function pedir(ruta: string, params: Record<string, string>): Promise<Candidato[] | null> {
  const url = new URL(`${BASE}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    return res.ok ? ((await res.json()) as Candidato[]) : null;
  } catch {
    return null;
  }
}

export type PuntoIde = {
  lat: number;
  lng: number;
  precision: string;
  direccion: string | null;
  localidad: string | null;
  departamento: string | null;
};

export async function geocodificar(texto: string): Promise<PuntoIde | null> {
  const c = (await pedir("candidates", { q: texto, limit: "5" }))?.[0];
  if (!c) return null;
  const p = (
    await pedir("find", {
      type: c.type,
      idcalle: String(c.idCalle),
      ...(c.portalNumber ? { portal: String(c.portalNumber) } : {}),
      ...(c.departamento ? { departamento: c.departamento } : {}),
      ...(c.localidad ? { localidad: c.localidad } : {}),
    })
  )?.[0];
  if (!p || !(p.lat < -30 && p.lat > -35.2 && p.lng < -53 && p.lng > -58.6)) return null;
  return {
    lat: p.lat,
    lng: p.lng,
    precision: PRECISION[p.type] ?? "aproximada",
    direccion: p.address ?? c.address,
    localidad: p.localidad ?? c.localidad,
    departamento: p.departamento ?? c.departamento,
  };
}

/** "SAN JOSÉ" → "san-jose", como el enum `departamento`; null si no es uno. */
export function slugDepartamento(nombre: string | null): string | null {
  if (!nombre) return null;
  const slug = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
  return (Departamento.options as readonly string[]).includes(slug) ? slug : null;
}
