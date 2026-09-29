/**
 * JSON-LD para `<script type="application/ld+json">`. `JSON.stringify` deja
 * `<` tal cual, y el texto de los beneficios, comercios y locales viene de
 * afuera (bancos, OSM): un `</script>` adentro cerraría el bloque. Escapados
 * como `<`, siguen siendo el mismo JSON.
 */
export function jsonLdSeguro(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
