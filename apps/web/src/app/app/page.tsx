"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Buscador } from "@/components/buscador";
import { CardBeneficio } from "@/components/card-beneficio";
import { FiltrosBarra } from "@/components/filtros-barra";
import { MisTarjetasModal } from "@/components/mis-tarjetas-modal";
import { useMisTarjetas } from "@/lib/mis-tarjetas";
import { escribirFiltros, leerFiltros, type Filtros } from "@/lib/filtros";
import type { BeneficioListado, Bbox, PuntoMapa } from "@/lib/consultas";

// Leaflet toca `window` al importarse, así que solo puede cargarse en el cliente.
const Mapa = dynamic(() => import("@/components/mapa"), {
  ssr: false,
  loading: () => <div className="bg-papel size-full" />,
});

function Pantalla() {
  const router = useRouter();
  const params = useSearchParams();
  const filtrosUrl = useMemo(() => leerFiltros(new URLSearchParams(params.toString())), [params]);

  const { tarjetas, guardar, cargado, tieneTarjetas } = useMisTarjetas({
    bancos: filtrosUrl.bancos,
    productos: filtrosUrl.productos,
  });

  // La URL manda, pero las tarjetas guardadas la completan cuando no trae nada.
  const filtros: Filtros = useMemo(
    () => ({
      ...filtrosUrl,
      bancos: filtrosUrl.bancos.length ? filtrosUrl.bancos : tarjetas.bancos,
      productos: filtrosUrl.productos.length ? filtrosUrl.productos : tarjetas.productos,
    }),
    [filtrosUrl, tarjetas],
  );

  const [beneficios, setBeneficios] = useState<BeneficioListado[]>([]);
  const [total, setTotal] = useState(0);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [puntos, setPuntos] = useState<PuntoMapa[]>([]);
  const [recortado, setRecortado] = useState(false);
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [irA, setIrA] = useState<[number, number] | null>(null);
  const [vista, setVista] = useState<"lista" | "mapa">("lista");

  const query = useMemo(() => escribirFiltros(filtros).toString(), [filtros]);

  function cambiar(parcial: Partial<Filtros>) {
    const nuevos = { ...filtros, ...parcial };
    router.replace(`/app?${escribirFiltros(nuevos)}`, { scroll: false });
  }

  useEffect(() => {
    if (!cargado) return;
    const control = new AbortController();
    setCargandoLista(true);
    setError(null);
    fetch(`/api/beneficios?${query}`, { signal: control.signal })
      .then((r) => r.json())
      .then((d: { beneficios?: BeneficioListado[]; total?: number; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setBeneficios(d.beneficios ?? []);
        setTotal(d.total ?? 0);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError("No pudimos traer los beneficios.");
      })
      .finally(() => setCargandoLista(false));
    return () => control.abort();
  }, [query, cargado]);

  const pedirPuntos = useCallback(
    (b: Bbox) => {
      const url = new URLSearchParams(query);
      url.set("sur", String(b.sur));
      url.set("oeste", String(b.oeste));
      url.set("norte", String(b.norte));
      url.set("este", String(b.este));
      setCargandoMapa(true);
      fetch(`/api/mapa?${url}`)
        .then((r) => r.json())
        .then((d: { puntos?: PuntoMapa[]; recortado?: boolean }) => {
          setPuntos(d.puntos ?? []);
          setRecortado(Boolean(d.recortado));
        })
        .catch(() => setPuntos([]))
        .finally(() => setCargandoMapa(false));
    },
    [query],
  );

  // Cuando cambian los filtros hay que rehacer la consulta del cuadro visible.
  const ultimoBbox = useRef<Bbox | null>(null);
  useEffect(() => {
    if (ultimoBbox.current) pedirPuntos(ultimoBbox.current);
  }, [pedirPuntos]);

  function moverMapa(b: Bbox) {
    ultimoBbox.current = b;
    setBbox(b);
    pedirPuntos(b);
  }
  void bbox;

  const misProductos = new Set(filtros.productos);
  const misBancos = new Set(filtros.bancos);
  function esParaVos(b: BeneficioListado): boolean {
    if (!tieneTarjetas || !misBancos.has(b.fuente_id)) return false;
    if (b.productos_elegibles.length === 0 || misProductos.size === 0) return true;
    return b.productos_elegibles.some((p) => misProductos.has(p));
  }

  const [modalAbierto, setModalAbierto] = useState(false);

  const lista = (
    <div className="space-y-3">
      {error && (
        <p className="border-coral-ln bg-coral-s text-coral-ink rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {cargandoLista && beneficios.length === 0 && (
        <ul className="space-y-3" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="border-linea bg-card h-28 animate-pulse rounded-lg border" />
          ))}
        </ul>
      )}
      {!cargandoLista && beneficios.length === 0 && !error && (
        <div className="border-linea bg-card rounded-lg border p-8 text-center">
          <p className="font-display text-lg font-bold">No hay nada con esos filtros</p>
          <p className="text-humo mt-1 text-sm">
            Probá sacar el día o el departamento, o sumá otro banco a tus tarjetas.
          </p>
        </div>
      )}
      {beneficios.map((b) => (
        <CardBeneficio
          key={b.id}
          b={b}
          paraVos={esParaVos(b)}
          onElegir={() => {
            const p = puntos.find((x) => x.comercio_key === b.comercio_key);
            if (p) {
              setIrA([p.lat, p.lng]);
              setVista("mapa");
            }
          }}
        />
      ))}
    </div>
  );

  const mapa = (
    <Mapa
      puntos={puntos}
      recortado={recortado}
      cargando={cargandoMapa}
      onMover={moverMapa}
      irA={irA}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-linea bg-hueso z-20 shrink-0 border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display shrink-0 text-xl font-extrabold">
              Tarjeta<span className="bg-marca bg-clip-text text-transparent">zo</span>
            </Link>
            <div className="max-w-md flex-1">
              <Buscador
                params={new URLSearchParams(query)}
                onElegir={(r) => {
                  cambiar({ comercio: r.comercio_key });
                  const p = puntos.find((x) => x.comercio_key === r.comercio_key);
                  if (p) setIrA([p.lat, p.lng]);
                }}
              />
            </div>
          </div>
          <FiltrosBarra
            filtros={filtros}
            onCambiar={cambiar}
            onAbrirTarjetas={() => setModalAbierto(true)}
            tieneTarjetas={tieneTarjetas}
            total={total}
          />
        </div>
      </header>

      {/* Escritorio: lista y mapa lado a lado. */}
      <main className="hidden min-h-0 flex-1 md:flex">
        <section className="w-[420px] shrink-0 overflow-y-auto p-4 lg:w-[480px]">{lista}</section>
        <section className="min-w-0 flex-1">{mapa}</section>
      </main>

      {/* Mobile: una vista por vez, con un botón para alternar. */}
      <main className="relative min-h-0 flex-1 md:hidden">
        <div className={vista === "mapa" ? "size-full" : "hidden"}>{mapa}</div>
        <div className={vista === "lista" ? "h-full overflow-y-auto p-4" : "hidden"}>{lista}</div>
        <Button
          size="sm"
          className="absolute bottom-4 left-1/2 z-1000 -translate-x-1/2 shadow-lg"
          onClick={() => setVista(vista === "lista" ? "mapa" : "lista")}
        >
          {vista === "lista" ? <MapIcon /> : <List />}
          {vista === "lista" ? "Ver mapa" : "Ver lista"}
        </Button>
      </main>

      <MisTarjetasModal
        abierto={modalAbierto}
        onAbrir={setModalAbierto}
        tarjetas={tarjetas}
        onGuardar={(t) => {
          guardar(t);
          router.replace(
            `/app?${escribirFiltros({ ...filtros, bancos: t.bancos, productos: t.productos })}`,
            { scroll: false },
          );
        }}
      />
    </div>
  );
}

export default function PaginaApp() {
  return (
    <Suspense fallback={<div className="bg-hueso h-dvh" />}>
      <Pantalla />
    </Suspense>
  );
}
