import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CreditCard, ExternalLink, Info, MapPin, ShieldCheck, Smartphone, Ticket } from "lucide-react";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";
import { CopiarLink } from "@/components/copiar-link";
import { cifra, fichaComercio, labelCategoria, nombreFuente, nombreProducto, pesos, type BeneficioFicha } from "@/lib/comercio";
import { NOMBRES_DIA } from "@/lib/filtros";
import { FUENTES } from "@tarjetazo/core";

export const revalidate = 3600;
export const dynamicParams = true;

const BASE = "https://tarjetazo.uy";
const URL_FUENTE = new Map(FUENTES.map((f) => [f.id, f.url]));

type Props = { params: Promise<{ key: string; fuente: string }> };

async function cargar(key: string, fuente: string) {
  const ficha = await fichaComercio(key);
  if (!ficha) return null;
  const lista = ficha.beneficios.filter((b) => b.fuente_id === fuente);
  if (lista.length === 0) return null;
  return { ...ficha, lista };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key, fuente } = await params;
  const datos = await cargar(key, fuente);
  if (!datos) return { title: "Beneficio no encontrado" };
  const { comercio, lista } = datos;
  const mejor = lista[0]!;
  const titulo = `${cifra(mejor)} en ${comercio.nombre} con ${nombreFuente(fuente)}`;
  const descripcion = `${mejor.descuento_raw.slice(0, 140)}. Tope, días, tarjetas que aplican, cómo usarlo y letra chica, con link a la publicación oficial de ${nombreFuente(fuente)}.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/comercio/${key}/${fuente}` },
    openGraph: { title: titulo, description: descripcion, url: `/comercio/${key}/${fuente}` },
  };
}

const PERIODO: Record<string, string> = { dia: "por día", semana: "por semana", mes: "por mes", compra: "por compra", beneficio: "en total" };
const CANAL: Record<string, string> = { presencial: "en el local", online: "online", ambos: "en el local y online" };
const MECANICA: Record<string, string> = { qr: "pago con QR", nfc: "pago sin contacto", app: "desde la app" };

function Dato({ icono: Icono, label, children }: { icono: typeof Info; label: string; children: React.ReactNode }) {
  return (
    <div className="border-linea bg-card rounded-lg border p-3">
      <p className="text-humo flex items-center gap-1.5 text-xs"><Icono className="size-3.5" /> {label}</p>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}

function Tramo({ b, comercioNombre }: { b: BeneficioFicha; comercioNombre: string }) {
  const dias = b.dias_semana.length === 0 || b.dias_semana.length === 7
    ? "Todos los días"
    : b.dias_semana.map((d) => NOMBRES_DIA[d]!).join(", ");
  const vigencia = b.vigencia_hasta
    ? `Hasta el ${new Date(b.vigencia_hasta + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" })}`
    : "Sin fecha de fin publicada";
  const tarjetas = b.productos_elegibles.length === 0
    ? `Todas las tarjetas de ${nombreFuente(b.fuente_id)}`
    : b.productos_elegibles.map(nombreProducto).join(", ");

  return (
    <article className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">{b.titulo}</h2>
          <p className="text-humo mt-1 text-sm">{b.descuento_raw}</p>
        </div>
        <span className="num text-cielo shrink-0 text-3xl font-bold">{cifra(b)}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Dato icono={CreditCard} label="Tarjetas">{tarjetas}</Dato>
        <Dato icono={CalendarDays} label="Días">{dias}</Dato>
        <Dato icono={Ticket} label="Tope">
          {b.tope_monto != null ? `${pesos(b.tope_monto)} ${PERIODO[b.tope_periodo ?? ""] ?? ""}`.trim() : "Sin tope publicado"}
        </Dato>
        <Dato icono={Info} label="Vigencia">{vigencia}</Dato>
        <Dato icono={MapPin} label="Dónde">
          {CANAL[b.canal] ?? b.canal}
          {b.departamentos.length > 0 && ` · ${b.departamentos.map((d) => d.replace(/-/g, " ")).join(", ")}`}
        </Dato>
        <Dato icono={Smartphone} label="Cómo se paga">
          {b.mecanica.length > 0 ? b.mecanica.map((m) => MECANICA[m] ?? m).join(", ") : "Con la tarjeta, sin requisito especial"}
          {b.requiere_activacion && " · hay que activarlo antes"}
        </Dato>
        {(b.acumulable != null || b.compra_minima != null) && (
          <Dato icono={ShieldCheck} label="Condiciones">
            {[b.acumulable === false && "No acumulable con otras promociones", b.acumulable === true && "Acumulable", b.compra_minima != null && `Compra mínima ${pesos(b.compra_minima)}`].filter(Boolean).join(" · ")}
          </Dato>
        )}
      </div>

      {b.como_usarlo.length > 0 && (
        <section className="mt-5">
          <h3 className="text-humo text-xs font-semibold uppercase tracking-widest">Cómo usarlo en {comercioNombre}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {b.como_usarlo.map((paso, i) => <li key={i}>{paso}</li>)}
          </ol>
        </section>
      )}

      {b.legales_raw && (
        <details className="border-linea mt-5 rounded-lg border p-3 text-sm">
          <summary className="text-humo cursor-pointer text-xs font-semibold uppercase tracking-widest">Letra chica, tal cual la publica {nombreFuente(b.fuente_id)}</summary>
          <p className="text-humo mt-2 whitespace-pre-line">{b.legales_raw}</p>
        </details>
      )}
    </article>
  );
}

export default async function PaginaBeneficio({ params }: Props) {
  const { key, fuente } = await params;
  const datos = await cargar(key, fuente);
  if (!datos) notFound();
  const { comercio, lista } = datos;
  const url = `${BASE}/comercio/${key}/${fuente}`;
  const oficial = lista[0]!.url_fuente || URL_FUENTE.get(fuente) || "#";
  const leido = new Date(lista[0]!.fetched_at).toLocaleDateString("es-UY", { day: "numeric", month: "long" });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${comercio.nombre} con ${nombreFuente(fuente)}`,
    itemListElement: lista.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Offer",
        name: b.titulo,
        description: b.descuento_raw,
        url,
        offeredBy: { "@type": "Organization", name: nombreFuente(fuente), url: URL_FUENTE.get(fuente) },
        itemOffered: { "@type": "Organization", name: comercio.nombre },
        ...(b.vigencia_hasta && { validThrough: b.vigencia_hasta }),
        ...(b.vigencia_desde && { validFrom: b.vigencia_desde }),
      },
    })),
  };

  return (
    <>
      <EncabezadoSitio />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:pb-12">
        <nav aria-label="Migas" className="text-humo text-xs">
          <Link href="/app" className="hover:underline">Beneficios</Link>{" › "}
          <Link href={`/app?cat=${comercio.categoria}`} className="hover:underline">{labelCategoria(comercio.categoria)}</Link>{" › "}
          <Link href={`/comercio/${key}`} className="hover:underline">{comercio.nombre}</Link>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl md:text-4xl">
            {comercio.nombre} <span className="text-humo">con {nombreFuente(fuente)}</span>
          </h1>
          <CopiarLink url={url} />
        </div>

        {lista.map((b) => <Tramo key={b.id} b={b} comercioNombre={comercio.nombre} />)}

        <a
          href={oficial}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className="bg-primary text-primary-foreground mt-8 inline-flex h-11 items-center gap-2 rounded-md px-5 font-medium hover:opacity-90"
        >
          Ver en el sitio de {nombreFuente(fuente)} <ExternalLink className="size-4" />
        </a>
        <p className="text-humo mt-3 text-xs">
          Leído de la fuente el {leido}. El beneficio pertenece a {nombreFuente(fuente)}; la publicación oficial es la que vale.
          Si sos el comercio o la fuente y querés corregir o quitar algo, escribinos a hola@tarjetazo.uy.
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
