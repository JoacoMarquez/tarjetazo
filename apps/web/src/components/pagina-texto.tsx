import type { ReactNode } from "react";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";

/** Marco común de las páginas de texto: ayuda, términos y privacidad. */
export function PaginaTexto({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children: ReactNode;
}) {
  return (
    <>
      <EncabezadoSitio />
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:pb-12">
        <h1 className="text-3xl md:text-4xl">{titulo}</h1>
        {bajada && <p className="text-humo mt-2">{bajada}</p>}
        <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_p]:text-humo">
          {children}
        </div>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
