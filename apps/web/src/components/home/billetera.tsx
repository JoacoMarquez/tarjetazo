"use client";

import { FUENTES } from "@tarjetazo/core";
import { useBilletera } from "@/lib/billetera";
import {
  FUENTE_POR_ID,
  GRADIENTE,
  PRODUCTO_POR_ID,
  colorFuente,
  nombreCorto,
  pieDeTarjeta,
  productosDe,
} from "@/lib/marca";

const SUAVE = "cubic-bezier(.2,.8,.2,1)";

/**
 * La billetera: se abre sobre la página, la tira con el broche se da vuelta y
 * las tarjetas salen del bolsillo en escalera. Tocar una la saca de "mis
 * tarjetas"; el botón de abajo abre el panel de alta.
 *
 * Las medidas son absolutas contra un contenedor de 300×500, como en el
 * diseño: es la única forma de que la pila, el bolsillo y la tira encajen.
 */
export function Billetera() {
  const b = useBilletera();
  if (b.estado === 0) return null;

  const abierta = b.estado === 2;
  const n = b.mis.length;
  // Con muchas tarjetas la escalera se comprime para no salirse del alto.
  const paso = n <= 6 ? 30 : Math.floor(180 / n);
  const hov = b.destacada;
  // Sin tarjetas el botón ocupa el lugar de la primera: apoyado sobre el
  // cuerpo de la billetera, no flotando por encima de la tira.
  const addTy = !abierta ? 0 : n === 0 ? -69 : -(n * paso) - 150 - (hov != null ? 34 : 0) - 8;

  return (
    <div
      onClick={b.cerrar}
      style={{
        position: "fixed",
        inset: 0,
        // Por encima de la barra inferior de mobile, que va en z-1000.
        zIndex: 1100,
        background: `rgba(20,32,44,${abierta ? 0.6 : 0})`,
        backdropFilter: `blur(${abierta ? 10 : 0}px)`,
        WebkitBackdropFilter: `blur(${abierta ? 10 : 0}px)`,
        transition: "background .4s, backdrop-filter .4s, -webkit-backdrop-filter .4s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Mis tarjetas"
        onClick={(e) => e.stopPropagation()}
        onMouseLeave={() => b.destacar(null)}
        style={{
          position: "relative",
          width: 300,
          height: 500,
          transform: `translateY(${abierta ? 0 : 40}px)`,
          transition: `transform .45s ${SUAVE}`,
        }}
      >
        <p
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 470,
            margin: 0,
            textAlign: "center",
            color: "#b9c3cf",
            fontSize: 13,
            opacity: abierta ? 1 : 0,
            transition: "opacity .3s .4s",
          }}
        >
          Tocá una tarjeta para sacarla · clic afuera para cerrar
        </p>

        <Tira abierta={abierta} lado="abierta" />

        {/* cuerpo */}
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 280,
            width: 280,
            height: 170,
            borderRadius: 18,
            background: "linear-gradient(160deg, #3f5166 0%, #34455a 100%)",
            boxShadow: "0 30px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.12)",
            zIndex: 5,
          }}
        >
          <div style={{ position: "absolute", inset: 8, borderRadius: 12, border: "1.5px dashed rgba(255,255,255,.18)" }} />
        </div>

        {b.mis.map((id, i) => {
          const p = PRODUCTO_POR_ID[id];
          if (!p) return null;
          const f = FUENTE_POR_ID[p.fuente_id];
          const destacada = abierta && hov === i;
          const otra = abierta && hov != null && hov !== i;
          // Las de arriba se separan y las de abajo bajan: siempre queda una
          // franja clickeable de cada tarjeta.
          const desvio = hov == null ? 0 : i > hov ? -34 : i < hov ? 34 : 0;
          const ty = abierta ? -(i * paso) - 150 + desvio : i * 5;
          return (
            <div
              key={id}
              onMouseEnter={() => abierta && b.destacar(i)}
              style={{
                position: "absolute",
                left: 50,
                top: 300,
                width: 200,
                height: 125,
                transform: `translateY(${ty}px) scale(${destacada ? 1.12 : abierta ? 1 : 1 - i * 0.015})`,
                opacity: otra ? 0.45 : 1,
                willChange: "transform, opacity",
                transition: `transform .32s ${SUAVE} ${
                  abierta && hov != null ? 0 : abierta ? 0.25 + i * 0.045 : (5 - i) * 0.03
                }s, opacity .25s`,
                zIndex: destacada ? 29 : abierta && hov != null ? 28 - Math.abs(i - hov) : 20 - i,
              }}
            >
              <button
                type="button"
                aria-label={`Quitar ${p.nombre}`}
                onClick={(e) => {
                  e.stopPropagation();
                  b.alternar(id);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 12,
                  background: colorFuente(p.fuente_id).color,
                  border: "1.5px dashed transparent",
                  boxSizing: "border-box",
                  boxShadow: "0 -3px 10px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.25)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  color: "#fff",
                  font: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {nombreCorto(p)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{f?.nombre}</span>
                </span>
                <span style={{ fontSize: 14 }} aria-hidden>
                  ✕
                </span>
                <span
                  style={{ position: "absolute", left: 12, top: 52, width: 26, height: 20, borderRadius: 4, background: "rgba(247,181,0,1)" }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    bottom: 12,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    opacity: 0.85,
                  }}
                >
                  {pieDeTarjeta(p)}
                </span>
              </button>
            </div>
          );
        })}

        {/* alta de tarjetas */}
        <div
          style={{
            position: "absolute",
            left: 50,
            top: 300,
            width: 200,
            height: 44,
            transform: `translateY(${addTy}px)`,
            transition: `transform .32s ${SUAVE} ${abierta ? 0.25 + n * 0.045 : 0}s`,
            zIndex: abierta ? 8 : 0,
            opacity: abierta ? 1 : 0,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              b.alternarAgregar();
            }}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              border: "1.5px dashed rgba(255,255,255,.45)",
              // Fondo opaco: el botón se apoya sobre la tira abierta y con
              // fondo transparente se veía la tira a través de él.
              background: b.agregando ? "#3a4b5e" : "#2b3a4a",
              boxShadow: "0 6px 16px rgba(0,0,0,.35)",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#fff",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundImage: GRADIENTE,
                color: "#14202c",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              +
            </span>
            Agregar tarjeta
          </button>
        </div>

        {abierta && b.agregando && <PanelDeAlta />}

        {/* bolsillo frontal */}
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 340,
            width: 280,
            height: 110,
            borderRadius: "0 0 18px 18px",
            background: "linear-gradient(160deg, #3a4b5e 0%, #2f3f52 100%)",
            boxShadow: "0 -4px 12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              top: 8,
              bottom: 8,
              borderRadius: "0 0 12px 12px",
              border: "1.5px dashed rgba(255,255,255,.18)",
              borderTop: 0,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: 42,
              width: 14,
              height: 14,
              borderRadius: "50%",
              transform: "translateX(-50%)",
              background: "#223041",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,.6)",
            }}
          />
        </div>

        <Tira abierta={abierta} lado="cerrada" />
      </div>
    </div>
  );
}

/**
 * La tira con el broche. Son dos elementos con el mismo dibujo: `cerrada` va
 * última en el DOM y tapa el bolsillo; `abierta` va primera y queda detrás de
 * todo. Los compositores de Chrome y Safari a veces pintan las capas
 * transformadas por orden de DOM ignorando el z-index, y con esto el orden de
 * DOM ya es el correcto en los dos estados.
 *
 * El giro se reparte: la cerrada se aplasta hasta scaleY(0) y ahí, de canto e
 * invisible, arranca la abierta desde 0 hasta -0.996 (lo mismo que se ve con
 * rotateX(-175°) sin perspectiva). Al cerrar, al revés.
 */
function Tira({ abierta, lado }: { abierta: boolean; lado: "cerrada" | "abierta" }) {
  const soyLaVisible = lado === (abierta ? "abierta" : "cerrada");
  const escala = !soyLaVisible ? 0 : lado === "abierta" ? -0.996 : 1;
  // La que se está yendo anima primero (ease-in); la que llega, después (ease-out).
  const transicion = soyLaVisible
    ? "transform .275s cubic-bezier(0,0,.2,1) .275s"
    : "transform .275s cubic-bezier(.4,0,1,1)";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 110,
        top: 276,
        width: 80,
        height: 118,
        transformOrigin: "50% 0",
        transform: `scaleY(${escala})`,
        transition: transicion,
        zIndex: lado === "abierta" ? 1 : 40,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "0 0 16px 16px",
          background: "linear-gradient(160deg, #46586e 0%, #3a4b5e 100%)",
          boxShadow: "0 8px 18px rgba(0,0,0,.4), inset 0 -1px 0 rgba(255,255,255,.1)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 7,
            right: 7,
            top: 0,
            bottom: 7,
            borderRadius: "0 0 11px 11px",
            border: "1.5px dashed rgba(255,255,255,.18)",
            borderTop: 0,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: 14,
            width: 24,
            height: 24,
            borderRadius: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(circle at 35% 30%, #ffd863 0%, #f7b500 45%, #c98f00 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,.45), inset 0 0 0 3px rgba(0,0,0,.12)",
          }}
        />
      </div>
    </div>
  );
}

/** Panel de alta: chips de banco arriba y los productos de ese banco abajo. */
function PanelDeAlta() {
  const b = useBilletera();
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-0 z-50 w-[300px] -translate-x-1/2 md:left-[320px] md:top-10 md:w-[320px] md:translate-x-0"
      style={{
        maxHeight: 440,
        overflow: "auto",
        background: "#fff",
        color: "#14202c",
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 30px 60px rgba(0,0,0,.5)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FUENTES.map((f) => {
          const activo = f.id === b.banco;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => b.elegirBanco(f.id)}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 999,
                border: `1px solid ${activo ? "#14202c" : "#e4e0d6"}`,
                background: activo ? "#14202c" : "#fff",
                color: activo ? "#fff" : "#14202c",
                font: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {f.nombre}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {productosDe(b.banco).map((p) => {
          const tengo = b.mis.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={tengo}
              onClick={() => b.alternar(p.id)}
              className="hover:bg-hueso"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 6px",
                border: 0,
                borderBottom: "1px solid #f2efe7",
                background: "none",
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
                color: "#14202c",
              }}
            >
              <span
                style={{
                  flex: "none",
                  width: 34,
                  height: 22,
                  borderRadius: 4,
                  background: colorFuente(p.fuente_id).color,
                  opacity: tengo ? 1 : 0.35,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{p.nombre}</span>
                <span style={{ display: "block", fontSize: 12, color: "#6b7683" }}>{pieDeTarjeta(p)}</span>
              </span>
              <span
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: tengo ? "#0fae9c" : "#f2efe7",
                  color: tengo ? "#fff" : "#14202c",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {tengo ? "✓" : "+"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
