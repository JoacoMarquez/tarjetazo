"use client";

import type { PostHog } from "posthog-js";
import { esRutaAdmin, propiedadesSinTokens } from "./url-limpia";
import { propiedadesDeUbicacion, type Ubicacion } from "./ubicacion";

export { esRutaAdmin };

let iniciado = false;
/** posthog-js (con la grabación de sesiones) pesa ~270 KB: se carga después de la página. */
let posthog: PostHog | null = null;
let arrancando = false;
let ubicacion: Record<string, string> = {};

/**
 * País y ciudad aproximados (`/api/ubicacion`, de las cabeceras de Vercel):
 * PostHog descarta la IP y sin ella no puede ubicar la visita. Uno por
 * pestaña; si tarda o falla, se mide igual sin ubicación.
 */
async function leerUbicacion(): Promise<Record<string, string>> {
  try {
    const guardada = sessionStorage.getItem("tz-ubicacion");
    if (guardada) return JSON.parse(guardada) as Record<string, string>;
  } catch {}
  try {
    const r = await fetch("/api/ubicacion", { signal: AbortSignal.timeout(1500) });
    const props = propiedadesDeUbicacion((await r.json()) as Ubicacion);
    try {
      sessionStorage.setItem("tz-ubicacion", JSON.stringify(props));
    } catch {}
    return props;
  } catch {
    return {};
  }
}

/**
 * Métricas anónimas (#114): visitas, de dónde vienen, clicks, embudos, mapas de
 * calor y grabación de sesiones con lo que se escribe enmascarado. Sin perfiles
 * de personas ni cookies: el visitante único lo cuenta PostHog con un hash que
 * rota cada día (`cookieless_mode`), así que no hace falta pedir consentimiento.
 * Se respeta "Do Not Track". Si no hay clave configurada, todo esto es un no-op.
 *
 * Los pedidos salen por `/ingest` (el proxy de `app/ingest/[...ruta]/route.ts`,
 * que además saca las cookies; no reemplazarlo por un rewrite): los
 * bloqueadores de anuncios cortan los dominios de PostHog y sin esto
 * perderíamos buena parte del tráfico.
 */
export async function iniciarAnalitica() {
  if (iniciado || arrancando || typeof window === "undefined") return;
  const clave = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!clave) return;
  // `window.doNotTrack` es la variante vieja de la señal y no está en los tipos
  // del DOM, pero varios navegadores todavía la usan.
  const dnt =
    navigator.doNotTrack ?? (window as { doNotTrack?: string }).doNotTrack ?? null;
  if (dnt === "1" || dnt === "yes") return;

  // Antes de iniciar, para que la primera página vista ya la lleve.
  arrancando = true;
  ubicacion = await leerUbicacion();

  posthog = (await import("posthog-js")).default;
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
      // Un link de login o recuperación trae ?code= o #access_token=: no se
      // manda. Tampoco lo de /admin que arrastran los mapas de calor.
      if (captura?.properties) {
        propiedadesSinTokens(captura.properties);
        Object.assign(captura.properties, ubicacion);
      }
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
  posthog?.capture(evento, props);
}
