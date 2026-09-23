"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Submit de un formulario con server action. Se deshabilita mientras corre:
 * aceptar una foto baja la imagen del banco y tarda unos segundos, y un
 * segundo click no tiene que mandarla de nuevo.
 */
export function BotonEnviar({
  children,
  primario,
  title,
}: {
  children: React.ReactNode;
  primario?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap disabled:cursor-wait disabled:opacity-60",
        primario ? "bg-tinta text-papel hover:opacity-90" : "border-linea text-pizarra hover:bg-papel-1 border",
      )}
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}
