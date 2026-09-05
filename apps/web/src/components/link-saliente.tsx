"use client";

import type { ReactNode } from "react";
import { capturar } from "@/lib/analitica";

/**
 * Link al sitio de una fuente con evento de salida. Hoy sirve para saber qué
 * bancos despiertan interés; el día que haya afiliación, es el mismo evento.
 */
export function LinkSaliente({
  href,
  fuente,
  desde,
  className,
  children,
}: {
  href: string;
  fuente: string;
  desde: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className={className}
      onClick={() => capturar("click_saliente", { fuente, desde, destino: href })}
    >
      {children}
    </a>
  );
}
