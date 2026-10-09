// Listas de valores sin zod: la web las usa en el navegador (filtros, selects)
// y zod pesa ~80 KB. enums.ts arma los z.enum a partir de estas.

export const DEPARTAMENTOS = [
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
] as const;

export const TIPOS_BENEFICIO = ["porcentaje", "cuotas", "reintegro", "2x1"] as const;
