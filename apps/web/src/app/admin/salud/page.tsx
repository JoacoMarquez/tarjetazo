import type { Metadata, Route } from "next";
import Link from "next/link";
import { FUENTES } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { fechaHora, numero } from "@/lib/admin/formato";
import { urlInspector } from "@/lib/admin/paginas";
import {
  ACCIONABLES,
  HALLAZGOS,
  armarResumen,
  type ComercioSinSucursal,
  type Inconsistencia,
  type MetricaGeo,
  type PaginaVacia,
  type PaginasFuente,
  type ParParecido,
  type Manual,
  type Sospechoso,
  type Salto,
  type TipoHallazgo,
} from "@/lib/admin/salud";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Salud de datos" };

/** Filas que se listan por sección; el contador de arriba siempre es el total. */
const LIMITE = 200;

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
const fuente = (id: string | null) => (id ? (NOMBRE_FUENTE.get(id) ?? id) : "—");

const ETIQUETA_GEO: Record<string, string> = {
  sucursales: "Sucursales",
  sucursales_sin_coordenadas: "Sin coordenadas",
  precision_exacta: "Precisión exacta",
  precision_calle: "Precisión calle",
  precision_localidad: "Precisión localidad",
  precision_aproximada: "Precisión aproximada",
  precision_sin_dato: "Con coordenadas, sin precisión",
  cache_consultas: "Consultas en caché",
  cache_sin_resultado: "Caché sin resultado",
};

const INCONSISTENCIAS: TipoHallazgo[] = [
  "porcentaje_alto",
  "derivados_desfasados",
  "sin_productos",
  "vencido_publicado",
  "comercio_en_otros",
];

export default async function Salud() {
  await exigirAdmin();
  const db = createSupabaseAdmin();

  const [resumen, paginas, vacias, saltos, incons, parecidos, sinSucursal, geo, frescura, manuales] =
    await Promise.all([
      db.rpc("salud_resumen"),
      db.rpc("salud_paginas"),
      db.rpc("salud_paginas_vacias", { p_limite: LIMITE }),
      db.rpc("salud_saltos"),
      // Sin tope bajo: son cinco tipos en una sola lista y el recorte es por tipo, acá.
      db.rpc("salud_inconsistencias", { p_limite: 5000 }),
      db.rpc("salud_nombres_parecidos", { p_limite: LIMITE }),
      db
        .rpc("salud_comercios_sin_sucursal", { p_limite: LIMITE }),
      db.rpc("salud_geocoding"),
      db.rpc("salud_frescura", { p_dias: 180, p_limite: LIMITE }),
      db.rpc("salud_manuales", { p_dias: 7 }),
    ]);

  const fallo = [resumen, paginas, vacias, saltos, incons, parecidos, sinSucursal, geo, frescura, manuales].find(
    (r) => r.error,
  )?.error;
  if (fallo) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl">Salud de datos</h1>
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudieron correr los chequeos: {fallo.message}. Si falta una
          función <code>salud_*</code>, hay que aplicar la migración (
          <code>supabase db push</code>).
        </p>
      </div>
    );
  }

  // El cliente no tiene tipos generados: `data` de un rpc llega como `any`.
  const cuenta = armarResumen(resumen.data);
  const dPaginas = (paginas.data ?? []) as PaginasFuente[];
  const dVacias = (vacias.data ?? []) as PaginaVacia[];
  const dSaltos = (saltos.data ?? []) as Salto[];
  const dIncons = (incons.data ?? []) as Inconsistencia[];
  const dParecidos = (parecidos.data ?? []) as ParParecido[];
  const dSinSucursal = (sinSucursal.data ?? []) as ComercioSinSucursal[];
  const dGeo = (geo.data ?? []) as MetricaGeo[];
  const porTipo = (t: TipoHallazgo) => dIncons.filter((i) => i.tipo === t);
  const orden: TipoHallazgo[] = [
    ...ACCIONABLES,
    ...(Object.keys(HALLAZGOS) as TipoHallazgo[]).filter((t) => !ACCIONABLES.includes(t)),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl">Salud de datos</h1>
      <p className="text-pizarra mt-1 text-sm">
        Chequeos sobre lo que ya está en la base. Los primeros cuatro piden
        hacer algo; el resto es contexto.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {orden.map((t) => {
          const n = cuenta[t] ?? 0;
          const alerta = n > 0 && ACCIONABLES.includes(t);
          return (
            <li key={t}>
              <a
                href={`#${t}`}
                className={cn(
                  "block h-full rounded-xl border px-4 py-3",
                  alerta ? "border-coral-ln bg-coral-s" : "border-linea bg-papel hover:bg-papel-1",
                )}
              >
                <span className="font-display block text-xl font-bold tabular-nums">
                  {numero(n)}
                </span>
                <span className="text-pizarra text-xs">{HALLAZGOS[t].titulo}</span>
              </a>
            </li>
          );
        })}
      </ul>

      {(["manual_por_vencer", "manual_duplicado"] as const).map((t) => {
        const filas = ((manuales.data ?? []) as Manual[]).filter((m) => m.tipo === t);
        return (
          <Seccion key={t} tipo={t} total={cuenta[t]}>
            <Detalle n={filas.length} total={cuenta[t]} abierto>
              <Tabla
                cabeceras={["Comercio", "Beneficio", "Vence", ""]}
                filas={filas.map((m) => ({
                  key: m.beneficio_id,
                  alerta: false,
                  celdas: [
                    <EnlaceComercio key="c" k={m.comercio_key} nombre={m.comercio} />,
                    m.titulo,
                    m.vigencia_hasta.split("-").reverse().join("/"),
                    <Link
                      key="e"
                      href={`/admin/beneficios/manual/${encodeURIComponent(m.beneficio_id)}` as Route}
                      className="text-cielo-ink hover:underline"
                    >
                      Editar
                    </Link>,
                  ],
                }))}
              />
            </Detalle>
          </Seccion>
        );
      })}

      <Seccion tipo="saltos" total={cuenta.saltos}>
        <Tabla
          cabeceras={["Fuente", "Última corrida", "Páginas", "Antes", "Variación", "Nuevos", "Bajas", "Bajas / activos"]}
          numericas={[2, 3, 4, 5, 6, 7]}
          filas={dSaltos.map((s) => ({
            key: s.fuente_id,
            alerta: s.alerta,
            celdas: [
              fuente(s.fuente_id),
              <Link
                key="c"
                href={`/admin/corridas/${s.corrida_id}`}
                className="text-cielo-ink hover:underline"
              >
                {fechaHora(s.empezo_en)}
              </Link>,
              numero(s.paginas),
              s.paginas_anterior === null ? "—" : numero(s.paginas_anterior),
              pct(s.variacion_paginas_pct, true),
              numero(s.nuevos),
              numero(s.vencidos),
              pct(s.bajas_pct),
            ],
          }))}
        />
      </Seccion>

      <Seccion tipo="paginas_sin_beneficios" total={cuenta.paginas_sin_beneficios}>
        <Tabla
          cabeceras={["Fuente", "Páginas", "Con beneficios", "No son beneficio", "Sin beneficios"]}
          numericas={[1, 2, 3, 4]}
          filas={dPaginas.map((p) => ({
            key: p.fuente_id,
            alerta: false,
            celdas: [
              fuente(p.fuente_id),
              numero(p.paginas),
              numero(p.con_beneficios),
              numero(p.no_son_beneficio),
              numero(p.sin_beneficios),
            ],
          }))}
        />
        <Detalle n={dVacias.length} total={cuenta.paginas_sin_beneficios}>
          <Tabla
            cabeceras={["Fuente", "Página", "Motivo", "Bajada"]}
            filas={dVacias.map((v) => ({
              key: `${v.fuente_id}:${v.external_id}`,
              alerta: false,
              celdas: [
                fuente(v.fuente_id),
                <span key="u" className="flex flex-wrap gap-x-3">
                  <Link href={urlInspector(v.fuente_id, v.external_id)} className="text-cielo-ink hover:underline">
                    {v.external_id}
                  </Link>
                  <Externo href={v.url_fuente}>fuente</Externo>
                </span>,
                v.resultado === "sin_tramos" ? "Sin tramos" : "Sin clasificar",
                fechaHora(v.fetched_at),
              ],
            }))}
          />
        </Detalle>
      </Seccion>

      {INCONSISTENCIAS.map((t) => {
        const filas = porTipo(t);
        return (
          <Seccion key={t} tipo={t} total={cuenta[t]}>
            <Detalle n={Math.min(filas.length, LIMITE)} total={cuenta[t]} abierto={ACCIONABLES.includes(t)}>
              <Tabla
                cabeceras={["Comercio", "Fuente", "Detalle", ""]}
                filas={filas.slice(0, LIMITE).map((i) => ({
                  key: `${i.beneficio_id ?? i.comercio_key}`,
                  alerta: false,
                  celdas: [
                    <Link
                      key="c"
                      href={`/comercio/${i.comercio_key}`}
                      className="text-cielo-ink hover:underline"
                    >
                      {i.comercio}
                    </Link>,
                    fuente(i.fuente_id),
                    i.detalle,
                    i.url_fuente ? (
                      <Externo key="u" href={i.url_fuente}>
                        fuente
                      </Externo>
                    ) : (
                      ""
                    ),
                  ],
                }))}
              />
            </Detalle>
          </Seccion>
        );
      })}

      <Seccion tipo="nombres_parecidos" total={cuenta.nombres_parecidos}>
        <Detalle n={dParecidos.length} total={cuenta.nombres_parecidos}>
          <Tabla
            cabeceras={["Comercio A", "Comercio B", "Parecido"]}
            numericas={[2]}
            filas={dParecidos.map((p) => ({
              key: `${p.key_a}|${p.key_b}`,
              alerta: false,
              celdas: [
                <EnlaceComercio key="a" k={p.key_a} nombre={p.nombre_a} n={p.n_a} />,
                <EnlaceComercio key="b" k={p.key_b} nombre={p.nombre_b} n={p.n_b} />,
                `${Math.round(p.similitud * 100)} %`,
              ],
            }))}
          />
        </Detalle>
      </Seccion>

      <Seccion tipo="frescura" total={cuenta.frescura}>
        <Detalle n={((frescura.data ?? []) as Sospechoso[]).length} total={cuenta.frescura} abierto>
          <Tabla
            cabeceras={["Comercio", "Fuente", "Beneficio", "Sin cambios", ""]}
            numericas={[3]}
            filas={((frescura.data ?? []) as Sospechoso[]).map((x) => ({
              key: x.beneficio_id,
              alerta: false,
              celdas: [
                <EnlaceComercio key="c" k={x.comercio_key} nombre={x.comercio} />,
                fuente(x.fuente_id),
                x.titulo,
                `${numero(x.dias)} días`,
                <Link key="i" href={urlInspector(x.fuente_id, x.external_id)} className="text-cielo-ink hover:underline">
                  Inspector
                </Link>,
              ],
            }))}
          />
        </Detalle>
      </Seccion>

      <Seccion tipo="comercios_sin_sucursal" total={cuenta.comercios_sin_sucursal}>
        <Detalle n={dSinSucursal.length} total={cuenta.comercios_sin_sucursal}>
          <Tabla
            cabeceras={["Comercio", "Rubro", "Beneficios"]}
            numericas={[2]}
            filas={dSinSucursal.map((c) => ({
              key: c.comercio_key,
              alerta: false,
              celdas: [
                <EnlaceComercio key="c" k={c.comercio_key} nombre={c.comercio} />,
                c.categoria,
                numero(c.n_beneficios),
              ],
            }))}
          />
        </Detalle>
      </Seccion>

      <section id="geocoding" className="mt-10 scroll-mt-6">
        <h2 className="text-lg">Geocoding</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {dGeo.map((m) => (
            <div key={m.metrica} className="border-linea bg-papel rounded-xl border px-4 py-3">
              <dt className="text-humo-oscuro text-xs font-medium">
                {ETIQUETA_GEO[m.metrica] ?? m.metrica}
              </dt>
              <dd className="font-display mt-1 text-xl font-bold tabular-nums">
                {numero(Number(m.cantidad))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function pct(v: number | null, conSigno = false): string {
  if (v === null) return "—";
  const n = Number(v);
  return `${conSigno && n > 0 ? "+" : ""}${n.toLocaleString("es-UY")} %`;
}

function Seccion({
  tipo,
  total,
  children,
}: {
  tipo: TipoHallazgo;
  total: number | undefined;
  children: React.ReactNode;
}) {
  return (
    <section id={tipo} className="mt-10 scroll-mt-6">
      <h2 className="text-lg">
        {HALLAZGOS[tipo].titulo}{" "}
        <span className="text-humo-oscuro text-sm font-normal tabular-nums">
          {numero(total ?? 0)}
        </span>
      </h2>
      <p className="text-pizarra mt-1 max-w-prose text-sm">{HALLAZGOS[tipo].ayuda}</p>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Lista plegable: con cientos de filas la página se vuelve ilegible si todo viene abierto. */
function Detalle({
  n,
  total,
  abierto,
  children,
}: {
  n: number;
  total: number | undefined;
  abierto?: boolean;
  children: React.ReactNode;
}) {
  if (n === 0) return <p className="text-humo-oscuro text-sm">Nada para mostrar.</p>;
  return (
    <details open={abierto} className="group">
      <summary className="text-cielo-ink cursor-pointer text-sm select-none">
        Ver {numero(n)}
        {total !== undefined && total > n ? ` de ${numero(total)}` : ""}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

type Fila = { key: string; alerta: boolean; celdas: React.ReactNode[] };

function Tabla({
  cabeceras,
  filas,
  numericas = [],
}: {
  cabeceras: string[];
  filas: Fila[];
  numericas?: number[];
}) {
  if (filas.length === 0) return <p className="text-humo-oscuro text-sm">Nada para mostrar.</p>;
  return (
    <div className="border-linea bg-papel overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-humo-oscuro text-left text-xs">
            {cabeceras.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "px-4 py-2 font-medium whitespace-nowrap",
                  numericas.includes(i) && "text-right",
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.key} className={cn("border-linea border-t", f.alerta && "bg-coral-s")}>
              {f.celdas.map((c, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-2 align-top",
                    numericas.includes(i) && "text-right tabular-nums whitespace-nowrap",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Externo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-cielo-ink break-all hover:underline"
    >
      {children} ↗
    </a>
  );
}

function EnlaceComercio({ k, nombre, n }: { k: string; nombre: string; n?: number }) {
  return (
    <>
      <Link href={`/comercio/${k}`} className="text-cielo-ink hover:underline">
        {nombre}
      </Link>
      {n !== undefined ? (
        <span className="text-humo-oscuro text-xs"> · {numero(n)} beneficios</span>
      ) : null}
    </>
  );
}
