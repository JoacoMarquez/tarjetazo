"use client";

import { useEffect, useMemo, useState } from "react";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior } from "@/components/nav";
import { PieSitio } from "@/components/nav";
import { ModalAgregar } from "@/components/comparar/modal-agregar";
import { SelectorDias } from "@/components/comparar/selector-dias";
import { TabPorDia } from "@/components/comparar/tab-por-dia";
import { TabTarjetas } from "@/components/comparar/tab-tarjetas";
import { TabValeLaPena } from "@/components/comparar/tab-vale-la-pena";
import { useBilletera } from "@/lib/billetera";
import {
  GASTO_DEF,
  RUBROS_COMPARAR,
  candidatas,
  type Matriz,
} from "@/lib/comparar-tarjetas";
import { cn } from "@/lib/utils";

type Tab = "tarjetas" | "conviene" | "dia";

const TABS: { id: Tab; label: string }[] = [
  { id: "tarjetas", label: "Tarjetas" },
  { id: "conviene", label: "¿Vale la pena?" },
  { id: "dia", label: "Por día" },
];

const CLAVE = "tarjetazo:comparar";
const TODOS = [0, 1, 2, 3, 4, 5, 6];

interface Guardado {
  sel?: string[];
  dias?: number[];
  gasto?: Record<string, number>;
}

function leer(): Guardado {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE) ?? "{}") as Guardado;
  } catch {
    // Modo privado o JSON corrupto: se arranca con los valores por defecto.
    return {};
  }
}

export function CompararCliente({ matriz }: { matriz: Matriz }) {
  const { mis, pedirConfirmacion } = useBilletera();

  const [tab, setTab] = useState<Tab>("tarjetas");
  // `null` en la primera pintada: la carga inicial no se anima.
  const [dir, setDir] = useState<"L" | "R" | null>(null);
  const [dias, setDias] = useState<number[]>(TODOS);
  const [gasto, setGasto] = useState<Record<string, number>>(GASTO_DEF);
  const [sel, setSel] = useState<string[]>([]);
  const [rubro, setRubro] = useState<string>(RUBROS_COMPARAR[0].slug);
  const [cand, setCand] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const g = leer();
    if (g.dias?.length) setDias(g.dias);
    if (g.gasto) setGasto({ ...GASTO_DEF, ...g.gasto });
    if (g.sel?.length) setSel(g.sel);
    setCargado(true);
  }, []);

  // Sin selección guardada: tus tarjetas más las dos que más sumarían.
  useEffect(() => {
    if (!cargado || sel.length > 0) return;
    const sugeridas = candidatas(matriz, mis, dias, gasto)
      .slice(0, 2)
      .map((c) => c.pid);
    setSel([...mis, ...sugeridas]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, mis]);

  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify({ sel, dias, gasto }));
    } catch {
      // Sin storage la comparación vive en memoria; no es motivo para romper.
    }
  }, [sel, dias, gasto, cargado]);

  // La candidata por defecto es la que más sumaría.
  const mejorCandidata = useMemo(
    () => candidatas(matriz, mis, dias, gasto)[0]?.pid ?? null,
    [matriz, mis, dias, gasto],
  );
  const candidata = cand ?? mejorCandidata;

  function irA(nuevo: Tab) {
    if (nuevo === tab) return;
    setDir(
      TABS.findIndex((t) => t.id === nuevo) >
        TABS.findIndex((t) => t.id === tab)
        ? "R"
        : "L",
    );
    setTab(nuevo);
  }

  const animacion =
    dir === "R" ? "tab-entra-r" : dir === "L" ? "tab-entra-l" : undefined;
  const conDias = tab !== "dia";

  return (
    <>
      <EncabezadoSitio />
      <main className="mx-auto max-w-[1440px] px-5 pt-6 pb-20">
        <h1 className="font-display m-0 text-[28px] font-bold">Comparar</h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Vistas de la comparación"
            className="bg-papel-2 flex gap-1 rounded-pill p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => irA(t.id)}
                className={cn(
                  "h-9 rounded-pill px-[18px] text-sm font-semibold transition-colors",
                  tab === t.id ? "bg-tinta text-white" : "text-tinta",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Los controles contextuales entran y salen con el ancho. */}
            <div
              className="overflow-hidden"
              style={{
                maxWidth: conDias ? 520 : 0,
                opacity: conDias ? 1 : 0,
                transform: conDias ? "none" : "translateX(12px)",
                transition: "max-width .35s, opacity .35s, transform .35s",
              }}
            >
              <SelectorDias
                dias={dias}
                onCambiar={(d) => setDias(d.length ? d : TODOS)}
              />
            </div>
            <div
              className="overflow-hidden"
              style={{
                maxWidth: tab === "tarjetas" ? 260 : 0,
                opacity: tab === "tarjetas" ? 1 : 0,
                transition: "max-width .35s, opacity .35s",
              }}
            >
              <button
                type="button"
                onClick={() => setModal(true)}
                className="bg-tinta hover:bg-pizarra inline-flex h-10 items-center gap-2 rounded-pill pr-1.5 pl-4 text-sm font-semibold whitespace-nowrap text-white"
              >
                + Agregar tarjeta
                <span
                  className="num text-tinta inline-flex size-7 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{
                    backgroundImage:
                      "linear-gradient(100deg,#0f6fd6 0%,#0fae9c 55%,#f7b500 100%)",
                  }}
                >
                  {sel.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div key={tab} className={cn("mt-4", animacion)}>
          {tab === "tarjetas" && (
            <TabTarjetas
              matriz={matriz}
              seleccion={sel}
              onSeleccion={setSel}
              mis={mis}
              dias={dias}
              gasto={gasto}
              onGasto={(r, v) => setGasto((g) => ({ ...g, [r]: v }))}
              onReset={() => setGasto(GASTO_DEF)}
              onAbrirModal={() => setModal(true)}
              onVerSiVale={(pid) => {
                setCand(pid);
                irA("conviene");
              }}
              onTarjetero={pedirConfirmacion}
            />
          )}
          {tab === "conviene" && (
            <TabValeLaPena
              matriz={matriz}
              mis={mis}
              dias={dias}
              gasto={gasto}
              onGasto={(r, v) => setGasto((g) => ({ ...g, [r]: v }))}
              onReset={() => setGasto(GASTO_DEF)}
              candidata={candidata}
              onCandidata={setCand}
              onTarjetero={pedirConfirmacion}
            />
          )}
          {tab === "dia" && (
            <TabPorDia
              matriz={matriz}
              mis={mis}
              rubro={rubro}
              onRubro={setRubro}
              gasto={gasto}
              onComparar={(pid) => {
                setSel((s) => (s.includes(pid) ? s : [...s, pid]));
                irA("tarjetas");
              }}
              onTarjetero={pedirConfirmacion}
            />
          )}
        </div>
      </main>

      {modal && (
        <ModalAgregar
          matriz={matriz}
          seleccion={sel}
          onSeleccion={setSel}
          mis={mis}
          dias={dias}
          gasto={gasto}
          onCerrar={() => setModal(false)}
        />
      )}

      <PieSitio />
      <NavInferior />
    </>
  );
}
