"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { CATEGORIAS } from "@tarjetazo/core";
import type { ComercioFavorito } from "@/app/api/favoritos/route";
import { BotonFavorito } from "@/components/boton-favorito";
import { LogoComercio } from "@/components/logo-comercio";
import { cifraDe, conAlcance, diasDe } from "@/components/explorar/panel-lista";
import { useBilletera } from "@/lib/billetera";
import type { BeneficioListado } from "@/lib/consultas";
import { useFavoritos } from "@/lib/favoritos";
import { colorFuente } from "@/lib/marca";
import { Hasta } from "@/components/hasta";

const LABEL_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.slug, c.label]));
/** Cuántos beneficios se ven por comercio; el resto, en su página. */
const POR_COMERCIO = 4;

type Estado = { cargando: true } | { cargando: false; comercios: ComercioFavorito[]; error: boolean };

/**
 * La lista de Favoritos (#115). Las keys salen del navegador y los datos del
 * API, así que cada visita trae los beneficios del día. Primero los que valen
 * con tus tarjetas.
 */
export function FavoritosCliente() {
  const { keys, cargado } = useFavoritos();
  const { mis, misBancos } = useBilletera();
  const [estado, setEstado] = useState<Estado>({ cargando: true });

  // Pedir de nuevo solo si cambia qué comercios hay, no el orden: sacar uno se
  // resuelve filtrando lo que ya está.
  const pedido = useMemo(() => [...keys].sort().join(","), [keys]);
  useEffect(() => {
    if (!cargado) return;
    if (!pedido) {
      setEstado({ cargando: false, comercios: [], error: false });
      return;
    }
    let vivo = true;
    fetch(`/api/favoritos?keys=${encodeURIComponent(pedido)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { comercios: ComercioFavorito[] }) => vivo && setEstado({ cargando: false, comercios: d.comercios, error: false }))
      .catch(() => vivo && setEstado({ cargando: false, comercios: [], error: true }));
    return () => {
      vivo = false;
    };
  }, [cargado, pedido]);

  const esParaVos = useMemo(() => {
    const productos = new Set(mis);
    const bancos = new Set(misBancos);
    return (b: BeneficioListado) =>
      mis.length > 0 && bancos.has(b.fuente_id) && (b.productos_elegibles.length === 0 || b.productos_elegibles.some((p) => productos.has(p)));
  }, [mis, misBancos]);

  if (!cargado || estado.cargando) {
    return <p className="text-humo mt-8 text-sm">Cargando tus favoritos…</p>;
  }
  if (keys.length === 0) {
    return (
      <div className="border-linea mt-8 rounded-2xl border border-dashed px-6 py-10 text-center">
        <Heart className="text-humo mx-auto size-8" />
        <p className="font-display mt-3 text-lg font-bold">Ni un favorito todavía</p>
        <p className="text-humo mx-auto mt-1 max-w-sm text-sm">
          Tocá el corazón en cualquier comercio y queda guardado acá, con sus descuentos siempre al día.
        </p>
        <Link href="/app" className="bg-tinta mt-5 inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-white">
          Explorar comercios
        </Link>
      </div>
    );
  }
  if (estado.error) {
    return <p className="text-humo mt-8 text-sm">No pudimos traer tus favoritos. Probá de nuevo en un rato.</p>;
  }

  // En el orden en que se guardaron (el último primero) y sin los que se sacaron recién.
  const orden = new Map(keys.map((k, i) => [k, i]));
  const comercios = estado.comercios
    .filter((c) => orden.has(c.guardada))
    .sort((a, b) => orden.get(a.guardada)! - orden.get(b.guardada)!);
  const perdidos = keys.filter((k) => !estado.comercios.some((c) => c.guardada === k));

  return (
    <div className="mt-8 flex flex-col gap-4">
      {comercios.map((c) => {
        // Una respuesta cacheada de antes del deploy no trae `total`.
        const total = c.total ?? c.beneficios.length;
        const beneficios = [...c.beneficios].sort((a, b) => Number(esParaVos(b)) - Number(esParaVos(a)));
        return (
          <section key={c.key} className="border-linea bg-card rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <LogoComercio nombre={c.nombre} logo={c.logo_url} className="size-11" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display truncate text-lg font-bold">
                  <Link href={`/comercio/${c.key}`} className="hover:text-cielo hover:underline">
                    {c.nombre}
                  </Link>
                </h2>
                <p className="text-humo text-xs">
                  {LABEL_CATEGORIA.get(c.categoria) ?? c.categoria} · {total === 0 ? "sin descuentos vigentes" : `${total} ${total === 1 ? "descuento" : "descuentos"}`}
                </p>
              </div>
              <BotonFavorito comercioKey={c.guardada} nombre={c.nombre} compacto />
            </div>
            {beneficios.length > 0 && (
              <ul className="divide-linea mt-3 divide-y">
                {beneficios.slice(0, POR_COMERCIO).map((b) => {
                  const tuya = esParaVos(b);
                  const color = colorFuente(b.fuente_id);
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-2.5">
                      <span className="num w-14 shrink-0 text-xl font-bold" style={{ color: tuya ? color.ink : undefined }}>
                        <Hasta b={b} apilado />
                        {cifraDe(b)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{b.titulo}</span>
                        <span className="text-humo block truncate text-xs">
                          {conAlcance(b)} · {diasDe(b)}
                        </span>
                      </span>
                      {tuya && (
                        <span className="rounded-pill shrink-0 px-2 py-0.5 text-xs font-semibold" style={{ background: color.soft, color: color.ink }}>
                          Para vos
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {total > POR_COMERCIO && (
              <Link href={`/comercio/${c.key}`} className="text-cielo mt-2 inline-block text-sm hover:underline">
                Ver los {total} descuentos
              </Link>
            )}
          </section>
        );
      })}
      {perdidos.length > 0 && (
        <p className="text-humo text-xs">
          {perdidos.length === 1 ? "Un comercio guardado ya no está" : `${perdidos.length} comercios guardados ya no están`} en Tarjetazo.{" "}
          <SacarPerdidos keys={perdidos} />
        </p>
      )}
    </div>
  );
}

function SacarPerdidos({ keys }: { keys: string[] }) {
  const { alternar } = useFavoritos();
  return (
    <button type="button" className="text-cielo cursor-pointer underline underline-offset-2" onClick={() => keys.forEach(alternar)}>
      {keys.length === 1 ? "Sacarlo" : "Sacarlos"} de la lista
    </button>
  );
}
