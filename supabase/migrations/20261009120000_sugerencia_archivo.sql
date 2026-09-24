-- La foto sugerida se baja en el scraper de catálogo (GitHub Actions), no al
-- aceptar: BBVA no le responde al servidor de Vercel (la conexión se cuelga).
-- `archivo` es la ruta en el bucket `tarjetas` (_sugeridas/<hash>.<ext>); null
-- si no se pudo bajar, y entonces el backoffice la intenta bajar al aceptar.
alter table producto_ficha_sugerencia add column archivo text;
