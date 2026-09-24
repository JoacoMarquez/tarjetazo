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

const nextConfig: NextConfig = {
  transpilePackages: ["@tarjetazo/core"],
  typedRoutes: true,
  experimental: {
    // Las fotos de tarjeta suben por server action (#26). El default es 1 MB;
    // el recorte sale en ~200 KB, pero un PNG de Safari puede pasar el mega.
    // Vercel corta en 4,5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
