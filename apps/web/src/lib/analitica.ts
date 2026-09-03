"use client";

import posthog from "posthog-js";

let iniciado = false;

/**
 * Métricas agregadas, sin perfiles de personas: no identificamos usuarios, no
 * grabamos sesiones y respetamos "Do Not Track". Si no hay clave configurada,
 * todo esto es un no-op.
 */
export function iniciarAnalitica() {
  if (iniciado || typeof window === "undefined") return;
  const clave = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!clave) return;
  // `window.doNotTrack` es la variante vieja de la señal y no está en los tipos
  // del DOM, pero varios navegadores todavía la usan.
  const dnt =
    navigator.doNotTrack ?? (window as { doNotTrack?: string }).doNotTrack ?? null;
  if (dnt === "1" || dnt === "yes") return;

  posthog.init(clave, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "never",
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    autocapture: false,
  });
  iniciado = true;
}

export type Evento =
  | "tarjetas_elegidas"
  | "filtro_aplicado"
  | "busqueda"
  | "comercio_elegido"
  | "click_saliente";

export function capturar(evento: Evento, props?: Record<string, unknown>) {
  if (!iniciado) return;
  posthog.capture(evento, props);
}
