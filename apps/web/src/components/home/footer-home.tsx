"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { CATEGORIAS } from "@tarjetazo/core";
import { useBilletera } from "@/lib/billetera";
import { Wordmark } from "./header-home";

const RUBROS = CATEGORIAS.filter((c) => c.en_home).slice(0, 6);

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      className="text-xs font-bold uppercase tracking-[.12em]"
      style={{ color: "#8a97a6" }}
    >
      {children}
    </div>
  );
}

export function FooterHome() {
  const { abrir } = useBilletera();
  return (
    <footer
      className="pb-16 text-sm md:pb-0"
      style={{ background: "#14202c", borderTop: "1px solid rgba(255,255,255,.1)", color: "#b9c3cf" }}
    >
      <div
        className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-5 pb-10 pt-14 sm:grid-cols-2 lg:[grid-template-columns:minmax(220px,1.3fr)_repeat(3,minmax(160px,1fr))]"
      >
        <div>
          <Wordmark tamano={26} />
          <p className="mt-3.5 max-w-[300px] leading-[1.55]">
            Todos los descuentos de bancos y billeteras de Uruguay, en un solo lugar.
          </p>
        </div>

        <div>
          <Eyebrow>Navegación</Eyebrow>
          <nav className="mt-4 flex flex-col items-start gap-3">
            <Link href="/" className="text-white">Inicio</Link>
            <Link href="/app" className="text-white">Explorar</Link>
            <Link href="/comparar" className="text-white">Comparar</Link>
            <button type="button" onClick={() => abrir()} className="cursor-pointer text-white">
              Mis tarjetas
            </button>
            <Link href="/ayuda" className="text-white">Preguntas frecuentes</Link>
          </nav>
        </div>

        <div>
          <Eyebrow>Rubros</Eyebrow>
          <nav className="mt-4 flex flex-col gap-3">
            {RUBROS.map((r) => (
              <Link key={r.slug} href={`/app?cat=${r.slug}`} className="text-white">
                {r.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <Eyebrow>Contacto</Eyebrow>
          <nav className="mt-4 flex flex-col gap-3">
            <a href="mailto:hola@tarjetazo.uy" className="inline-flex items-center gap-2 font-medium text-white">
              <Mail className="size-4" strokeWidth={2} />
              hola@tarjetazo.uy
            </a>
            <a href="mailto:hola@tarjetazo.uy?subject=Me falta un banco o tarjeta" className="text-white">
              Avisanos qué banco o tarjeta te falta
            </a>
            <a href="mailto:hola@tarjetazo.uy?subject=Dato incorrecto" className="text-white">
              Reportar un dato incorrecto
            </a>
          </nav>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-6 px-5 py-6 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">
              © {new Date().getFullYear()} Tarjetazo · Hecho en Uruguay
            </span>
            <span>·</span>
            <Link href="/terminos" className="font-medium text-white">Términos</Link>
            <span>·</span>
            <Link href="/privacidad" className="font-medium text-white">Privacidad</Link>
          </div>
          <p className="m-0 max-w-[520px] leading-normal">
            Los beneficios pertenecen a sus fuentes y pueden cambiar sin aviso. Verificá las
            condiciones en el sitio oficial antes de pagar.
          </p>
        </div>
      </div>
    </footer>
  );
}
