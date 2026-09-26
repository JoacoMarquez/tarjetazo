-- Página oficial de Nativa Cabal (entró en 20261019120000 sin ella, después de
-- la auditoría del catálogo). Espejo de PRODUCTOS en packages/core/src/fuentes.ts.
update producto set url_oficial = 'https://www.nativacabal.com.uy/tarjeta/'
 where id = 'nativa-cabal' and url_oficial is distinct from 'https://www.nativacabal.com.uy/tarjeta/';
