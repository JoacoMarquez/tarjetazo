"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { esRutaAdmin, iniciarAnalitica } from "@/lib/analitica";

export function Analitica() {
  const pathname = usePathname();
  useEffect(() => {
    if (!esRutaAdmin(pathname)) iniciarAnalitica();
  }, [pathname]);
  return null;
}

const excluirAdmin: BeforeSend = (evento) =>
  esRutaAdmin(evento.url) ? null : evento;

export function AnaliticaVercel() {
  return <Analytics beforeSend={excluirAdmin} />;
}
