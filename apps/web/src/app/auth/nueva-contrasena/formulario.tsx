"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CLASE_INPUT, CampoForm, mensajeDeError } from "@/app/login/formulario-login";
import { createSupabaseBrowser } from "@/lib/supabase-auth";
import { cn } from "@/lib/utils";

const MINIMO = 8;

export function FormularioNuevaContrasena({ email, destino }: { email: string; destino: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errores, setErrores] = useState<{ password?: string; repetida?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [lista, setLista] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errores = {};
    if (password.length < MINIMO) errs.password = `Mínimo ${MINIMO} caracteres.`;
    if (repetida !== password) errs.repetida = "No coinciden.";
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    setError(null);
    setCargando(true);
    try {
      const { error } = await createSupabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      setLista(true);
      setTimeout(() => {
        router.push(destino as Route);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (lista) {
    return (
      <div role="status">
        <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">Listo</h1>
        <p className="text-humo mt-3 text-sm leading-relaxed">
          Tu contraseña nueva quedó guardada. Te llevamos de vuelta…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
        Elegí una contraseña nueva
      </h1>
      <p className="text-humo mt-3 text-sm">
        Para <strong className="text-tinta">{email}</strong>.
      </p>
      <form onSubmit={guardar} noValidate className="mt-6 flex flex-col gap-3">
        <CampoForm etiqueta="Contraseña nueva" error={errores.password}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={`Mínimo ${MINIMO} caracteres`}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            aria-invalid={Boolean(errores.password)}
            className={cn(CLASE_INPUT, errores.password ? "border-coral" : "border-linea focus:border-tinta")}
          />
        </CampoForm>
        <CampoForm etiqueta="Repetila" error={errores.repetida}>
          <input
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(ev) => setRepetida(ev.target.value)}
            aria-invalid={Boolean(errores.repetida)}
            className={cn(CLASE_INPUT, errores.repetida ? "border-coral" : "border-linea focus:border-tinta")}
          />
        </CampoForm>
        {error ? (
          <p role="alert" className="bg-coral-s text-coral-ink mt-2 rounded-[10px] px-3.5 py-2.5 text-[13px]">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={cargando} className="mt-3 h-12 w-full text-[15px] font-semibold">
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
