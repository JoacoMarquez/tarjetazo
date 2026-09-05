import type { MetadataRoute } from "next";
import { CATEGORIAS } from "@tarjetazo/core";
import { clavesDeComercios } from "@/lib/comercio";
import { createSupabaseClient } from "@/lib/supabase";

const BASE = "https://tarjetazo.uy";

// Las páginas de comercio son el grueso del sitemap y cambian con el cron.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hoy = new Date();
  const fijas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: hoy, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/app`, lastModified: hoy, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ayuda`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    ...CATEGORIAS.map((c) => ({
      url: `${BASE}/app?cat=${c.slug}`,
      lastModified: hoy,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  let comercios: MetadataRoute.Sitemap = [];
  try {
    const [claves, pares] = await Promise.all([
      clavesDeComercios(),
      // Un par comercio+fuente por página de ficha.
      createSupabaseClient()
        .from("beneficio")
        .select("comercio_key, fuente_id")
        .eq("estado_revision", "ok")
        .limit(10000),
    ]);
    const vistos = new Set<string>();
    const fichas: MetadataRoute.Sitemap = [];
    for (const p of pares.data ?? []) {
      const k = `${p.comercio_key}/${p.fuente_id}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      fichas.push({ url: `${BASE}/comercio/${k}`, lastModified: hoy, changeFrequency: "weekly", priority: 0.6 });
    }
    comercios = [
      ...claves.map((c) => ({
        url: `${BASE}/comercio/${c.key}`,
        lastModified: new Date(c.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...fichas,
    ];
  } catch {
    // Sin base (build sin credenciales) el sitemap sale con las fijas: mejor
    // parcial que romper el build.
  }
  return [...fijas, ...comercios];
}
