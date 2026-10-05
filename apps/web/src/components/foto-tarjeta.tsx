import Image from "next/image";

const BUCKET = "/storage/v1/object/public/tarjetas/";

/**
 * La foto de una tarjeta. Las del bucket de Supabase pasan por el optimizador
 * de Next: el original pesa 200–240 KB y una tarjeta del catálogo se ve a
 * ~350 px. Las demás (la vista previa de un archivo en /admin, una foto del
 * sitio del banco) van tal cual.
 */
export function FotoTarjeta({
  src,
  alt,
  sizes,
  prioritaria = false,
  className,
  style,
}: {
  src: string;
  alt: string;
  /** Ancho con que se ve, para elegir la variante (`sizes` de <img>). */
  sizes: string;
  prioritaria?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (src.includes(BUCKET)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={prioritaria}
        draggable={false}
        className={className}
        style={{ objectFit: "cover", ...style }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={prioritaria ? "eager" : "lazy"}
      draggable={false}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
