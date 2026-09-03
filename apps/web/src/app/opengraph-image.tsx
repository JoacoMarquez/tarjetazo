import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tarjetazo — descuentos y cuotas con tus tarjetas en Uruguay";

export default function ImagenSocial() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf6",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#14202c" }}>
            Tarjeta
            <span
              style={{
                background: "linear-gradient(100deg, #0f6fd6 0%, #0fae9c 55%, #f7b500 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              zo
            </span>
          </div>
          <div style={{ fontSize: 44, color: "#14202c", lineHeight: 1.2, maxWidth: 900 }}>
            Todos los descuentos de tus tarjetas, en un solo lugar.
          </div>
          <div style={{ fontSize: 28, color: "#6b7683", maxWidth: 820 }}>
            Decinos qué tarjetas tenés y te decimos con cuál pagar. Sin cuenta y sin pedirte el
            número.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ height: 10, width: 320, background: "linear-gradient(100deg, #0f6fd6, #0fae9c, #f7b500)", borderRadius: 999 }} />
          <div style={{ fontSize: 26, color: "#6b7683" }}>tarjetazo.uy · Uruguay</div>
        </div>
      </div>
    ),
    size,
  );
}
