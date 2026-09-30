"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

/**
 * Captcha de Cloudflare Turnstile para los pedidos de Auth que mandan mail
 * (alta, recuperación) y el ingreso. El token lo valida Supabase (Attack
 * Protection); cada token sirve una sola vez, así que después de cada intento
 * hay que pedir otro con `reiniciar`. Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no
 * se muestra nada y los pedidos salen sin token, como antes.
 */
export const SITE_KEY_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type ApiTurnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

export function Turnstile({
  onToken,
  reinicio,
}: {
  onToken: (token: string | null) => void;
  /** Cambiarlo pide un token nuevo (después de cada intento). */
  reinicio: number;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const alToken = useRef(onToken);
  alToken.current = onToken;

  function dibujar() {
    if (!SITE_KEY_TURNSTILE || !caja.current || !window.turnstile || id.current) return;
    id.current = window.turnstile.render(caja.current, {
      sitekey: SITE_KEY_TURNSTILE,
      language: "es",
      theme: "light",
      callback: (t: string) => alToken.current(t),
      "expired-callback": () => alToken.current(null),
      "error-callback": () => alToken.current(null),
    });
  }

  useEffect(() => {
    dibujar();
    return () => {
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  useEffect(() => {
    if (reinicio > 0 && id.current && window.turnstile) {
      alToken.current(null);
      window.turnstile.reset(id.current);
    }
  }, [reinicio]);

  if (!SITE_KEY_TURNSTILE) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={dibujar} />
      <div ref={caja} className="mt-5 min-h-[65px]" />
    </>
  );
}
