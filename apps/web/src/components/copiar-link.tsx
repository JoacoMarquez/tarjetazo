"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copia la URL de la página; el portapapeles solo existe en el cliente. */
export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sin permiso de portapapeles (iframes, navegadores viejos): no hay
          // nada que mostrar, la URL está en la barra de direcciones.
        }
      }}
      aria-live="polite"
    >
      {copiado ? <Check /> : <Link2 />}
      {copiado ? "Copiado" : "Copiar link"}
    </Button>
  );
}
