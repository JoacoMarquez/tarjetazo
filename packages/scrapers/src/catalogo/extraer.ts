import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { UsoModelo } from "@tarjetazo/core";
import { MODELO } from "../normalizador.js";

/** Una tarjeta tal como la describe la página oficial del banco. */
export const TarjetaVistaSchema = z.object({
  nombre: z.string().describe("Nombre comercial tal cual lo usa el banco: 'Visa Oro', 'Pack Trilogy Select', 'Mastercard Black'"),
  red: z.enum(["visa", "mastercard", "amex", "otra"]),
  tier: z.enum(["clasica", "gold", "platinum", "black", "infinite", "signature", "world", "world_elite"]).describe("'Internacional' o sin nivel = clasica; 'Oro' = gold"),
  instrumento: z.enum(["credito", "debito", "prepaga"]),
  imagen: z.string().nullable().describe("Una de las URLs de imagen de la lista que muestre ESTA tarjeta; null si no hay"),
  costo_anual: z.number().nullable().describe("Costo anual o cuota de mantenimiento anualizada, sin separadores"),
  costo_moneda: z.enum(["UYU", "UI", "USD"]).nullable(),
  costo_bonificado: z.string().nullable().describe("Cuándo es gratis o más barata, textual y breve"),
  ingreso_minimo: z.number().nullable().describe("En pesos uruguayos"),
  requisitos: z.array(z.string()).describe("Requisitos para sacarla, cortos"),
  tasa_tea: z.number().nullable().describe("TEA en %, si la publican"),
  programa: z.string().nullable().describe("Programa de puntos o millas, breve"),
  seguros: z.array(z.string()),
  salas_vip: z.string().nullable(),
  link_solicitud: z.string().nullable().describe("URL para pedirla, si aparece"),
  otros: z.array(z.string()).describe("Otros beneficios propios de la tarjeta (no descuentos en comercios)"),
});
export type TarjetaVista = z.infer<typeof TarjetaVistaSchema>;

const PaginaCatalogoSchema = z.object({ tarjetas: z.array(TarjetaVistaSchema) });

const SISTEMA = `Leés páginas oficiales de bancos uruguayos sobre sus TARJETAS (no sobre descuentos en comercios) y devolvés cada tarjeta que la página describa.

Reglas:
- Una página puede describir varias tarjetas (Visa Internacional, Oro, Platinum…): una entrada por tarjeta. Un "pack" que trae varios plásticos es UNA tarjeta con el nombre del pack.
- No inventes: lo que la página no dice va en null o lista vacía. No completes con lo que sabés de otras fuentes.
- Solo tarjetas de personas. Si la página es de empresas, pymes, agro o corporativas, o no describe tarjetas, devolvé una lista vacía.
- Montos sin separadores de miles. "UI" es Unidad Indexada; si dice "U$S" o "USD" es USD; si no, pesos (UYU).
- En "imagen" elegí solo de la lista de URLs que te paso, la que muestre esa tarjeta. Si ninguna, null.`;

export async function extraerTarjetas(
  pagina: { url: string; texto: string; imagenes: string[] },
  cliente = new Anthropic(),
): Promise<{ tarjetas: TarjetaVista[]; uso: UsoModelo }> {
  const res = await cliente.messages.parse({
    model: MODELO,
    max_tokens: 8000,
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `URL: ${pagina.url}\n\nImágenes de la página:\n${pagina.imagenes.map((u) => `- ${u}`).join("\n") || "(ninguna)"}\n\n---\n${pagina.texto}`,
      },
    ],
    output_config: { format: zodOutputFormat(PaginaCatalogoSchema) },
  });
  const uso = {
    entrada: res.usage.input_tokens,
    cache_escritura: res.usage.cache_creation_input_tokens ?? 0,
    cache_lectura: res.usage.cache_read_input_tokens ?? 0,
    salida: res.usage.output_tokens,
  };
  const tarjetas = (res.parsed_output?.tarjetas ?? []).map((t) => ({
    ...t,
    // La imagen tiene que ser una de las que se vieron: nada inventado.
    imagen: t.imagen && pagina.imagenes.includes(t.imagen) ? t.imagen : null,
  }));
  return { tarjetas, uso };
}
