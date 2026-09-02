import type { Punto } from "./tipos.js";
import { BBOX_UY, dentroDeUruguay } from "./tipos.js";

/** La política de uso de Nominatim pide un máximo de 1 req/s y un UA propio. */
const UA = "Tarjetazo/0.1 (+https://tarjetazo.uy; contacto@tarjetazo.uy)";
let ultima = 0;

async function turno() {
  const falta = 1100 - (Date.now() - ultima);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultima = Date.now();
}

interface Resultado {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  address?: { state?: string; city?: string; town?: string; village?: string };
}

export async function geocodificarNominatim(texto: string): Promise<Punto | null> {
  await turno();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", texto);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "uy");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set(
    "viewbox",
    `${BBOX_UY.oeste},${BBOX_UY.norte},${BBOX_UY.este},${BBOX_UY.sur}`,
  );
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const [r] = (await res.json()) as Resultado[];
    if (!r) return null;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!dentroDeUruguay(lat, lng)) return null;

    const a = r.address ?? {};
    return {
      lat,
      lng,
      // Nominatim no distingue bien calle de portal, así que no prometemos más
      // precisión de la que podemos garantizar.
      precision: r.addresstype === "house" ? "exacta" : "aproximada",
      fuente: "nominatim",
      direccion_normalizada: r.display_name,
      departamento: a.state ?? null,
      localidad: a.city ?? a.town ?? a.village ?? null,
    };
  } catch {
    return null;
  }
}
