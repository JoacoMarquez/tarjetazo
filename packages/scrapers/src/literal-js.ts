/**
 * Lee literales de JavaScript (objetos, arrays, strings, números, true/false/
 * null/undefined) sin ejecutar nada. Algunas fuentes publican sus datos como
 * código (`pushBenefit({ titulo: '…', })`): claves sin comillas, comillas
 * simples, comas finales, comentarios. No es JSON, pero tampoco hace falta
 * correrlo: cualquier otra cosa (llamadas, variables, expresiones) es un error.
 */

export type ValorJs = string | number | boolean | null | undefined | ValorJs[] | { [clave: string]: ValorJs };

class Lector {
  i: number;
  constructor(
    readonly src: string,
    inicio: number,
  ) {
    this.i = inicio;
  }

  error(msg: string): never {
    throw new Error(`literal JS: ${msg} en la posición ${this.i}`);
  }

  espacios() {
    for (;;) {
      const c = this.src[this.i];
      if (c === undefined) return;
      if (/\s/.test(c)) this.i++;
      else if (this.src.startsWith("//", this.i)) {
        const fin = this.src.indexOf("\n", this.i);
        this.i = fin < 0 ? this.src.length : fin + 1;
      } else if (this.src.startsWith("/*", this.i)) {
        const fin = this.src.indexOf("*/", this.i + 2);
        if (fin < 0) this.error("comentario sin cerrar");
        this.i = fin + 2;
      } else return;
    }
  }

  valor(profundidad = 0): ValorJs {
    if (profundidad > 50) this.error("demasiado anidado");
    this.espacios();
    const c = this.src[this.i];
    if (c === "{") return this.objeto(profundidad);
    if (c === "[") return this.array(profundidad);
    if (c === "'" || c === '"') return this.texto();
    if (c !== undefined && /[-+\d.]/.test(c)) return this.numero();
    for (const [palabra, v] of [["true", true], ["false", false], ["null", null], ["undefined", undefined]] as const) {
      if (this.src.startsWith(palabra, this.i) && !/[\w$]/.test(this.src[this.i + palabra.length] ?? "")) {
        this.i += palabra.length;
        return v;
      }
    }
    return this.error(`valor inesperado ${JSON.stringify(c)}`);
  }

  objeto(profundidad: number): { [clave: string]: ValorJs } {
    // Sin prototipo: una clave "__proto__" en los datos no toca nada.
    const out: { [clave: string]: ValorJs } = Object.create(null);
    this.i++;
    for (;;) {
      this.espacios();
      if (this.src[this.i] === "}") {
        this.i++;
        return out;
      }
      const clave = this.clave();
      this.espacios();
      if (this.src[this.i] !== ":") this.error("falta ':'");
      this.i++;
      out[clave] = this.valor(profundidad + 1);
      this.espacios();
      if (this.src[this.i] === ",") this.i++;
      else if (this.src[this.i] !== "}") this.error("falta ',' o '}'");
    }
  }

  clave(): string {
    const c = this.src[this.i];
    if (c === "'" || c === '"') return this.texto();
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(this.src.slice(this.i, this.i + 200));
    if (!m) return this.error("clave inválida");
    this.i += m[0].length;
    return m[0];
  }

  array(profundidad: number): ValorJs[] {
    const out: ValorJs[] = [];
    this.i++;
    for (;;) {
      this.espacios();
      if (this.src[this.i] === "]") {
        this.i++;
        return out;
      }
      out.push(this.valor(profundidad + 1));
      this.espacios();
      if (this.src[this.i] === ",") this.i++;
      else if (this.src[this.i] !== "]") this.error("falta ',' o ']'");
    }
  }

  texto(): string {
    const comilla = this.src[this.i]!;
    let out = "";
    this.i++;
    for (;;) {
      const c = this.src[this.i];
      if (c === undefined || c === "\n") this.error("string sin cerrar");
      this.i++;
      if (c === comilla) return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.src[this.i++];
      if (e === "n") out += "\n";
      else if (e === "t") out += "\t";
      else if (e === "r") out += "\r";
      else if (e === "b") out += "\b";
      else if (e === "f") out += "\f";
      else if (e === "v") out += "\v";
      else if (e === "0" && !/\d/.test(this.src[this.i] ?? "")) out += "\0";
      else if (e === "u" || e === "x") {
        const largo = e === "u" ? 4 : 2;
        const hex = this.src.slice(this.i, this.i + largo);
        if (!new RegExp(`^[0-9a-fA-F]{${largo}}$`).test(hex)) this.error("escape inválido");
        out += String.fromCharCode(parseInt(hex, 16));
        this.i += largo;
      } else if (e === "\n") {
        // Continuación de línea: no agrega nada.
      } else if (e === undefined) this.error("string sin cerrar");
      else out += e;
    }
  }

  numero(): number {
    const m = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(this.src.slice(this.i, this.i + 50));
    if (!m) return this.error("número inválido");
    this.i += m[0].length;
    return Number(m[0]);
  }
}

/** Lee un literal que empieza en `inicio`. Devuelve el valor y dónde termina. */
export function leerLiteral(src: string, inicio = 0): { valor: ValorJs; fin: number } {
  const l = new Lector(src, inicio);
  const valor = l.valor();
  return { valor, fin: l.i };
}

/**
 * Los argumentos de cada llamada `nombre(…)` del código, leídos como literales.
 * Una llamada con algo que no sea un literal no aparece: una rota no invalida
 * el resto.
 */
export function argumentosDeLlamadas(src: string, nombre: string): ValorJs[][] {
  const out: ValorJs[][] = [];
  const patron = new RegExp(`(?<![\\w$.])${nombre.replace(/[$]/g, "\\$")}\\s*\\(`, "g");
  for (const m of src.matchAll(patron)) {
    const l = new Lector(src, m.index! + m[0].length);
    try {
      const args: ValorJs[] = [];
      for (;;) {
        l.espacios();
        if (src[l.i] === ")") break;
        args.push(l.valor());
        l.espacios();
        if (src[l.i] === ",") l.i++;
        else if (src[l.i] !== ")") l.error("falta ',' o ')'");
      }
      out.push(args);
    } catch {
      // La definición de la función (`function pushBenefit(data) {`) y cualquier
      // llamada que no sea de literales no son datos.
    }
  }
  return out;
}
