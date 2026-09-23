import type { Metadata } from "next";
import Link from "next/link";
import { FormularioManual } from "@/components/admin/formulario-manual";
import { exigirAdmin } from "@/lib/admin";
import { DIAS_DEFAULT, fechaUy } from "@/lib/admin/manual";
import { guardarManual } from "../actions";
import { opcionesFormulario } from "../datos-formulario";

export const metadata: Metadata = { title: "Cargar beneficio" };

export default async function NuevoBeneficio() {
  await exigirAdmin();
  const opciones = await opcionesFormulario();
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/beneficios" className="text-pizarra text-sm hover:underline">← Beneficios</Link>
      <h1 className="mt-2 text-2xl">Cargar un beneficio a mano</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Para lo que ninguna fuente scrapeada publica: un cartel, Instagram, un
        mail del banco. Si la fuente lo publica y no aparece, es un problema del
        scraper: cargarlo a mano lo taparía. Se valida igual que lo scrapeado y
        el cron nunca lo toca; deja de verse cuando vence.
      </p>
      <FormularioManual
        accion={guardarManual}
        inicial={{
          fuente_id: "", comercio: "", categoria: "", titulo: "", descuento_raw: "", tipo: "porcentaje",
          porcentaje: "", cuotas: "", dias_semana: [], productos_elegibles: [], vigencia_desde: "",
          vigencia_hasta: fechaUy(DIAS_DEFAULT), tope_monto: "", tope_periodo: "", canal: "presencial",
          url_fuente: "", nota_manual: "",
        }}
        {...opciones}
      />
    </div>
  );
}
