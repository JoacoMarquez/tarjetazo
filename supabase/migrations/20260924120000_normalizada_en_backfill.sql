-- Hasta ahora el runner pisaba `normalizada_en` con null cada vez que una página
-- llegaba sin cambios, así que casi todas las filas lo tienen vacío aunque ya
-- pasaron por el normalizador (#31). El runner nuevo solo considera "sin
-- cambios" una página con `normalizada_en`: sin este backfill re-normalizaría
-- el catálogo entero.
--
-- No se puede saber cuáles se bajaron solo con `--solo-fetch` y nunca se
-- normalizaron; se asume que todas lo fueron, que es lo que el pipeline venía
-- asumiendo. Quedan afuera las marcadas para re-normalizar (`hash = ''`).
update pagina_cruda
   set normalizada_en = fetched_at
 where normalizada_en is null
   and hash <> '';
