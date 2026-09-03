import type { MetadataRoute } from "next";
import { CATEGORIAS } from "@tarjetazo/core";

const BASE = "https://tarjetazo.uy";

export default function sitemap(): MetadataRoute.Sitemap {
  const hoy = new Date();
  return [
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
}
