import { cn } from "@/lib/utils";

/** Hasta dos iniciales: "Helados Zero" → "HZ". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

/**
 * El logo del comercio (#118) o, si no hay, sus iniciales. Los logos vienen
 * del bucket `comercios` y son cuadrados; se muestran enteros sobre blanco.
 */
export function LogoComercio({
  nombre,
  logo,
  className,
}: {
  nombre: string;
  logo: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-papel text-humo font-display inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold",
        logo && "border-linea border bg-white",
        className,
      )}
      aria-hidden
    >
      {logo ? (
        // Del bucket de Supabase: sin optimizador de Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" draggable={false} className="size-full object-contain p-[12%]" />
      ) : (
        iniciales(nombre)
      )}
    </span>
  );
}
