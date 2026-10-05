import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// En el monorepo las claves viven en el .env de la raíz, que Next no mira:
// solo lee el de su propio directorio. En Vercel las variables ya vienen del
// entorno y el archivo no existe, así que el fallo es esperable.
try {
  // fileURLToPath y no `.pathname`: el path del proyecto tiene espacios y
  // `.pathname` los devuelve percent-encodeados, así que el archivo no existe.
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Sin archivo local seguimos con las variables del entorno.
}

const dev = process.env.NODE_ENV !== "production";
const preview = process.env.VERCEL_ENV === "preview";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const TURNSTILE = "https://challenges.cloudflare.com";
// La barra de comentarios de Vercel solo se inyecta en los previews.
const VERCEL_LIVE = preview ? " https://vercel.live" : "";

/**
 * CSP sin nonce: un nonce obliga a renderizar cada pedido y las páginas
 * públicas son ISR, así que los scripts inline de Next quedan permitidos con
 * 'unsafe-inline'. Igual corta scripts de otros hosts, que nos embeban,
 * <base>, <object> y formularios hacia afuera. Imágenes de cualquier https:
 * el backoffice muestra fotos sugeridas de los sitios de cada banco. Un
 * servicio de terceros nuevo en el navegador hay que sumarlo acá.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${TURNSTILE}${VERCEL_LIVE}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase}${VERCEL_LIVE}`,
  `frame-src ${TURNSTILE}${VERCEL_LIVE}`,
  // La grabación de sesiones de PostHog comprime en un worker creado desde un blob.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const CABECERAS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // "Cerca tuyo" y el mapa piden la ubicación; el resto no se usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), browsing-topics=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@tarjetazo/core"],
  images: {
    // Solo las fotos de tarjeta del bucket público (components/foto-tarjeta.tsx).
    remotePatterns: [
      { protocol: "https", hostname: new URL(supabase).hostname, pathname: "/storage/v1/object/public/tarjetas/**" },
    ],
    // Cada foto se sube con un nombre nuevo (frente-<hash>): nunca cambia.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Solo webp: cada formato cuenta como una transformación aparte en Vercel.
    formats: ["image/webp"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      // El proxy de PostHog manda su propia CSP (sandbox) en lib/ingest.ts.
      { source: "/((?!ingest/).*)", headers: CABECERAS },
    ];
  },
  typedRoutes: true,
  // PostHog (#114) va por un proxy propio (app/ingest/[...ruta]), que no
  // reenvía las cookies. Sus endpoints llevan barra final; sin esto Next la
  // saca y redirige.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Las fotos de tarjeta suben por server action (#26). El default es 1 MB;
    // el recorte sale en ~200 KB, pero un PNG de Safari puede pasar el mega.
    // Vercel corta en 4,5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
