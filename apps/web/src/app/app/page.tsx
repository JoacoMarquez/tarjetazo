"use client";

import dynamic from "next/dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crosshair } from "lucide-react";
import { EncabezadoSitio } from "@/components/encabezado";
import {
  PanelLista,
  type Orden as OrdenLista,
} from "@/components/explorar/panel-lista";
import { PopupComercio } from "@/components/explorar/popup-comercio";
import { RielFiltros } from "@/components/explorar/riel-filtros";
import { useBilletera } from "@/lib/billetera";
import { escribirFiltros, leerFiltros, type Filtros } from "@/lib/filtros";
import { capturar } from "@/lib/analitica";
import type { BeneficioListado, Bbox, PuntoMapa } from "@/lib/consultas";

// Leaflet toca `window` al importarse, así que solo puede cargarse en el cliente.
const Mapa = dynamic(() => import("@/components/mapa"), {
  ssr: false,
  loading: () => (
    <div className="size-full" style={{ background: "#e8ece9" }} />
  ),
});

const ANCHO_RIEL_ABIERTO = 200;
const ANCHO_RIEL_PLEGADO = 56;

function Pantalla() {
  const router = useRouter();
  const params = useSearchParams();
  const filtrosUrl = useMemo(
    () => leerFiltros(new URLSearchParams(params.toString())),
    [params],
  );
  const { mis, misBancos, cargado, abrir } = useBilletera();

  // La URL manda, pero las tarjetas de la billetera la completan cuando no
  // trae nada: quien comparte un link comparte también su selección.
  const filtros: Filtros = useMemo(
    () => ({
      ...filtrosUrl,
      bancos: filtrosUrl.bancos,
      productos: filtrosUrl.productos.length ? filtrosUrl.productos : mis,
    }),
    [filtrosUrl, mis],
  );

  const [beneficios, setBeneficios] = useState<BeneficioListado[]>([]);
  const [total, setTotal] = useState(0);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [puntos, setPuntos] = useState<PuntoMapa[]>([]);
  const [recortado, setRecortado] = useState(false);
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [irA, setIrA] = useState<[number, number] | null>(null);

  const [riel, setRiel] = useState(true);
  const [lista, setLista] = useState(true);
  const [orden, setOrden] = useState<OrdenLista>("relevancia");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [posSel, setPosSel] = useState<{ x: number; y: number } | null>(null);
  const [area, setArea] = useState({ ancho: 0, alto: 0 });

  // "Más locales" no existe en la función de la base: se pide por relevancia y
  // se reordena acá. Ordena la página cargada, no el total.
  const ordenRpc = orden === "locales" ? "relevancia" : orden;
  const query = useMemo(
    () => escribirFiltros({ ...filtros, orden: ordenRpc }).toString(),
    [filtros, ordenRpc],
  );

  const cambiar = useCallback(
    (parcial: Partial<Filtros>) => {
      capturar("filtro_aplicado", { campos: Object.keys(parcial) });
      router.replace(`/app?${escribirFiltros({ ...filtros, ...parcial })}`, {
        scroll: false,
      });
    },
    [filtros, router],
  );

  useEffect(() => {
    if (!cargado) return;
    const control = new AbortController();
    setCargandoLista(true);
    fetch(`/api/beneficios?${query}`, { signal: control.signal })
      .then((r) => r.json())
      .then((d: { beneficios?: BeneficioListado[]; total?: number }) => {
        setBeneficios(d.beneficios ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => undefined)
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

  const ultimoBbox = useRef<Bbox | null>(null);
  useEffect(() => {
    if (ultimoBbox.current) pedirPuntos(ultimoBbox.current);
  }, [pedirPuntos]);

  const moverMapa = useCallback(
    (b: Bbox) => {
      ultimoBbox.current = b;
      pedirPuntos(b);
    },
    [pedirPuntos],
  );

  // El área libre del mapa la miden el contenedor y el riel.
  const caja = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () =>
      setArea({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const misProductos = useMemo(() => new Set(mis), [mis]);
  const bancosSet = useMemo(() => new Set(misBancos), [misBancos]);
  const esParaVos = useCallback(
    (b: BeneficioListado) => {
      if (mis.length === 0 || !bancosSet.has(b.fuente_id)) return false;
      if (b.productos_elegibles.length === 0) return true;
      return b.productos_elegibles.some((p) => misProductos.has(p));
    },
    [mis, bancosSet, misProductos],
  );

  // El buscador del riel filtra por nombre sobre lo ya traído; el orden "Más
  // locales" se resuelve acá por el mismo motivo.
  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const filtrados = texto
      ? beneficios.filter((b) => b.comercio.toLowerCase().includes(texto))
      : beneficios;
    if (orden === "locales") {
      return [...filtrados].sort((a, b) => b.n_sucursales - a.n_sucursales);
    }
    if (orden === "relevancia" && mis.length > 0) {
      return [...filtrados].sort(
        (a, b) => Number(esParaVos(b)) - Number(esParaVos(a)),
      );
    }
    return filtrados;
  }, [beneficios, q, orden, mis.length, esParaVos]);

  const anchoRiel = riel ? ANCHO_RIEL_ABIERTO : ANCHO_RIEL_PLEGADO;
  const izquierdaPanel = anchoRiel + 32;
  const anchoPanel = Math.min(area.ancho - izquierdaPanel - 16, 380);
  const libreDesde = izquierdaPanel + Math.max(anchoPanel, 0) + 16;

  /*
   * La ficha muestra todas las tarjetas con beneficio en ese comercio, no solo
   * las que pasan los filtros, y el comercio del pin puede no estar entre los
   * 40 beneficios de la página cargada. Por eso se piden aparte, sin filtros.
   */
  const [beneficiosDelSel, setBeneficiosDelSel] = useState<BeneficioListado[]>(
    [],
  );
  useEffect(() => {
    if (!sel) {
      setBeneficiosDelSel([]);
      return;
    }
    const control = new AbortController();
    fetch(`/api/beneficios?comercio=${encodeURIComponent(sel)}`, {
      signal: control.signal,
    })
      .then((r) => r.json())
      .then((d: { beneficios?: BeneficioListado[] }) =>
        setBeneficiosDelSel(d.beneficios ?? []),
      )
      .catch(() => undefined);
    return () => control.abort();
  }, [sel]);

  const puntoSel = puntos.find((p) => p.comercio_key === sel);

  // La barra inferior de mobile entra a /app?perfil=1 para abrir la billetera.
  useEffect(() => {
    if (params.get("perfil") === "1") abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <EncabezadoSitio />
      <main
        ref={caja}
        className="relative min-h-0 flex-1"
        style={{ background: "#e8ece9" }}
      >
        <Mapa
          puntos={puntos}
          recortado={recortado}
          cargando={cargandoMapa}
          onMover={moverMapa}
          irA={irA}
          mias={mis.length ? mis : undefined}
          seleccion={sel}
          onElegirPunto={(p) => setSel(p.comercio_key)}
          onPosSeleccion={setPosSel}
        />

        <RielFiltros
          filtros={filtros}
          onCambiar={cambiar}
          abierto={riel}
          onPlegar={setRiel}
          misBancos={misBancos}
          q={q}
          onQ={setQ}
        />

        <PanelLista
          beneficios={visibles}
          total={total}
          cargando={cargandoLista}
          izquierda={izquierdaPanel}
          abierta={lista}
          onAbrir={setLista}
          orden={orden}
          onOrden={setOrden}
          seleccion={sel}
          onElegir={(b) => {
            setSel(b.comercio_key);
            const p = puntos.find((x) => x.comercio_key === b.comercio_key);
            if (p) setIrA([p.lat, p.lng]);
          }}
          esParaVos={esParaVos}
          tieneTarjetas={mis.length > 0}
        />

        {/* "Buscar en esta zona": centrado sobre el área libre del mapa */}
        <button
          type="button"
          onClick={() => ultimoBbox.current && pedirPuntos(ultimoBbox.current)}
          className="bg-tinta absolute top-5 z-20 inline-flex h-10 items-center rounded-pill px-4 text-sm font-semibold text-white"
          style={{
            left: libreDesde + Math.max(area.ancho - libreDesde, 0) / 2,
            transform: "translateX(-50%)",
            boxShadow: "0 12px 32px rgba(20,32,44,.25)",
            transition: "left .3s cubic-bezier(.2,.8,.2,1)",
          }}
        >
          Buscar en esta zona
        </button>

        <button
          type="button"
          aria-label="Mi ubicación"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              setIrA([pos.coords.latitude, pos.coords.longitude]),
            )
          }
          className="border-linea absolute right-5 bottom-5 z-20 inline-flex size-11 items-center justify-center rounded-xl border bg-white"
        >
          <Crosshair className="size-5" />
        </button>

        {sel && posSel && puntoSel && beneficiosDelSel.length > 0 && (
          <PopupComercio
            comercio={beneficiosDelSel[0]!.comercio}
            beneficios={beneficiosDelSel}
            punto={posSel}
            area={area}
            minX={libreDesde}
            onCerrar={() => setSel(null)}
            esParaVos={esParaVos}
            onAgregar={(fuenteId) => abrir({ agregar: true, banco: fuenteId })}
          />
        )}
      </main>
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
