"use client";

import posthog from "posthog-js";
import { propiedadesSinTokens } from "./url-limpia";

let iniciado = false;

/** Las rutas internas no deben salir en las métricas del sitio público. */
export function esRutaAdmin(valor: string): boolean {
  try {
    const pathname = new URL(valor, "https://tarjetazo.uy").pathname;
    return pathname === "/admin" || pathname.startsWith("/admin/");
  } catch {
    return false;
  }
}

/**
 * Métricas anónimas (#114): visitas, de dónde vienen, clicks, embudos, mapas de
 * calor y grabación de sesiones con lo que se escribe enmascarado. Sin perfiles
 * de personas ni cookies: el visitante único lo cuenta PostHog con un hash que
 * rota cada día (`cookieless_mode`), así que no hace falta pedir consentimiento.
 * Se respeta "Do Not Track". Si no hay clave configurada, todo esto es un no-op.
 *
 * Los pedidos salen por `/ingest` (un rewrite a PostHog en `next.config.ts`):
 * los bloqueadores de anuncios cortan los dominios de PostHog y sin esto
 * perderíamos buena parte del tráfico.
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
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    cookieless_mode: "always",
    person_profiles: "never",
    // App Router: las navegaciones son del lado del cliente.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    capture_dead_clicks: true,
    enable_heatmaps: true,
    capture_performance: { web_vitals: true },
    session_recording: {
      // Lo que el visitante escribe (el buscador) no se graba.
      maskAllInputs: true,
    },
    respect_dnt: true,
    before_send: (captura) => {
      const url = captura?.properties.$current_url;
      if (typeof url === "string" && esRutaAdmin(url)) return null;
      // Un link de login o recuperación trae ?code= o #access_token=: no se manda.
      if (captura?.properties) propiedadesSinTokens(captura.properties);
      return captura;
    },
  });
  iniciado = true;
}

export type Evento =
  | "tarjetas_elegidas"
  | "filtro_aplicado"
  | "busqueda"
  | "comercio_elegido"
  | "click_saliente"
  | "billetera_abierta"
  | "tarjeta_agregada"
  | "tarjeta_quitada"
  | "catalogo_filtrado"
  | "mapa_comercio"
  | "favorito_agregado"
  | "favorito_quitado";

export function capturar(evento: Evento, props?: Record<string, unknown>) {
  if (!iniciado) return;
  posthog.capture(evento, props);
}
