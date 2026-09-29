import { jsonLdSeguro } from "@/lib/json-ld";

/** Datos estructurados de la página (schema.org), escapados para ir dentro de un script. */
export function JsonLd({ datos }: { datos: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(datos) }} />;
}
