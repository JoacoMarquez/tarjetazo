"use client";

import Link from "next/link";
import { useState } from "react";
import { FAQ } from "@/lib/contenido-home";
import { GRADIENTE } from "@/lib/marca";

/**
 * Acordeón de una sola pregunta abierta. El despliegue usa
 * `grid-template-rows: 0fr → 1fr`, que anima la altura real sin medirla.
 */
export function Faq() {
  const [abierta, setAbierta] = useState(0);

  return (
    <section className="bg-hueso px-5 pb-24 pt-2 text-tinta">
      <div className="mx-auto max-w-[760px]">
        <h2 className="font-display m-0 text-center text-[32px] font-bold tracking-tight">
          ¿Dudas? Las de siempre.
        </h2>
        <div
          className="mt-7 flex flex-col rounded-[24px] px-7 py-2"
          style={{ background: "#14202c", boxShadow: "0 20px 50px rgba(20,32,44,.25)" }}
        >
          {FAQ.map((f, i) => {
            const open = i === abierta;
            return (
              <div
                key={f.q}
                style={{
                  borderTop: i === 0 ? "0" : open ? "2px solid transparent" : "1px solid rgba(255,255,255,.14)",
                  borderImage: open && i > 0 ? `${GRADIENTE} 1` : "none",
                  transition: "border-color .3s",
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setAbierta(open ? -1 : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-none py-[18px] text-left text-[17px] text-white"
                  style={{ fontWeight: open ? 600 : 500 }}
                >
                  {f.q}
                  <span
                    aria-hidden
                    className="inline-block text-[22px] leading-none"
                    style={{
                      color: "rgba(255,255,255,.7)",
                      transform: `rotate(${open ? 45 : 0}deg)`,
                      transition: "transform .3s cubic-bezier(.2,.8,.2,1)",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    opacity: open ? 1 : 0,
                    transition: "grid-template-rows .35s cubic-bezier(.2,.8,.2,1), opacity .25s",
                  }}
                >
                  <div style={{ overflow: "hidden", minHeight: 0 }}>
                    <p
                      className="m-0 max-w-[600px] pb-[18px] text-sm leading-[1.55]"
                      style={{
                        marginTop: -6,
                        color: "#b9c3cf",
                        transform: `translateY(${open ? 0 : -6}px)`,
                        transition: "transform .35s cubic-bezier(.2,.8,.2,1)",
                      }}
                    >
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-humo">
          ¿Otra duda?{" "}
          <Link href="/ayuda" className="font-medium text-cielo">
            Escribinos →
          </Link>
        </p>
      </div>
    </section>
  );
}
