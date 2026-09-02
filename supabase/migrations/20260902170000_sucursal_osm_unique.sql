-- El índice parcial no sirve para ON CONFLICT: Postgres exige repetir el
-- predicado, cosa que PostgREST no puede hacer. Un único índice común alcanza,
-- porque los NULL no chocan entre sí.
drop index if exists sucursal_osm_idx;
create unique index sucursal_osm_idx on sucursal (osm_id);
