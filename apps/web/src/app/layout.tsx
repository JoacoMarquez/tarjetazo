import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Analitica } from "@/components/analitica";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-outfit" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: {
    default: "Tarjetazo — descuentos y cuotas con tus tarjetas en Uruguay",
    template: "%s · Tarjetazo",
  },
  description:
    "Todos los descuentos, reintegros y cuotas de bancos, emisores y billeteras uruguayas, filtrados por las tarjetas que tenés.",
  metadataBase: new URL("https://tarjetazo.uy"),
  manifest: "/manifest.webmanifest",
  applicationName: "Tarjetazo",
  keywords: ["descuentos", "tarjetas", "Uruguay", "beneficios", "cuotas", "bancos"],
  openGraph: {
    type: "website",
    locale: "es_UY",
    siteName: "Tarjetazo",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f6fd6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" className={`${outfit.variable} ${inter.variable} ${archivo.variable}`}>
      <body>
        {children}
        <Analitica />
        <Analytics />
      </body>
    </html>
  );
}
