import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tarjetazo/core"],
  typedRoutes: true,
};

export default nextConfig;
