import { z } from "zod";

export const TipoFuente = z.enum(["banco", "emisor", "billetera", "club"]);
export const Instrumento = z.enum(["credito", "debito", "prepaga", "saldo"]);
export const Red = z.enum(["visa", "mastercard", "amex", "cabal", "propia"]);
export const Tier = z.enum(["gold", "platinum", "black", "signature"]);
export const TipoBeneficio = z.enum(["porcentaje", "cuotas", "reintegro", "2x1"]);
export const Canal = z.enum(["presencial", "online", "ambos"]);
export const Mecanica = z.enum(["qr", "nfc", "app"]);
export const TopePeriodo = z.enum(["dia", "semana", "mes", "compra", "beneficio"]);
export const EstadoRevision = z.enum(["ok", "revisar", "descartado"]);

/** 0 = domingo … 6 = sábado (mismo criterio que Date#getDay). */
export const DiaSemana = z.number().int().min(0).max(6);

export const Departamento = z.enum([
  "artigas",
  "canelones",
  "cerro-largo",
  "colonia",
  "durazno",
  "flores",
  "florida",
  "lavalleja",
  "maldonado",
  "montevideo",
  "paysandu",
  "rio-negro",
  "rivera",
  "rocha",
  "salto",
  "san-jose",
  "soriano",
  "tacuarembo",
  "treinta-y-tres",
]);

export type TipoFuente = z.infer<typeof TipoFuente>;
export type Instrumento = z.infer<typeof Instrumento>;
export type Red = z.infer<typeof Red>;
export type Tier = z.infer<typeof Tier>;
export type TipoBeneficio = z.infer<typeof TipoBeneficio>;
export type Canal = z.infer<typeof Canal>;
export type Mecanica = z.infer<typeof Mecanica>;
export type TopePeriodo = z.infer<typeof TopePeriodo>;
export type EstadoRevision = z.infer<typeof EstadoRevision>;
export type Departamento = z.infer<typeof Departamento>;
