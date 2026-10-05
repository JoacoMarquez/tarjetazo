/** País, departamento y ciudad aproximados de una visita, sin la IP. */
export interface Ubicacion {
  pais: string | null;
  region: string | null;
  ciudad: string | null;
}

const decodificar = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return null;
  }
};

/**
 * Vercel ubica cada pedido por IP y lo deja en estas cabeceras. Se usa eso en
 * vez de pasarle la IP a PostHog, que la tiene configurada para descartarla.
 */
export function ubicacionDeCabeceras(h: Headers): Ubicacion {
  const pais = h.get("x-vercel-ip-country");
  const region = h.get("x-vercel-ip-country-region");
  return {
    pais: pais && /^[A-Z]{2}$/.test(pais) ? pais : null,
    region: region && /^[A-Z0-9]{1,3}$/.test(region) ? region : null,
    ciudad: decodificar(h.get("x-vercel-ip-city")),
  };
}

/** Las propiedades con los nombres que PostHog usa en sus tableros de Web Analytics. */
export function propiedadesDeUbicacion(u: Ubicacion): Record<string, string> {
  const out: Record<string, string> = {};
  if (u.pais) out.$geoip_country_code = u.pais;
  if (u.region) out.$geoip_subdivision_1_code = u.region;
  if (u.ciudad) out.$geoip_city_name = u.ciudad;
  return out;
}
