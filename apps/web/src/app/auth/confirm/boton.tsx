"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Se deshabilita mientras corre: el token es de un solo uso. */
export function BotonConfirmar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="mt-6 h-12 w-full text-[15px] font-semibold">
      {pending ? "Un momento…" : children}
    </Button>
  );
}
