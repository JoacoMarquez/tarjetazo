"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { esRutaAdmin, iniciarAnalitica } from "@/lib/analitica";

export function Analitica() {
  const pathname = usePathname();
  useEffect(() => {
    if (!esRutaAdmin(pathname)) void iniciarAnalitica();
  }, [pathname]);
  return null;
}
