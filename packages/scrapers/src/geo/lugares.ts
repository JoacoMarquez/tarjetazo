/**
 * De un nombre de lugar al departamento: "Pocitos" → montevideo, "Dolores" →
 * soriano, "Punta del Este" → maldonado. Lo usan los parsers que leen
 * direcciones escritas (Pronto+, BBVA) para saber dónde geocodificar.
 */

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Departamentos que nombra el texto; un nombre seguido de un número es una calle. */
const LUGARES: [RegExp, string][] = [
  [/montevideo|pocitos|carrasco|punta carretas|prado|mercado ferrando/g, "montevideo"],
  [/canelones|ciudad de la costa|lagomar|\bpando\b|\bpinar\b|las piedras|barra de carrasco/g, "canelones"],
  [/maldonado|punta del este|san carlos|piriapolis/g, "maldonado"],
  [/colonia|carmelo|nueva palmira|rosario/g, "colonia"],
  [/paysandu/g, "paysandu"], [/\bsalto\b/g, "salto"], [/rivera/g, "rivera"], [/\bartigas\b/g, "artigas"],
  [/treinta y tres/g, "treinta-y-tres"], [/lavalleja|\bminas\b/g, "lavalleja"], [/\bflorida\b/g, "florida"],
  [/soriano|mercedes/g, "soriano"], [/rio negro|fray bentos/g, "rio-negro"], [/san jose/g, "san-jose"],
  [/\brocha\b/g, "rocha"], [/durazno/g, "durazno"], [/\bflores\b(?! de bach)|trinidad/g, "flores"], [/tacuarembo/g, "tacuarembo"],
  [/cerro largo|\bmelo\b/g, "cerro-largo"],
];

export function departamentos(t: string): string[] {
  const out = new Set<string>();
  for (const [re, depto] of LUGARES) {
    for (const m of t.matchAll(re)) {
      const antes = t.slice(0, m.index!);
      const despues = t.slice(m.index! + m[0].length);
      if (/^\s*\d/.test(despues)) continue;
      if (/\b(av|avda|avenida|br|bv|calle|rambla|esquina|esq)\.?\s+$/.test(antes)) continue;
      out.add(depto);
    }
  }
  return [...out].sort();
}

/** Barrios de Montevideo que las fuentes usan como "localidad". */
const BARRIOS_MONTEVIDEO = [
  "centro", "ciudad vieja", "cordon", "palermo", "parque rodo", "punta carretas", "pocitos", "buceo", "malvin", "punta gorda",
  "carrasco", "parque batlle", "tres cruces", "la blanqueada", "union", "prado", "capurro", "aguada", "goes", "jacinto vera",
  "la comercial", "sayago", "colon", "cerro", "belvedere", "la teja", "villa espanola", "maronas", "piedras blancas",
  "atahualpa", "reducto", "brazo oriental", "barrio sur", "villa biarritz", "villa dolores", "la figurita", "penarol",
];

/** Localidades que no dicen su departamento. */
const LOCALIDADES: Record<string, string> = {
  "san jose de mayo": "san-jose", libertad: "san-jose", "ciudad del plata": "san-jose",
  trinidad: "flores", "fray bentos": "rio-negro", young: "rio-negro", mercedes: "soriano", dolores: "soriano", cardona: "soriano",
  "san carlos": "maldonado", "punta del este": "maldonado", "la barra": "maldonado", "jose ignacio": "maldonado",
  "puerto de punta del este": "maldonado", "punta ballena": "maldonado",
  "ciudad de la costa": "canelones", lagomar: "canelones", pando: "canelones", "las piedras": "canelones",
  atlantida: "canelones", "la paz": "canelones", progreso: "canelones", "santa lucia": "canelones",
  carmelo: "colonia", "nueva palmira": "colonia", "colonia del sacramento": "colonia", rosario: "colonia",
  "juan lacaze": "colonia", "nueva helvecia": "colonia", tarariras: "colonia",
  minas: "lavalleja", "paso de los toros": "tacuarembo", "rio branco": "cerro-largo", chuy: "rocha", "la paloma": "rocha",
  "bella union": "artigas", "nuevo paysandu": "paysandu", guichon: "paysandu",
};

export function departamentoDeLugar(lugar: string): string | null {
  const l = sinAcentos(lugar).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (LOCALIDADES[l]) return LOCALIDADES[l]!;
  if (BARRIOS_MONTEVIDEO.includes(l)) return "montevideo";
  const d = departamentos(l);
  return d.length === 1 ? d[0]! : null;
}
