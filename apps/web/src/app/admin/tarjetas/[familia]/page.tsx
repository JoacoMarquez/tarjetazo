import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FAMILIA_POR_ID, FUENTES } from "@tarjetazo/core";
import { FormularioFicha } from "@/components/admin/formulario-ficha";
import { SugerenciasFicha } from "@/components/admin/sugerencias-ficha";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import {
  COLUMNAS_FICHA,
  COLUMNAS_SUGERENCIA,
  completitud,
  urlImagen,
  type Ficha,
  type Sugerencia,
} from "@/lib/fichas";
import { fechaHora } from "@/lib/admin/formato";
import { pieDeTarjeta } from "@/lib/marca";
import { guardarFicha } from "../actions";

type Props = {
  params: Promise<{ familia: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { familia } = await params;
  return { title: FAMILIA_POR_ID[familia]?.nombre ?? "Tarjeta" };
}

export default async function FichaTarjeta({ params, searchParams }: Props) {
  await exigirAdmin();
  const { familia: familiaId } = await params;
  const familia = FAMILIA_POR_ID[familiaId];
  if (!familia) notFound();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const [ficha, sugs] = await Promise.all([
    db.from("producto_ficha").select(COLUMNAS_FICHA).eq("familia_id", familiaId).maybeSingle<Ficha>(),
    db
      .from("producto_ficha_sugerencia")
      .select(COLUMNAS_SUGERENCIA)
      .eq("familia_id", familiaId)
      .eq("estado", "pendiente")
      .order("creada_en"),
  ]);
  const fallo = ficha.error ?? sugs.error;
  if (fallo) {
    return (
      <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink rounded-lg border px-4 py-3 text-sm">
        No se pudo leer la base: {fallo.message}
      </p>
    );
  }

  const fuente = FUENTES.find((f) => f.id === familia.fuente_id)?.nombre ?? familia.fuente_id;
  const pendientes = (sugs.data ?? []) as Sugerencia[];
  const c = completitud(ficha.data);
  const volverA = `/admin/tarjetas/${familiaId}`;
  // «Recortar» en una sugerencia de foto: la copia del scraper en Storage (la
  // del banco no sirve, el canvas no puede leer una imagen de otro origen sin CORS).
  const aRecortar = pendientes.find((s) => s.id === uno(sp.recortar) && s.campo === "imagen" && s.archivo);
  const ok = uno(sp.ok);
  const error = uno(sp.error);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/tarjetas" className="text-pizarra text-sm hover:underline">
        ← Tarjetas
      </Link>
      <h1 className="mt-2 text-2xl">{familia.nombre}</h1>
      <p className="text-pizarra mt-1 text-sm">
        {fuente} · {c.llenos} de {c.total} datos
        {ficha.data ? ` · actualizada ${fechaHora(ficha.data.actualizado_en)}` : " · todavía sin ficha"}
      </p>
      {familia.productos.length > 1 ? (
        <p className="text-humo-oscuro mt-1 text-xs">
          Incluye: {familia.productos.map((p) => `${p.nombre} (${pieDeTarjeta(p)})`).join(", ")}
        </p>
      ) : null}

      {ok ? (
        <p role="status" className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      {pendientes.length > 0 ? (
        <div className="mt-6">
          <SugerenciasFicha
            familiaId={familiaId}
            nombre="Sugerencias del banco"
            fuente={fuente}
            sugerencias={pendientes}
            ficha={ficha.data}
            volverA={volverA}
          />
        </div>
      ) : null}

      {/* La key fuerza a remontar el formulario cuando la ficha cambia (al aceptar una sugerencia) o se pide un recorte. */}
      <FormularioFicha
        key={`${ficha.data?.actualizado_en ?? "nueva"}-${aRecortar?.id ?? ""}`}
        accion={guardarFicha}
        familiaId={familiaId}
        nombre={familia.nombre}
        ficha={ficha.data}
        frenteActual={urlImagen(ficha.data?.imagen_frente)}
        dorsoActual={urlImagen(ficha.data?.imagen_dorso)}
        urlOficialDefault={familia.productos.find((p) => p.url_oficial)?.url_oficial ?? null}
        recortar={aRecortar ? { sugerenciaId: aRecortar.id, src: urlImagen(aRecortar.archivo)! } : undefined}
      />
    </div>
  );
}
