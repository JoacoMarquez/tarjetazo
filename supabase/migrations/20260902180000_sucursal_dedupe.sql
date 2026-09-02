-- La unicidad por (comercio, dirección, departamento) asumía que la dirección
-- venía de la fuente y era única. Los locales de OSM se identifican por osm_id,
-- y dos sucursales distintas de la misma cadena pueden compartir la dirección
-- normalizada (o caer las dos al nombre de la localidad).
alter table sucursal drop constraint sucursal_comercio_key_direccion_departamento_key;

-- Para las direcciones que sí publica una fuente, la regla sigue valiendo.
create unique index sucursal_direccion_idx
  on sucursal (comercio_key, direccion, departamento)
  where osm_id is null;
