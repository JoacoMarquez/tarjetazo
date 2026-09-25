"use client";

import { startTransition, useActionState, useState } from "react";
import { RecorteImagen } from "@/components/admin/recorte-imagen";
import { Tarjeta3D } from "@/components/tarjeta-3d";
import { CAMPOS_FICHA, MONEDAS, NOMBRE_MONEDA, type EstadoFicha, type Ficha } from "@/lib/fichas";
import { cn } from "@/lib/utils";

const CLASE = "border-linea bg-papel w-full rounded-lg border px-2 text-sm";

export function FormularioFicha({
  accion,
  familiaId,
  nombre,
  ficha,
  frenteActual,
  dorsoActual,
  urlOficialDefault,
  recortar,
}: {
  accion: (estado: EstadoFicha, form: FormData) => Promise<EstadoFicha>;
  familiaId: string;
  nombre: string;
  ficha: Ficha | null;
  frenteActual: string | null;
  dorsoActual: string | null;
  urlOficialDefault: string | null;
  /** Foto sugerida para recortar a mano como frente; al guardar, la sugerencia queda aceptada. */
  recortar?: { sugerenciaId: string; src: string };
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [frente, setFrente] = useState<string | null>(null);
  const [dorso, setDorso] = useState<string | null>(null);
  const [quitarDorso, setQuitarDorso] = useState(false);
  const e = estado.errores ?? {};
  const dorsoVista = dorso ?? (quitarDorso ? null : dorsoActual);
  // Estable entre renders: RecorteImagen la recarga cada vez que cambia.
  const [inicialFrente] = useState(() => (recortar ? { src: recortar.src, nombre: "Foto sugerida por el banco" } : undefined));

  return (
    // Con onSubmit y no con `action`: React resetea el formulario después de
    // una action, y un error de validación borraría lo que se escribió.
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const datos = new FormData(ev.currentTarget);
        startTransition(() => enviar(datos));
      }}
      className="mt-6 flex flex-col gap-8"
    >
      <input type="hidden" name="familia_id" value={familiaId} />
      {recortar && frente ? <input type="hidden" name="sugerencia_foto" value={recortar.sugerenciaId} /> : null}

      <section id="foto" className="grid scroll-mt-6 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-5 sm:grid-cols-2">
          <RecorteImagen
            name="frente"
            etiqueta={frenteActual ? "Reemplazar el frente" : "Foto del frente"}
            error={e.frente}
            inicial={inicialFrente}
            onCambio={setFrente}
          />
          <div className="flex flex-col gap-2">
            <RecorteImagen name="dorso" etiqueta={dorsoActual ? "Reemplazar el dorso" : "Dorso (opcional)"} error={e.dorso} onCambio={setDorso} />
            {dorsoActual && !dorso ? (
              <label className="text-pizarra flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="quitar_dorso"
                  value="1"
                  checked={quitarDorso}
                  onChange={(ev) => setQuitarDorso(ev.target.checked)}
                  className="size-4"
                />
                Quitar el dorso actual
              </label>
            ) : null}
          </div>
          <p className="text-humo-oscuro text-xs sm:col-span-2">
            La foto se recorta a la proporción de una tarjeta y se guarda al
            apretar «Guardar ficha». Solo el frente es obligatorio para que la
            ficha cuente como completa.
          </p>
        </div>
        <figure className="flex flex-col gap-2">
          <Tarjeta3D frente={frente ?? frenteActual} dorso={dorsoVista} alt={nombre} className="max-w-sm" />
          <figcaption className="text-humo-oscuro text-xs">
            Vista previa{dorsoVista ? ": click para darla vuelta" : ""}.
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_FICHA.map((c) => {
          const valor = ficha?.[c.campo];
          const id = `campo-${c.campo}`;
          return (
            <div key={c.campo} className={cn("flex flex-col gap-1", c.tipo === "lista" && "sm:col-span-2")}>
              <label htmlFor={id} className="text-sm font-medium">
                {c.etiqueta}
              </label>
              {c.tipo === "moneda" ? (
                <select id={id} name={c.campo} defaultValue={(valor as string | null) ?? ""} className={cn(CLASE, "h-9")}>
                  <option value="">—</option>
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m} ({NOMBRE_MONEDA[m]})
                    </option>
                  ))}
                </select>
              ) : c.tipo === "lista" ? (
                <textarea
                  id={id}
                  name={c.campo}
                  rows={Math.min(8, Math.max(3, ((valor as string[] | undefined) ?? []).length + 1))}
                  defaultValue={((valor as string[] | undefined) ?? []).join("\n")}
                  className={cn(CLASE, "py-1.5")}
                />
              ) : (
                <input
                  id={id}
                  name={c.campo}
                  type={c.tipo === "url" ? "url" : "text"}
                  inputMode={c.tipo === "numero" ? "decimal" : undefined}
                  defaultValue={valor == null ? "" : String(valor)}
                  className={cn(CLASE, "h-9")}
                />
              )}
              {"ayuda" in c && c.ayuda ? <p className="text-humo-oscuro text-xs">{c.ayuda}</p> : null}
              {e[c.campo] ? <p className="text-coral-ink text-xs">{e[c.campo]}</p> : null}
            </div>
          );
        })}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="campo-url_oficial" className="text-sm font-medium">
            Página oficial
          </label>
          <input
            id="campo-url_oficial"
            name="url_oficial"
            type="url"
            defaultValue={ficha?.url_oficial ?? urlOficialDefault ?? ""}
            className={cn(CLASE, "h-9")}
          />
          {e.url_oficial ? <p className="text-coral-ink text-xs">{e.url_oficial}</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="bg-tinta text-papel rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? "Guardando…" : "Guardar ficha"}
        </button>
        {estado.ok ? (
          <p role="status" className="text-menta-ink text-sm">
            {estado.ok}
          </p>
        ) : null}
        {estado.error ? (
          <p role="alert" className="text-coral-ink text-sm">
            {estado.error}
          </p>
        ) : null}
        {Object.keys(e).length > 0 ? (
          <p role="alert" className="text-coral-ink text-sm">
            Revisá los campos marcados.
          </p>
        ) : null}
      </div>
    </form>
  );
}
