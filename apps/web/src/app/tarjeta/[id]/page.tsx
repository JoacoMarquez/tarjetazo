import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  EQUIVALENCIAS_PRODUCTO,
  FAMILIAS_TARJETA,
  FAMILIA_POR_ID,
  PRODUCTOS,
  esTarjeta,
  familiaDe,
  type Familia,
} from "@tarjetazo/core";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior, PieSitio } from "@/components/nav";
import { LinkSaliente } from "@/components/link-saliente";
import { CardBeneficio } from "@/components/card-beneficio";
import { Tarjeta3D } from "@/components/tarjeta-3d";
import { BotonBilletera } from "@/components/tarjeta/boton-billetera";
import { CaraGenerica } from "@/components/tarjeta/cara-generica";
import { listarBeneficios } from "@/lib/consultas";
import { COLUMNAS_FICHA, costoAnual, monto, urlImagen, type Ficha } from "@/lib/fichas";
import { FILTROS_VACIOS } from "@/lib/filtros";
import { FUENTE_POR_ID, pieDeFamilia } from "@/lib/marca";
import { createSupabaseClient } from "@/lib/supabase";

export const revalidate = 3600;
export function generateStaticParams() {
  return FAMILIAS_TARJETA.map((f) => ({ id: f.id }));
}

type Props = { params: Promise<{ id: string }> };
const BASE = "https://tarjetazo.uy";

/**
 * La página es por familia (lo que el banco vende: un pack es una sola). Un id
 * de plástico suelto (`santander-select-debito`) redirige a su familia, y uno
 * dado de baja (`oca-blue`), a la de su equivalente si es uno solo. El saldo
 * de una billetera no es una tarjeta y no tiene página.
 */
function tarjeta(id: string): Familia | null {
  const familia = FAMILIA_POR_ID[id];
  return familia && esTarjeta(familia) ? familia : null;
}

function resolver(id: string): Familia {
  const familia = tarjeta(id);
  if (familia) return familia;
  const p = PRODUCTOS.find((x) => x.id === id);
  if (p && p.activo !== false && tarjeta(familiaDe(p))) permanentRedirect(`/tarjeta/${familiaDe(p)}`);
  const destinos = new Set(
    (EQUIVALENCIAS_PRODUCTO[id] ?? [])
      .map((x) => PRODUCTOS.find((y) => y.id === x))
      .filter((x) => x !== undefined)
      .map(familiaDe),
  );
  const [destino] = destinos;
  if (destinos.size === 1 && destino !== id && tarjeta(destino!)) permanentRedirect(`/tarjeta/${destino}`);
  notFound();
}

async function leerFicha(familiaId: string): Promise<Ficha | null> {
  try {
    const { data } = await createSupabaseClient()
      .from("producto_ficha")
      .select(COLUMNAS_FICHA)
      .eq("familia_id", familiaId)
      .maybeSingle<Ficha>();
    return data;
  } catch {
    // Sin base (build sin credenciales) la página sale sin ficha.
    return null;
  }
}

function tipoDe(f: Familia): string {
  const instrumentos = new Set(f.productos.map((p) => p.instrumento));
  if (f.productos.length > 1 && instrumentos.size > 1) return "Pack de tarjetas";
  if (instrumentos.has("credito")) return "Tarjeta de crédito";
  if (instrumentos.has("debito")) return "Tarjeta de débito";
  if (instrumentos.has("prepaga")) return "Tarjeta prepaga";
  return "Medio de pago";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const familia = tarjeta(id);
  if (!familia) return { title: "Tarjeta no encontrada" };
  const banco = FUENTE_POR_ID[familia.fuente_id]?.nombre ?? familia.fuente_id;
  const ficha = await leerFicha(id);
  const titulo = `${familia.nombre}: costo, requisitos y beneficios`;
  const datos = [
    ficha && costoAnual(ficha) ? `Costo anual: ${costoAnual(ficha)}.` : null,
    ficha?.ingreso_minimo ? `Ingreso mínimo: ${monto(ficha.ingreso_minimo)}.` : null,
  ].filter(Boolean);
  const descripcion = `${tipoDe(familia)} de ${banco}. ${datos.join(" ")} Los descuentos y cuotas que tiene hoy en Uruguay, actualizados a diario.`.replace(/\s+/g, " ");
  const foto = urlImagen(ficha?.imagen_frente);
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/tarjeta/${id}` },
    openGraph: { title: titulo, description: descripcion, url: `/tarjeta/${id}`, ...(foto && { images: [{ url: foto, alt: familia.nombre }] }) },
  };
}

export default async function PaginaTarjeta({ params }: Props) {
  const { id } = await params;
  const familia = resolver(id);
  const fuente = FUENTE_POR_ID[familia.fuente_id]!;
  const ids = familia.productos.map((p) => p.id);
  const filtros = { ...FILTROS_VACIOS, bancos: [familia.fuente_id], productos: ids, soloMisTarjetas: true };

  const [ficha, hoy, todos] = await Promise.all([
    leerFicha(familia.id),
    listarBeneficios({ ...filtros, dia: "hoy", orden: "porcentaje" }, 0, 8).catch(() => ({ beneficios: [], total: 0 })),
    listarBeneficios({ ...filtros, orden: "relevancia" }, 0, 1).catch(() => ({ beneficios: [], total: 0 })),
  ]);

  const tipo = tipoDe(familia);
  const pie = pieDeFamilia(familia);
  const frente = urlImagen(ficha?.imagen_frente);
  const dorso = urlImagen(ficha?.imagen_dorso);
  const oficial = ficha?.url_oficial ?? familia.productos.find((p) => p.url_oficial)?.url_oficial ?? fuente.url;
  const verTodos = `/app?bancos=${familia.fuente_id}&productos=${ids.join(",")}&mias=1`;
  const costo = ficha ? costoAnual(ficha) : null;

  const cuesta: [string, string][] = ficha
    ? ([
        ["Costo anual", costo],
        ["Bonificación", ficha.costo_bonificado],
        ["Ingreso mínimo", ficha.ingreso_minimo ? monto(ficha.ingreso_minimo) : null],
        ["Tasa de interés (TEA)", ficha.tasa_tea != null ? `${ficha.tasa_tea.toLocaleString("es-UY")} %` : null],
      ].filter(([, v]) => v) as [string, string][])
    : [];
  const trae: [string, string][] = ficha
    ? ([
        ["Puntos o millas", ficha.programa],
        ["Salas VIP", ficha.salas_vip],
      ].filter(([, v]) => v) as [string, string][])
    : [];
  const listas: [string, string[]][] = ficha
    ? ([
        ["Seguros", ficha.seguros],
        ["Además", ficha.otros],
        ["Requisitos para pedirla", ficha.requisitos],
      ] as [string, string[]][]).filter(([, v]) => v.length > 0)
    : [];
  const hayFicha = cuesta.length + trae.length + listas.length > 0;

  const esCredito = familia.productos.some((p) => p.instrumento === "credito");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": esCredito ? "CreditCard" : "PaymentCard",
    name: familia.nombre,
    url: `${BASE}/tarjeta/${familia.id}`,
    ...(frente && { image: frente }),
    provider: { "@type": "BankOrCreditUnion", name: fuente.nombre, url: fuente.url },
    ...(ficha?.tasa_tea != null && { annualPercentageRate: ficha.tasa_tea }),
    ...(costo && { feesAndCommissionsSpecification: `Costo anual: ${costo}${ficha?.costo_bonificado ? `. ${ficha.costo_bonificado}` : ""}` }),
    areaServed: { "@type": "Country", name: "Uruguay" },
  };

  return (
    <>
      <EncabezadoSitio />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-4xl px-5 pt-8 pb-24 md:pb-12">
        <nav aria-label="Migas" className="text-humo text-xs">
          <Link href={`/banco/${fuente.id}`} className="hover:underline">{fuente.nombre}</Link>
          <span aria-hidden> / </span>
          <span>Tarjetas</span>
        </nav>

        <div className="mt-4 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="mx-auto w-full max-w-sm">
            {frente ? (
              <Tarjeta3D frente={frente} dorso={dorso} alt={`${familia.nombre} de ${fuente.nombre}`} />
            ) : (
              <CaraGenerica fuenteId={fuente.id} banco={fuente.nombre} nombre={familia.nombre} pie={pie} />
            )}
            {frente && dorso ? <p className="text-humo mt-2 text-center text-xs">Tocala para ver el dorso.</p> : null}
          </div>

          <div>
            <p className="text-humo text-xs font-semibold tracking-widest uppercase">
              {tipo} · {fuente.nombre}
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl">{familia.nombre}</h1>
            <p className="text-humo mt-1 text-sm">{pie}</p>
            <p className="mt-3">
              <span className="num text-cielo text-2xl font-bold">{todos.total}</span>{" "}
              <span className="text-humo">
                {todos.total === 1 ? "beneficio vigente" : "beneficios vigentes"}
                {/* En BBVA casi todo vale todos los días: "330, 330 hoy" no dice nada. */}
                {hoy.total > 0 && hoy.total < todos.total && `, ${hoy.total} hoy`}
              </span>
            </p>
            {costo ? <p className="text-humo mt-1 text-sm">Costo anual: <span className="text-tinta font-medium">{costo}</span></p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <BotonBilletera familiaId={familia.id} />
              <LinkSaliente
                href={ficha?.link_solicitud ?? oficial}
                fuente={fuente.id}
                desde="tarjeta"
                className="border-linea bg-card hover:bg-secondary inline-flex h-10 items-center gap-1.5 rounded-md border px-4 text-sm font-medium"
              >
                {ficha?.link_solicitud ? "Pedirla" : `Ver en ${fuente.nombre}`} <ExternalLink className="size-4" />
              </LinkSaliente>
            </div>
          </div>
        </div>

        {hayFicha ? (
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {cuesta.length + trae.length > 0 ? (
              <section>
                <h2 className="text-humo text-xs font-semibold tracking-widest uppercase">Lo que cuesta y lo que trae</h2>
                <dl className="border-linea bg-card divide-linea mt-3 divide-y rounded-xl border">
                  {[...cuesta, ...trae].map(([k, v]) => (
                    <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <dt className="text-humo text-sm">{k}</dt>
                      <dd className="text-sm">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
            {listas.map(([titulo, items]) => (
              <section key={titulo}>
                <h2 className="text-humo text-xs font-semibold tracking-widest uppercase">{titulo}</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                  {items.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-humo border-linea mt-10 rounded-xl border border-dashed px-4 py-3 text-sm">
            Todavía no cargamos el costo ni los requisitos de esta tarjeta. Están en{" "}
            <LinkSaliente href={oficial} fuente={fuente.id} desde="tarjeta" className="text-cielo underline underline-offset-4">
              la página de {fuente.nombre}
            </LinkSaliente>
            .
          </p>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-humo text-xs font-semibold tracking-widest uppercase">Descuentos con esta tarjeta hoy</h2>
            {todos.total > 0 ? (
              <Link href={verTodos as never} className="text-cielo text-sm underline underline-offset-4">
                Ver los {todos.total} en lista y mapa
              </Link>
            ) : null}
          </div>
          {hoy.beneficios.length === 0 ? (
            <p className="text-humo mt-3 text-sm">
              Hoy no hay descuentos para esta tarjeta.{todos.total > 0 ? " Mirá los de otros días en la lista." : ""}
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {hoy.beneficios.map((b) => <li key={b.id}><CardBeneficio b={b} paraVos={false} /></li>)}
            </ul>
          )}
        </section>

        <p className="text-humo mt-10 text-xs">
          {ficha ? (
            <>
              Datos de la{" "}
              <LinkSaliente href={oficial} fuente={fuente.id} desde="tarjeta" className="underline underline-offset-4">
                página oficial de {fuente.nombre}
              </LinkSaliente>
              , revisados el {new Date(ficha.actualizado_en).toLocaleDateString("es-UY", { timeZone: "America/Montevideo" })}.{" "}
            </>
          ) : null}
          Costos y condiciones cambian: la publicación del banco es la que vale. Esta página resume datos públicos y no es una recomendación financiera.
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
