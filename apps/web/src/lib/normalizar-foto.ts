import sharp from "sharp";

/** Proporción de una tarjeta ISO/IEC 7810 ID-1: 85,60 × 53,98 mm. */
const PROPORCION = 85.6 / 53.98;
/** Tarjeta ID-1 a ~300 dpi; lo mismo que sale de `RecorteImagen`. */
export const ANCHO = 1012;
export const ALTO = Math.round(ANCHO / PROPORCION);
/** Cuánto se puede apartar lo recortado de la proporción de una tarjeta (#72). */
const TOLERANCIA = 0.05;
/** Qué parte de lo recortado tiene que ser tarjeta: las esquinas redondeadas se comen ~1%. */
const LLENO = 0.9;

export type Recorte = { left: number; top: number; width: number; height: number };

export type FotoNormalizada =
  | { ok: true; bytes: Uint8Array; tipo: "image/webp" }
  /** Lo que quedó no es una tarjeta sola (una pila, una mano, un celular): va el recorte manual. */
  | { ok: false; motivo: string };

/**
 * Deja la foto de una tarjeta como las guarda Tarjetazo (#72): recortada a la
 * tarjeta, sin el fondo, el aire ni la sombra que ponen los bancos; acostada
 * (las verticales de Itaú, OCA y Scotia giran en sentido horario, así sus
 * textos laterales quedan derechos) y en 1012×638 WebP.
 *
 * Con `recorte`, el área de la tarjeta se da a mano: para las escenas de las
 * que se puede sacar una tarjeta derecha.
 */
export async function normalizarFoto(entrada: Uint8Array, recorte?: Recorte): Promise<FotoNormalizada> {
  let img = sharp(entrada).rotate(); // respeta la orientación EXIF
  if (recorte) img = sharp(await img.extract(recorte).toBuffer());
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const caja = recorte ? { left: 0, top: 0, width: info.width, height: info.height } : cajaDeLaTarjeta(data, info.width, info.height);
  if (!caja) return { ok: false, motivo: "no se encontró una tarjeta derecha en la foto" };

  const vertical = caja.height > caja.width;
  const r = vertical ? caja.height / caja.width : caja.width / caja.height;
  if (Math.abs(r / PROPORCION - 1) > TOLERANCIA) {
    return { ok: false, motivo: `lo recortado mide ${caja.width}×${caja.height}: no tiene proporción de tarjeta` };
  }

  let salida = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(caja);
  // Una vuelta en sharp se aplica después del extract, pero no antes del resize: va en dos pasos.
  if (vertical) salida = sharp(await salida.rotate(90).png().toBuffer());
  const bytes = await salida.resize(ANCHO, ALTO, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
  return { ok: true, bytes: new Uint8Array(bytes), tipo: "image/webp" };
}

/**
 * Dónde está la tarjeta. Un píxel es "de la tarjeta" si es opaco y no se
 * parece al color de las esquinas (el fondo que pegó el banco, si lo hay).
 * Después se miran filas y columnas: cuentan las que tienen al menos la mitad
 * de píxeles de tarjeta que la más llena. Así la sombra, que es tenue y más
 * angosta, y el antialias de los bordes quedan afuera.
 */
function cajaDeLaTarjeta(px: Buffer, w: number, h: number): Recorte | null {
  const fondos = coloresDeFondo(px, w, h);
  const esTarjeta = (i: number) =>
    px[i + 3]! >= 160 &&
    fondos.every((f) => Math.max(Math.abs(px[i]! - f[0]), Math.abs(px[i + 1]! - f[1]), Math.abs(px[i + 2]! - f[2])) > 28);
  const filas = new Array<number>(h).fill(0);
  const cols = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (esTarjeta((y * w + x) * 4)) {
        filas[y]!++;
        cols[x]!++;
      }
    }
  }
  const rango = (v: number[]) => {
    const umbral = Math.max(...v) / 2;
    const i = v.findIndex((n) => n >= umbral);
    let j = v.length - 1;
    while (j > i && v[j]! < umbral) j--;
    return i < 0 || umbral === 0 ? null : ([i, j + 1] as const);
  };
  const fy = rango(filas);
  const fx = rango(cols);
  if (!fx || !fy) return null;
  const caja = { left: fx[0], top: fy[0], width: fx[1] - fx[0], height: fy[1] - fy[0] };

  // Una tarjeta inclinada puede dar una caja con la proporción justa, pero no la llena.
  let adentro = 0;
  for (let y = caja.top; y < caja.top + caja.height; y++) {
    for (let x = caja.left; x < caja.left + caja.width; x++) if (esTarjeta((y * w + x) * 4)) adentro++;
  }
  if (adentro / (caja.width * caja.height) < LLENO) return null;
  // Tampoco alcanza con una inclinación de ~20° (Nativa): la caja cae casi
  // entera adentro de la tarjeta. Lo que no engaña son los bordes: en una
  // tarjeta derecha, el borde izquierdo está en la misma columna en todas las
  // filas del medio, y lo mismo el derecho, el de arriba y el de abajo.
  return bordesRectos(esTarjeta, w, h, caja) ? caja : null;
}

/** Cuánto se puede apartar una medida de un borde de la mediana, sobre el largo del lado. */
const TORCIDO = 0.015;
/** Cuántas de las 9 medidas de cada borde tienen que coincidir. */
const COINCIDEN = 7;

/**
 * Cada borde se mide en 9 filas (o columnas) del medio, buscando la tarjeta
 * desde afuera de la caja hacia adentro. Alguna medida puede errar (una
 * sombra, una parte del diseño del color del fondo): alcanza con que 7 caigan
 * juntas. En una tarjeta inclinada el borde avanza fila a fila y casi ninguna
 * coincide, en los cuatro bordes.
 */
function bordesRectos(esTarjeta: (i: number) => boolean, w: number, h: number, caja: Recorte): boolean {
  // Filas y columnas del medio: las esquinas son redondeadas.
  const medio = (a: number, largo: number) =>
    Array.from({ length: 9 }, (_, i) => Math.round(a + largo * (0.25 + (0.5 * i) / 8)));
  const borde = (desde: number, hasta: number, indice: (k: number) => number) => {
    const paso = hasta > desde ? 1 : -1;
    for (let k = desde; k !== hasta; k += paso) if (esTarjeta(indice(k))) return k;
    return null;
  };
  const recto = (medidas: (number | null)[], largo: number) => {
    const v = medidas.filter((x): x is number => x !== null).sort((a, b) => a - b);
    if (v.length < COINCIDEN) return false;
    const mediana = v[Math.floor(v.length / 2)]!;
    return v.filter((x) => Math.abs(x - mediana) <= TORCIDO * largo).length >= COINCIDEN;
  };
  const mx = Math.round(0.15 * caja.width);
  const my = Math.round(0.15 * caja.height);
  const limX = (x: number) => Math.min(w, Math.max(-1, x));
  const limY = (y: number) => Math.min(h, Math.max(-1, y));
  const derecha = caja.left + caja.width - 1;
  const abajo = caja.top + caja.height - 1;
  const filas = medio(caja.top, caja.height);
  const cols = medio(caja.left, caja.width);
  const enFila = (y: number) => (x: number) => (y * w + x) * 4;
  const enCol = (x: number) => (y: number) => (y * w + x) * 4;
  // Una inclinación tuerce los cuatro bordes; una sombra o un diseño del color
  // del fondo, uno solo. Alcanza con un borde recto por eje.
  return (
    (recto(filas.map((y) => borde(Math.max(0, caja.left - mx), limX(caja.left + mx), enFila(y))), caja.width) ||
      recto(filas.map((y) => borde(Math.min(w - 1, derecha + mx), limX(derecha - mx), enFila(y))), caja.width)) &&
    (recto(cols.map((x) => borde(Math.max(0, caja.top - my), limY(caja.top + my), enCol(x))), caja.height) ||
      recto(cols.map((x) => borde(Math.min(h - 1, abajo + my), limY(abajo - my), enCol(x))), caja.height))
  );
}

/**
 * Los colores de fondo: el de cada esquina opaca. Son varios porque BBVA pega
 * la tarjeta sobre dos bandas (gris arriba, blanco abajo).
 */
function coloresDeFondo(px: Buffer, w: number, h: number): [number, number, number][] {
  return [0, w - 1, (h - 1) * w, h * w - 1]
    .map((p) => p * 4)
    .filter((i) => px[i + 3]! >= 250)
    .map((i) => [px[i]!, px[i + 1]!, px[i + 2]!]);
}
