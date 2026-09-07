"use client";

import { COLORES_GRADIENTE, GRADIENTE, colorFuente } from "@/lib/marca";

/** Posiciones de la pila: la de más a la derecha es la de adelante. */
const SLOTS = [
  { left: 0, top: 2, clase: "c1" },
  { left: 10, top: 1, clase: "c2" },
  { left: 19, top: 0, clase: "c3" },
];

/**
 * Las tres mini tarjetas que representan la billetera en el header y en el
 * selector del buscador. Sin tarjetas muestra slots punteados con los colores
 * del gradiente; con tarjetas, hasta tres bancos distintos.
 *
 * `fondo` es el color sobre el que se apoya: se usa como sombra lateral para
 * que las tarjetas se separen entre sí sin dibujar un borde.
 */
export function PilaTarjetas({
  bancos,
  fondo,
  ancho = 26,
  alto = 17,
}: {
  bancos: string[];
  fondo: string;
  ancho?: number;
  alto?: number;
}) {
  const visibles = bancos.slice(0, 3);
  const n = visibles.length;
  const slots = n === 0 ? SLOTS : SLOTS.slice(3 - n);
  const solo = n === 1;
  // Con menos de tres tarjetas usamos los slots de la derecha, así que hay que
  // correr todo a la izquierda para que la pila no se salga de su hueco.
  const base = slots[0]!.left;
  const anchoTotal = slots[slots.length - 1]!.left - base + ancho;

  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: anchoTotal, height: alto + 3 }}
    >
      {slots.map((s, i) => {
        const vacia = n === 0;
        const frontal = i === slots.length - 1;
        const color = vacia ? COLORES_GRADIENTE[i]! : colorFuente(visibles[i]!).color;
        return (
          <span
            key={s.clase + i}
            className={`pila-c ${solo ? "c3 solo" : s.clase}`}
            style={{
              position: "absolute",
              left: s.left - base,
              top: s.top,
              width: ancho,
              height: alto,
              borderRadius: 4,
              background: vacia ? (frontal ? fondo : "transparent") : color,
              border: `1.5px dashed ${vacia ? color : "transparent"}`,
              boxShadow: `-2px 0 0 ${fondo}`,
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {vacia && frontal && (
              <span
                style={{
                  backgroundImage: GRADIENTE,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                +
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
