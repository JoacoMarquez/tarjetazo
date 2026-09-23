"use client";

import { useActionState, useState } from "react";
import type { EstadoFormulario, ValoresManual } from "@/lib/admin/manual";
import { cn } from "@/lib/utils";

type Opcion = { id: string; nombre: string };
type Producto = { id: string; fuente_id: string; nombre: string };

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const CLASE = "border-linea bg-papel h-9 w-full rounded-lg border px-2 text-sm";

export function FormularioManual({
  accion,
  inicial,
  fuentes,
  productos,
  categorias,
  comercios,
}: {
  accion: (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;
  inicial: ValoresManual;
  fuentes: Opcion[];
  productos: Producto[];
  categorias: Opcion[];
  comercios: string[];
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [fuente, setFuente] = useState(inicial.fuente_id);
  const [tipo, setTipo] = useState(inicial.tipo);
  const [comercio, setComercio] = useState(inicial.comercio);
  const nuevo = comercio.trim() !== "" && !comercios.some((c) => c.toLowerCase() === comercio.trim().toLowerCase());
  const e = estado.errores ?? {};

  return (
    <form action={enviar} className="mt-6 flex max-w-3xl flex-col gap-5">
      {inicial.id ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fuente" error={e.fuente_id}>
          <select name="fuente_id" value={fuente} onChange={(ev) => setFuente(ev.target.value)} className={CLASE} disabled={Boolean(inicial.id)}>
            <option value="">Elegí…</option>
            {fuentes.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
          {inicial.id ? <input type="hidden" name="fuente_id" value={fuente} /> : null}
        </Campo>
        <Campo etiqueta="Comercio" error={e.comercio} ayuda={nuevo ? "Comercio nuevo: se crea al guardar." : undefined}>
          <input name="comercio" list="comercios" value={comercio} onChange={(ev) => setComercio(ev.target.value)} className={CLASE} autoComplete="off" disabled={Boolean(inicial.id)} />
          {inicial.id ? <input type="hidden" name="comercio" value={comercio} /> : null}
          <datalist id="comercios">
            {comercios.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        {nuevo ? (
          <Campo etiqueta="Rubro del comercio nuevo" error={e.categoria}>
            <select name="categoria" defaultValue={inicial.categoria} className={CLASE}>
              <option value="">Elegí…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]">
        <Campo etiqueta="Título" error={e.titulo} ayuda="Como se va a ver: «20% con Prex»">
          <input name="titulo" defaultValue={inicial.titulo} className={CLASE} />
        </Campo>
        <Campo etiqueta="Tipo">
          <select name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as ValoresManual["tipo"])} className={CLASE}>
            <option value="porcentaje">Porcentaje</option>
            <option value="reintegro">Reintegro</option>
            <option value="cuotas">Cuotas</option>
            <option value="2x1">2x1</option>
          </select>
        </Campo>
        {tipo === "cuotas" ? (
          <Campo etiqueta="Cuotas" error={e.cuotas}>
            <input name="cuotas" type="number" min={1} max={36} defaultValue={inicial.cuotas} className={CLASE} />
          </Campo>
        ) : tipo !== "2x1" ? (
          <Campo etiqueta="%" error={e.porcentaje}>
            <input name="porcentaje" type="number" min={1} max={100} step="0.5" defaultValue={inicial.porcentaje} className={CLASE} />
          </Campo>
        ) : (
          <span />
        )}
      </div>

      <Campo etiqueta="Texto del beneficio" ayuda="Lo que dice la promo, tal cual. Si lo dejás vacío se usa el título.">
        <textarea name="descuento_raw" defaultValue={inicial.descuento_raw} rows={2} className="border-linea bg-papel w-full rounded-lg border px-2 py-1 text-sm" />
      </Campo>

      <fieldset>
        <legend className="text-humo-oscuro text-xs font-medium">Tarjetas (ninguna marcada = todas las de la fuente)</legend>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {productos.filter((p) => p.fuente_id === fuente).map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="productos_elegibles" value={p.id} defaultChecked={inicial.productos_elegibles.includes(p.id)} className="size-4" />
              {p.nombre}
            </label>
          ))}
          {fuente === "" ? <p className="text-humo-oscuro text-sm">Elegí la fuente primero.</p> : null}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-humo-oscuro text-xs font-medium">Días (ninguno marcado = todos)</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {DIAS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="dias_semana" value={i} defaultChecked={inicial.dias_semana.includes(i)} className="size-4" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <Campo etiqueta="Desde (opcional)">
          <input name="vigencia_desde" type="date" defaultValue={inicial.vigencia_desde} className={CLASE} />
        </Campo>
        <Campo etiqueta="Hasta" error={e.vigencia_hasta} ayuda="Obligatoria. Al vencer deja de verse.">
          <input name="vigencia_hasta" type="date" defaultValue={inicial.vigencia_hasta} className={CLASE} required />
        </Campo>
        <Campo etiqueta="Tope $ (opcional)" error={e.tope_monto}>
          <input name="tope_monto" type="number" min={0} defaultValue={inicial.tope_monto} className={CLASE} />
        </Campo>
        <Campo etiqueta="Tope por" error={e.tope_periodo}>
          <select name="tope_periodo" defaultValue={inicial.tope_periodo} className={CLASE}>
            <option value="">—</option>
            <option value="compra">compra</option>
            <option value="dia">día</option>
            <option value="semana">semana</option>
            <option value="mes">mes</option>
            <option value="beneficio">beneficio</option>
          </select>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Campo etiqueta="Canal">
          <select name="canal" defaultValue={inicial.canal} className={CLASE}>
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
            <option value="ambos">Ambos</option>
          </select>
        </Campo>
        <Campo etiqueta="Link de dónde lo viste (opcional)" error={e.url_fuente} ayuda="Se muestra como fuente. Sin link, el sitio del banco.">
          <input name="url_fuente" type="url" defaultValue={inicial.url_fuente} className={CLASE} placeholder="https://instagram.com/…" />
        </Campo>
      </div>

      <Campo etiqueta="Nota interna (opcional)" ayuda="Solo se ve en el backoffice.">
        <input name="nota_manual" defaultValue={inicial.nota_manual} className={CLASE} placeholder="Cartel en el local, 22/9" />
      </Campo>

      {estado.error || Object.keys(e).length ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink rounded-lg border px-4 py-3 text-sm">
          {estado.error ?? "Revisá los campos marcados."}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={enviando} className="bg-tinta text-papel rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
          {enviando ? "Guardando…" : inicial.id ? "Guardar cambios" : "Cargar beneficio"}
        </button>
      </div>
    </form>
  );
}

function Campo({ etiqueta, error, ayuda, children }: { etiqueta: string; error?: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-humo-oscuro text-xs font-medium">{etiqueta}</span>
      {children}
      {error ? <span className="text-coral-ink text-xs">{error}</span> : ayuda ? <span className={cn("text-humo-oscuro text-xs")}>{ayuda}</span> : null}
    </label>
  );
}
