import { z } from "zod";
import { Departamento } from "@tarjetazo/core";

const VALIDOS = new Set(Departamento.options as readonly string[]);

/**
 * Los nombres que devuelven OSM e ide.uy vienen en mayúsculas y con acentos
 * ("SAN JOSÉ", "TACUAREMBÓ"); nuestro enum usa slugs.
 */
export function slugDepartamento(nombre: string | null): z.infer<typeof Departamento> | null {
  if (!nombre) return null;
  const slug = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
  return VALIDOS.has(slug) ? (slug as z.infer<typeof Departamento>) : null;
}

export const DEPARTAMENTOS = Departamento.options;
