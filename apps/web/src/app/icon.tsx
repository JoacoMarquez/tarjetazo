import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** La "z" del logo sobre el gradiente de marca. */
export default function Icono() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(100deg, #0f6fd6 0%, #0fae9c 55%, #f7b500 100%)",
          color: "white",
          fontSize: 24,
          fontWeight: 800,
          borderRadius: 7,
        }}
      >
        z
      </div>
    ),
    size,
  );
}
