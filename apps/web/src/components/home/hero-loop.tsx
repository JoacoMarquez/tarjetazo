"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * La animación del hero: un POS cae, se pasa una tarjeta, la tarjeta se
 * acuesta y al deslizarse de izquierda a derecha va descubriendo las letras de
 * "Tarjetazo". Se reproduce una sola vez y queda en el último frame; después
 * el scroll de la página trae la tarjeta de vuelta y vuelve a tapar el nombre.
 *
 * Portada de `tarjetazo.jsx` / `hero-loop.jsx` del handoff de diseño. El
 * lienzo mide 1600×900 y se escala al ancho del contenedor; `VISTA` recorta la
 * ventana que se ve.
 */

const W = 1600;
const H = 900;
const CX = 800;
const CY = 450;
const CARD_W = 442;
const CARD_H = 250;
const FONT = 210;
const POS_S = 1.7;
const LETRAS = ["T", "a", "r", "j", "e", "t", "a", "z", "o"];

const CIELO = "#0f6fd6";
const SOL = "#f7b500";
const TINTA = "#14202c";
const HUMO = "#6b7683";
const PAPEL = "#f2efe7";
const GRAD = "linear-gradient(90deg,#0f6fd6 0%,#0fae9c 50%,#f7b500 100%)";

/** [x, y, ancho, alto] del lienzo que queda visible. */
const VISTA = [112, 110, 1400, 680] as const;
/** La tarjeta frena acá: queda media tarjeta contra el borde derecho. */
const FRENO = 1521;
/** Píxeles de scroll en los que la tarjeta barre el nombre de vuelta. */
const BARRIDO = 360;

const K = { posIn: 0, swipe: 0.6, posOut: 1.6, reveal: 2.1, exit: 4.3, hold: 4.8, total: 5.5 };
/** El frame en el que queda congelada la escena al terminar. */
const FIN = 4.9;

const SOMBRA_TARJETA =
  "0 24px 48px rgba(20,32,44,.20), 0 6px 12px rgba(20,32,44,.10), inset 1.5px 1.5px 0 rgba(255,255,255,.38), inset -1.5px -1.5px 0 rgba(0,0,0,.18)";
const SOMBRA_POS =
  "0 26px 52px rgba(20,32,44,.26), 0 6px 12px rgba(20,32,44,.12), inset 1.5px 1.5px 0 rgba(255,255,255,.14), inset -1.5px -1.5px 0 rgba(0,0,0,.4)";
const LUZ = "linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 60%)";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

type Ease = (t: number) => number;

function animar({
  from = 0,
  to = 1,
  start = 0,
  end = 1,
  ease = easeInOutCubic,
}: { from?: number; to?: number; start?: number; end?: number; ease?: Ease }) {
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

function interpolar(entrada: number[], salida: number[], ease: Ease) {
  return (t: number) => {
    if (t <= entrada[0]!) return salida[0]!;
    if (t >= entrada[entrada.length - 1]!) return salida[salida.length - 1]!;
    for (let i = 0; i < entrada.length - 1; i++) {
      if (t >= entrada[i]! && t <= entrada[i + 1]!) {
        const span = entrada[i + 1]! - entrada[i]!;
        const local = span === 0 ? 0 : (t - entrada[i]!) / span;
        return salida[i]! + (salida[i + 1]! - salida[i]!) * ease(local);
      }
    }
    return salida[salida.length - 1]!;
  };
}

/** Mezcla dos colores #rrggbb. Sirve para el flash verde de la pantalla del POS. */
function mezclar(a: string, b: string, p: number): string {
  const partes = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = partes(a);
  const B = partes(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i]! - v) * p)).join(",")})`;
}

/** Medidas estimadas hasta que la fuente carga y podemos medir de verdad. */
const EST = { cw: 880, arr: LETRAS.map((_, i) => ({ l: i * 98, w: 95 })) };

function useMedidasLetras(ref: React.RefObject<HTMLDivElement | null>) {
  const [m, setM] = useState<typeof EST | null>(null);
  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const arr = Array.from(el.querySelectorAll<HTMLElement>("[data-letra]")).map((s) => ({
        l: s.offsetLeft,
        w: s.offsetWidth,
      }));
      if (arr.length === LETRAS.length) setM({ cw: el.offsetWidth, arr });
    };
    medir();
    // Outfit llega por next/font: hay que volver a medir cuando esté.
    document.fonts?.ready.then(() => vivo && medir());
    return () => {
      vivo = false;
    };
  }, [ref]);
  return m;
}

function Logotipo({ borde, encendido, opacidad }: { borde: number; encendido: boolean; opacidad: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const m = useMedidasLetras(ref) ?? EST;
  const anchoZo = m.arr[7]!.w + m.arr[8]!.w;
  return (
    <div
      ref={ref}
      className="font-display"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        display: "flex",
        paddingLeft: "0.04em",
        fontWeight: 800,
        fontSize: FONT,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: "#ffffff",
        whiteSpace: "nowrap",
        opacity: opacidad,
      }}
    >
      {LETRAS.map((ch, i) => {
        const { l, w } = m.arr[i]!;
        const centro = CX - m.cw / 2 + l + w / 2;
        const p = encendido ? clamp((borde - centro) / 80, 0, 1) : 0;
        const e = easeOutBack(p);
        const escala = 0.8 + 0.2 * e;
        const dy = 2 * (1 - e);
        const op = Math.min(1, p / 0.2);
        const relleno = clamp((p - 0.35) / 0.65, 0, 1);
        return (
          <span
            key={i}
            data-letra="1"
            style={{
              position: "relative",
              display: "inline-block",
              opacity: op,
              transform: `translateY(${dy}px) scale(${escala})`,
              transformOrigin: "50% 70%",
              textShadow: "0 3px 6px rgba(20,32,44,.10)",
            }}
          >
            {ch}
            {/* "zo" se rellena con el gradiente de izquierda a derecha. */}
            {i >= 7 && (
              <span
                style={{
                  position: "absolute",
                  left: -12,
                  top: -12,
                  padding: 12,
                  color: "transparent",
                  backgroundImage: GRAD,
                  backgroundSize: `${anchoZo + 24}px 100%`,
                  backgroundOrigin: "border-box",
                  backgroundPosition: `${i === 7 ? 0 : -m.arr[7]!.w}px 0`,
                  backgroundRepeat: "no-repeat",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  textShadow: "none",
                  clipPath: `inset(0 ${(1 - relleno) * 100}% 0 0)`,
                  overflow: "visible",
                }}
              >
                {ch}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function Tarjeta({ x, y, rot, estirado }: { x: number; y: number; rot: number; estirado: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - CARD_W / 2,
        top: y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 22,
        background: CIELO,
        overflow: "hidden",
        transform: `rotate(${rot}deg) scaleX(${estirado})`,
        boxShadow: SOMBRA_TARJETA,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: LUZ }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 340,
          height: 215,
          transform: "scale(1.3, 1.163)",
          transformOrigin: "0 0",
        }}
      >
        {/* chip */}
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 72,
            width: 54,
            height: 40,
            borderRadius: 8,
            background: SOL,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 1px 2px rgba(0,0,0,.25)",
          }}
        >
          <div style={{ position: "absolute", left: 0, right: 0, top: 18, height: 3, background: "rgba(20,32,44,.25)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 20, width: 3, background: "rgba(20,32,44,.25)" }} />
        </div>
        {/* contactless */}
        {[10, 17, 24].map((r) => (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 112 - r,
              top: 92 - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: "50%",
              border: "4px solid transparent",
              borderRightColor: "#fff",
              opacity: 0.95,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 34,
            bottom: 30,
            width: 120,
            height: 14,
            borderRadius: 7,
            background: "rgba(255,255,255,.35)",
          }}
        />
      </div>
    </div>
  );
}

function Pos({
  y,
  opacidad,
  escala,
  flash,
  check,
}: { y: number; opacidad: number; escala: number; flash: number; check: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: CX - 105,
        top: y - 145,
        width: 210,
        height: 290,
        transform: `scale(${escala * POS_S})`,
        opacity: opacidad,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 30,
          bottom: -10,
          width: 150,
          height: 22,
          borderRadius: 6,
          background: HUMO,
          boxShadow: "0 2px 4px rgba(20,32,44,.25)",
        }}
      >
        <div style={{ position: "absolute", left: 12, right: 12, top: 8, height: 5, borderRadius: 3, background: TINTA }} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 26,
          background: "#2b3a4a",
          boxShadow: SOMBRA_POS,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: LUZ, opacity: 0.6 }} />
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 44,
            width: 150,
            height: 96,
            borderRadius: 12,
            background: mezclar(PAPEL, "#0fae9c", flash),
            boxShadow: "inset 0 2px 4px rgba(0,0,0,.18)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 36,
              height: 18,
              borderLeft: "6px solid #fff",
              borderBottom: "6px solid #fff",
              transform: `translate(-50%,-62%) rotate(-45deg) scale(${check})`,
              opacity: check > 0 ? 1 : 0,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 162,
            bottom: 36,
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 6, background: HUMO, opacity: 0.55 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const Escena = memo(function Escena({ t, freno }: { t: number; freno: number }) {
  const finDeslizada = K.swipe + 0.85 * (K.posOut - K.swipe);
  const asiento = K.swipe + 0.68 * (K.posOut - K.swipe);
  const posY = animar({ from: -260, to: CY, start: K.posIn, end: K.swipe, ease: easeOutBack })(t);
  const posSale = animar({ start: K.posOut, end: K.posOut + 0.6 * (K.reveal - K.posOut), ease: easeInOutSine })(t);
  const giroA = K.posOut + 0.25 * (K.reveal - K.posOut);
  const giroB = K.reveal + 0.12 * (K.exit - K.reveal);
  const flash = animar({ start: asiento - 0.05, end: asiento + 0.15, ease: easeInOutSine })(t);
  const check = animar({ start: asiento, end: asiento + 0.3, ease: easeOutBack })(t);
  const pDeslizada = clamp((t - K.swipe) / (finDeslizada - K.swipe), 0, 1);
  const tarjetaY =
    t < K.posOut
      ? animar({ from: H + 320, to: 660, start: K.swipe, end: finDeslizada })(t)
      : animar({ from: 660, to: CY, start: giroA, end: giroB })(t);
  const rot = animar({ from: 90, to: 0, start: giroA, end: giroB })(t);
  let tarjetaX = interpolar([giroA, giroB, K.exit, K.hold], [CX, 450, W - 100, W + 260], easeInOutCubic)(t);
  tarjetaX = Math.min(tarjetaX, freno);
  const estirado = 1 + 0.1 * Math.sin(Math.PI * pDeslizada);
  const borde = tarjetaX - CARD_W / 2;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", background: TINTA }}>
      <Logotipo borde={borde} encendido={t >= K.reveal} opacidad={1} />
      <Tarjeta x={tarjetaX} y={tarjetaY} rot={rot} estirado={estirado} />
      <Pos y={posY} opacidad={1 - posSale} escala={1 - 0.3 * posSale} flash={flash} check={check} />
    </div>
  );
});

export function HeroLoop() {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(720);
  const [t, setT] = useState(0);
  const [barrido, setBarrido] = useState(0);

  useEffect(() => {
    const leer = () => setBarrido(clamp(window.scrollY / BARRIDO, 0, 1));
    leer();
    window.addEventListener("scroll", leer, { passive: true });
    return () => window.removeEventListener("scroll", leer);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e!.contentRect.width));
    ro.observe(el);

    // Quien pidió menos movimiento ve directamente el frame final.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(FIN);
      return () => ro.disconnect();
    }

    let raf = 0;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const s = (ahora - t0) / 1000;
      if (s >= FIN) {
        setT(FIN);
        return;
      }
      setT(s);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Una vez congelada, el scroll trae la tarjeta de derecha a izquierda y
  // vuelve a tapar las letras (o → T) hasta que sale por el borde.
  const freno = t >= FIN - 0.05 ? FRENO - barrido * (FRENO + 260) : FRENO;
  const [vx, vy, vw, vh] = VISTA;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ position: "relative", width: "100%", aspectRatio: `${vw} / ${vh}`, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `scale(${ancho / vw}) translate(${-vx}px, ${-vy}px)`,
          transformOrigin: "0 0",
        }}
      >
        <Escena t={t} freno={freno} />
      </div>
    </div>
  );
}
