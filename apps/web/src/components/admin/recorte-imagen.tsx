"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { PROPORCION_TARJETA } from "@/components/tarjeta-3d";

/** Tamaño de salida: tarjeta ID-1 a ~300 dpi. */
const ANCHO = 1012;
const ALTO = Math.round(ANCHO / PROPORCION_TARJETA);

/**
 * Elegir una foto y recortarla a la proporción de una tarjeta: arrastrar para
 * mover, deslizador para acercar, botón para rotar. El recorte se dibuja en un
 * canvas y se mete como archivo en el `<input name>` del formulario, así el
 * submit lo manda sin nada más.
 */
export function RecorteImagen({
  name,
  etiqueta,
  error,
  inicial,
  onCambio,
}: {
  name: string;
  etiqueta: string;
  error?: string;
  /** Foto para arrancar ya cargada: la que sugirió el scraper y no se pudo normalizar sola (#72). */
  inicial?: { src: string; nombre: string };
  /** URL (object URL) del recorte, o null si se quitó; para la vista previa. */
  onCambio: (url: string | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [nombre, setNombre] = useState("");

  // Escala "cover" con la rotación aplicada, y cuánto se puede mover sin dejar hueco.
  const girada = rot % 180 !== 0;
  const iw = imagen ? (girada ? imagen.naturalHeight : imagen.naturalWidth) : 1;
  const ih = imagen ? (girada ? imagen.naturalWidth : imagen.naturalHeight) : 1;
  const escala = Math.max(ANCHO / iw, ALTO / ih) * zoom;
  const holgura = { x: Math.abs(iw * escala - ANCHO) / 2, y: Math.abs(ih * escala - ALTO) / 2 };
  const limitar = (p: { x: number; y: number }) => ({
    x: Math.max(-holgura.x, Math.min(holgura.x, p.x)),
    y: Math.max(-holgura.y, Math.min(holgura.y, p.y)),
  });
  const { x, y } = limitar(pos);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !imagen) return;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    ctx.save();
    ctx.translate(ANCHO / 2 + x, ALTO / 2 + y);
    ctx.rotate((rot * Math.PI) / 180);
    const w = imagen.naturalWidth * escala;
    const h = imagen.naturalHeight * escala;
    ctx.drawImage(imagen, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Recién cuando se deja de mover: `toBlob` no es gratis.
    const t = setTimeout(() => {
      c.toBlob(
        (blob) => {
          if (!blob || !input.current) return;
          // Safari no codifica WebP y devuelve PNG: la extensión sigue al tipo real.
          const ext = blob.type === "image/webp" ? "webp" : "png";
          const dt = new DataTransfer();
          dt.items.add(new File([blob], `${name}.${ext}`, { type: blob.type }));
          input.current.files = dt.files;
          onCambio(URL.createObjectURL(blob));
        },
        "image/webp",
        0.9,
      );
    }, 250);
    return () => clearTimeout(t);
    // onCambio cambia en cada render del padre; no hace falta redibujar por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagen, escala, rot, x, y, name]);

  function cargar(src: string, nombreFoto: string) {
    const img = new Image();
    // La inicial viene de Storage: sin esto el canvas queda "sucio" y toBlob falla.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImagen(img);
      setZoom(1);
      setRot(0);
      setPos({ x: 0, y: 0 });
      setNombre(nombreFoto);
    };
    img.src = src;
  }

  useEffect(() => {
    if (inicial) cargar(inicial.src, inicial.nombre);
  }, [inicial]);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) cargar(URL.createObjectURL(f), f.name);
  }

  function quitar() {
    setImagen(null);
    setNombre("");
    if (input.current) input.current.value = "";
    onCambio(null);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!arrastre.current) return;
    // De píxeles de pantalla a píxeles del canvas.
    const k = ANCHO / e.currentTarget.clientWidth;
    const dx = (e.clientX - arrastre.current.x) * k;
    const dy = (e.clientY - arrastre.current.y) * k;
    arrastre.current = { x: e.clientX, y: e.clientY };
    setPos((p) => limitar({ x: limitar(p).x + dx, y: limitar(p).y + dy }));
  }

  const idCampo = `recorte-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={idCampo} className="text-sm font-medium">
          {etiqueta}
        </label>
        {imagen ? (
          <button type="button" onClick={quitar} className="text-pizarra inline-flex items-center gap-1 text-xs hover:underline">
            <X className="size-3" aria-hidden /> Descartar
          </button>
        ) : null}
      </div>
      {/* El archivo recortado viaja en este input; el que ve el usuario es el de abajo. */}
      <input ref={input} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden />
      {/* El input nativo diría "ningún archivo" (se vacía para poder re-elegir la misma foto). */}
      <div className="flex items-center gap-2">
        <label
          className="border-linea text-pizarra hover:bg-papel-1 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline-2"
        >
          {imagen ? "Elegir otra" : "Elegir foto"}
          <input
            id={idCampo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={elegir}
            className="sr-only"
          />
        </label>
        {nombre ? <span className="text-humo-oscuro min-w-0 truncate text-xs">{nombre}</span> : null}
      </div>
      {imagen ? (
        <>
          <canvas
            ref={canvas}
            width={ANCHO}
            height={ALTO}
            aria-label={`Recorte de ${nombre}: arrastrá para mover`}
            className="border-linea w-full max-w-sm cursor-grab touch-none rounded-lg border bg-[repeating-conic-gradient(var(--papel-2)_0_25%,transparent_0_50%)] bg-[length:16px_16px] active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              arrastre.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={mover}
            onPointerUp={() => (arrastre.current = null)}
            onPointerCancel={() => (arrastre.current = null)}
          />
          <div className="flex max-w-sm items-center gap-3">
            <label className="text-pizarra flex flex-1 items-center gap-2 text-xs">
              Zoom
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setRot((r) => (r + 90) % 360);
                setPos({ x: 0, y: 0 });
              }}
              className="border-linea text-pizarra hover:bg-papel-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
            >
              <RotateCw className="size-3" aria-hidden /> Rotar
            </button>
          </div>
        </>
      ) : null}
      {error ? <p className="text-coral-ink text-xs">{error}</p> : null}
    </div>
  );
}
