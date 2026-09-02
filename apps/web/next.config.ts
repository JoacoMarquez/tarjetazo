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
};

export default nextConfig;
