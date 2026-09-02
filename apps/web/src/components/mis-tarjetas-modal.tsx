"use client";

import { useState } from "react";
import { Check, ChevronLeft, Lock } from "lucide-react";
import { FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MisTarjetas } from "@/lib/mis-tarjetas";

function alternar(xs: string[], x: string): string[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

export function MisTarjetasModal({
  abierto,
  onAbrir,
  tarjetas,
  onGuardar,
}: {
  abierto: boolean;
  onAbrir: (v: boolean) => void;
  tarjetas: MisTarjetas;
  onGuardar: (t: MisTarjetas) => void;
}) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [bancos, setBancos] = useState<string[]>(tarjetas.bancos);
  const [productos, setProductos] = useState<string[]>(tarjetas.productos);

  function abrir(v: boolean) {
    if (v) {
      setBancos(tarjetas.bancos);
      setProductos(tarjetas.productos);
      setPaso(1);
    }
    onAbrir(v);
  }

  function guardar() {
    // Los productos de un banco que se destildó no tienen por qué quedar.
    const validos = productos.filter((p) =>
      bancos.includes(PRODUCTOS.find((x) => x.id === p)?.fuente_id ?? ""),
    );
    onGuardar({ bancos, productos: validos });
    onAbrir(false);
  }

  const productosDeMisBancos = PRODUCTOS.filter((p) => bancos.includes(p.fuente_id));

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {paso === 1 ? "¿Con qué pagás?" : "¿Cuáles tenés?"}
          </DialogTitle>
          <DialogDescription>
            {paso === 1
              ? "Elegí tus bancos y billeteras. Después filtramos todo por lo que tenés."
              : "Opcional. Si las elegís, afinamos los descuentos por tier de tarjeta."}
          </DialogDescription>
        </DialogHeader>

        {paso === 1 ? (
          <ul className="grid grid-cols-2 gap-2">
            {FUENTES.map((f) => {
              const activo = bancos.includes(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setBancos(alternar(bancos, f.id))}
                    aria-pressed={activo}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-3 text-left text-sm font-medium transition-colors",
                      activo
                        ? "border-cielo-ln bg-cielo-s text-cielo-ink"
                        : "border-linea bg-card hover:bg-secondary",
                    )}
                  >
                    <span>{f.nombre}</span>
                    {activo && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            {FUENTES.filter((f) => bancos.includes(f.id)).map((f) => (
              <div key={f.id}>
                <p className="text-humo mb-2 text-xs font-semibold uppercase tracking-widest">
                  {f.nombre}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {productosDeMisBancos
                    .filter((p) => p.fuente_id === f.id)
                    .map((p) => {
                      const activo = productos.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setProductos(alternar(productos, p.id))}
                            aria-pressed={activo}
                            className={cn(
                              "rounded-pill border px-3 py-1.5 text-sm transition-colors",
                              activo
                                ? "border-menta-ln bg-menta-s text-menta-ink font-medium"
                                : "border-linea bg-card hover:bg-secondary",
                            )}
                          >
                            {p.nombre}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="text-humo flex items-start gap-2 text-xs">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Nunca te pedimos el número de tu tarjeta ni ningún dato personal. Esto queda
          guardado en tu navegador.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          {paso === 2 ? (
            <Button variant="ghost" onClick={() => setPaso(1)}>
              <ChevronLeft /> Volver
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {paso === 1 && bancos.length > 0 && (
              <Button variant="outline" onClick={() => setPaso(2)}>
                Elegir tarjetas
              </Button>
            )}
            <Button onClick={guardar} disabled={bancos.length === 0}>
              Listo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
