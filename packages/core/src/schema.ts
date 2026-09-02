import { z } from "zod";
import {
  Canal,
  Departamento,
  DiaSemana,
  EstadoRevision,
  Instrumento,
  Mecanica,
  Red,
  Tier,
  TipoBeneficio,
  TipoFuente,
  TopePeriodo,
} from "./enums";

/** Slug en kebab-case, sin acentos: `tienda-inglesa`, `brou`. */
export const Slug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "debe ser kebab-case sin acentos");

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato YYYY-MM-DD");
const url = z.string().url();

export const FuenteSchema = z.object({
  id: Slug,
  nombre: z.string().min(2),
  tipo: TipoFuente,
  logo_url: url.nullable().default(null),
  url: url,
  activa: z.boolean().default(true),
});

export const ProductoSchema = z.object({
  id: Slug,
  fuente_id: Slug,
  nombre: z.string().min(2),
  instrumento: Instrumento,
  red: Red,
  tier: Tier.nullable().default(null),
});

export const CategoriaSchema = z.object({
  slug: Slug,
  label: z.string().min(2),
  orden: z.number().int().nonnegative(),
  en_home: z.boolean().default(false),
});

export const ComercioSchema = z.object({
  key: Slug,
  nombre: z.string().min(2),
  categoria: Slug,
  logo_url: url.nullable().default(null),
  /** Campos derivados: los recalcula el pipeline, no el scraper. */
  best_pct: z.number().min(0).max(100).nullable().default(null),
  max_cuotas: z.number().int().min(0).nullable().default(null),
  n_beneficios: z.number().int().nonnegative().default(0),
  n_fuentes: z.number().int().nonnegative().default(0),
});

export const SucursalSchema = z.object({
  id: z.string().uuid().optional(),
  comercio_key: Slug,
  direccion: z.string().min(4),
  localidad: z.string().min(2).nullable().default(null),
  departamento: Departamento,
  lat: z.number().min(-35.2).max(-30.0).nullable().default(null),
  lng: z.number().min(-58.6).max(-53.0).nullable().default(null),
});

export const BeneficioSchema = z
  .object({
    id: z.string().min(4),
    fuente_id: Slug,
    comercio_key: Slug,
    titulo: z.string().min(4).max(160),
    /** Texto tal cual lo publica la fuente ("25% de descuento, tope $1.500"). */
    descuento_raw: z.string().min(1),
    porcentaje: z.number().min(0).max(100).nullable().default(null),
    cuotas: z.number().int().min(0).max(36).nullable().default(null),
    tipo: TipoBeneficio,
    /** Vacío = todos los días. */
    dias_semana: z.array(DiaSemana).default([]),
    vigencia_desde: fechaISO.nullable().default(null),
    vigencia_hasta: fechaISO.nullable().default(null),
    /** Vacío = todo el país. */
    departamentos: z.array(Departamento).default([]),
    /** Vacío = todos los productos de la fuente. */
    productos_elegibles: z.array(Slug).default([]),
    tope_monto: z.number().nonnegative().nullable().default(null),
    tope_periodo: TopePeriodo.nullable().default(null),
    canal: Canal.default("presencial"),
    mecanica: z.array(Mecanica).default([]),
    acumulable: z.boolean().nullable().default(null),
    compra_minima: z.number().nonnegative().nullable().default(null),
    requiere_activacion: z.boolean().default(false),
    legales_raw: z.string().nullable().default(null),
    como_usarlo: z.array(z.string().min(3)).default([]),
    url_fuente: url,
    fetched_at: z.string().datetime(),
    estado_revision: EstadoRevision.default("ok"),
  })
  .superRefine((b, ctx) => {
    if (b.tipo === "porcentaje" && b.porcentaje === null) {
      ctx.addIssue({ code: "custom", path: ["porcentaje"], message: "un beneficio de tipo porcentaje necesita porcentaje" });
    }
    if (b.tipo === "cuotas" && b.cuotas === null) {
      ctx.addIssue({ code: "custom", path: ["cuotas"], message: "un beneficio de tipo cuotas necesita cuotas" });
    }
    if (b.tope_monto !== null && b.tope_periodo === null) {
      ctx.addIssue({ code: "custom", path: ["tope_periodo"], message: "si hay tope_monto hace falta tope_periodo" });
    }
    if (b.vigencia_desde && b.vigencia_hasta && b.vigencia_hasta < b.vigencia_desde) {
      ctx.addIssue({ code: "custom", path: ["vigencia_hasta"], message: "vigencia_hasta es anterior a vigencia_desde" });
    }
  });

/** Lo que devuelve el normalizador de Claude antes de que el pipeline agregue metadatos. */
export const BeneficioNormalizadoSchema = BeneficioSchema.innerType().omit({
  id: true,
  fuente_id: true,
  fetched_at: true,
  estado_revision: true,
});

export type Fuente = z.infer<typeof FuenteSchema>;
export type Producto = z.infer<typeof ProductoSchema>;
export type Categoria = z.infer<typeof CategoriaSchema>;
export type Comercio = z.infer<typeof ComercioSchema>;
export type Sucursal = z.infer<typeof SucursalSchema>;
export type Beneficio = z.infer<typeof BeneficioSchema>;
export type BeneficioNormalizado = z.infer<typeof BeneficioNormalizadoSchema>;
