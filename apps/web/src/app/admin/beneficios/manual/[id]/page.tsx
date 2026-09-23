import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioManual } from "@/components/admin/formulario-manual";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import type { ValoresManual } from "@/lib/admin/manual";
import { bajaManual, guardarManual } from "../../actions";
import { opcionesFormulario } from "../../datos-formulario";

export const metadata: Metadata = { title: "Editar beneficio manual" };

export default async function EditarManual({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const id = decodeURIComponent((await params).id);
  const { data: b } = await createSupabaseAdmin()
    .from("beneficio")
    .select("*, comercio(nombre, categoria)")
    .eq("id", id)
    .eq("origen", "manual")
    .maybeSingle();
  if (!b) notFound();
  const opciones = await opcionesFormulario();
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const inicial: ValoresManual = {
    id,
    fuente_id: b.fuente_id,
    comercio: b.comercio?.nombre ?? b.comercio_key,
    categoria: b.comercio?.categoria ?? "",
    titulo: b.titulo,
    descuento_raw: b.descuento_raw,
    tipo: b.tipo,
    porcentaje: s(b.porcentaje),
    cuotas: s(b.cuotas),
    dias_semana: b.dias_semana ?? [],
    productos_elegibles: b.productos_elegibles ?? [],
    vigencia_desde: s(b.vigencia_desde),
    vigencia_hasta: s(b.vigencia_hasta),
    tope_monto: s(b.tope_monto),
    tope_periodo: s(b.tope_periodo),
    canal: b.canal,
    url_fuente: b.url_fuente,
    nota_manual: s(b.nota_manual),
  };
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/beneficios" className="text-pizarra text-sm hover:underline">← Beneficios</Link>
      <h1 className="mt-2 text-2xl">Editar beneficio manual</h1>
      <p className="text-humo-oscuro mt-1 text-xs">
        {b.estado_revision === "ok" ? "Publicado" : "Dado de baja"} · la fuente y el comercio no se cambian: si están mal, dalo de baja y cargalo de nuevo.
      </p>
      <FormularioManual accion={guardarManual} inicial={inicial} {...opciones} />
      {b.estado_revision === "ok" ? (
        <form action={bajaManual} className="mt-8">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="border-coral-ln text-coral-ink hover:bg-coral-s rounded-lg border px-3 py-1.5 text-sm">
            Dar de baja
          </button>
        </form>
      ) : null}
    </div>
  );
}
