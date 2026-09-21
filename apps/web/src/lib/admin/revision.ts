import {
  esErrorDeTramo,
  normalizarNombreTarjeta,
  problemasDeMotivo,
} from "@tarjetazo/core";

/** Lógica pura de la cola de revisión; las queries viven en la página y las actions. */

export type Revision = {
  id: string;
  fuente_id: string;
  motivo: string;
  url_fuente: string | null;
  /** Clave de la página en `pagina_cruda`. Null en filas anteriores a la columna. */
  external_id: string | null;
  created_at: string;
  descartados: string[];
};

/** Textos normalizados que ya tienen alias o regla de ignorar, por fuente. */
export type Cubiertos = Map<string, Set<string>>;

export function armarCubiertos(
  filas: { fuente_id: string; texto: string }[],
): Cubiertos {
  const m: Cubiertos = new Map();
  for (const f of filas) {
    const s = m.get(f.fuente_id) ?? new Set<string>();
    s.add(f.texto);
    m.set(f.fuente_id, s);
  }
  return m;
}

/**
 * Lo que sigue sin resolver en una fila. Un nombre de tarjeta se cubre con un
 * alias, una regla de ignorar o descartándolo en esa fila; un error de tramo,
 * solo descartándolo.
 */
export function pendientesDe(r: Revision, cubiertos: Cubiertos): string[] {
  const reglas = cubiertos.get(r.fuente_id);
  const descartados = new Set(r.descartados);
  return problemasDeMotivo(r.motivo).filter((p) => {
    if (descartados.has(p)) return false;
    if (esErrorDeTramo(p)) return true;
    return !reglas?.has(normalizarNombreTarjeta(p));
  });
}

export type Grupo = {
  fuenteId: string;
  /** Clave del grupo: el nombre normalizado, o el error de tramo tal cual. */
  clave: string;
  /** Como lo escribió la fuente (la primera variante que apareció). */
  etiqueta: string;
  esTramo: boolean;
  /** Ids de las filas donde aparece. */
  filas: string[];
  /** Links de ejemplo a la fuente (varias páginas pueden compartir una URL). */
  urls: string[];
  /**
   * Páginas distintas afectadas, por `external_id`. Una página re-normalizada
   * puede tener varias filas; las filas viejas sin clave cuentan por URL.
   */
  paginas: string[];
};

/** Un grupo por problema y fuente, de más páginas afectadas a menos. */
export function agrupar(revisiones: Revision[], cubiertos: Cubiertos): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const r of revisiones) {
    for (const p of pendientesDe(r, cubiertos)) {
      const esTramo = esErrorDeTramo(p);
      const clave = esTramo ? p : normalizarNombreTarjeta(p);
      // Los ids de fuente son slugs: "::" no puede aparecer en uno.
      const k = `${r.fuente_id}::${clave}`;
      const g = grupos.get(k) ?? {
        fuenteId: r.fuente_id,
        clave,
        etiqueta: p,
        esTramo,
        filas: [],
        urls: [],
        paginas: [],
      };
      g.filas.push(r.id);
      if (r.url_fuente && !g.urls.includes(r.url_fuente)) g.urls.push(r.url_fuente);
      const pagina = r.external_id ?? `url:${r.url_fuente ?? r.id}`;
      if (!g.paginas.includes(pagina)) g.paginas.push(pagina);
      grupos.set(k, g);
    }
  }
  return [...grupos.values()].sort(
    (a, b) =>
      Number(a.esTramo) - Number(b.esTramo) ||
      b.paginas.length - a.paginas.length ||
      a.fuenteId.localeCompare(b.fuenteId) ||
      a.clave.localeCompare(b.clave),
  );
}
