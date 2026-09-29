-- Información de comercios (#118): sitio web e Instagram del comercio, y
-- teléfono y horario de cada local. Salen de OpenStreetMap (los locales
-- vinculados por `osm_id`) y de las fuentes que los publican (Santander).
-- Solo se completan si están vacíos: lo cargado a mano no se pisa.
alter table comercio add column if not exists sitio_web text;
alter table comercio add column if not exists instagram text;

-- `horario` guarda el formato de OpenStreetMap ("Mo-Fr 09:00-20:00; Sa
-- 09:00-13:00"); la web lo traduce.
alter table sucursal add column if not exists telefono text;
alter table sucursal add column if not exists horario text;

-- La página del comercio lee los locales con esta función: suma teléfono y
-- horario. Cambia el tipo que devuelve, así que se recrea.
drop function if exists sucursales_de_comercio (text);
create function sucursales_de_comercio (p_key text)
returns table (
  id           uuid,
  nombre       text,
  direccion    text,
  localidad    text,
  departamento departamento,
  lat          double precision,
  lng          double precision,
  -- `precision` es palabra reservada (double precision): no sirve como nombre.
  exactitud    precision_geo,
  telefono     text,
  horario      text
)
language sql stable as $$
  select s.id, s.nombre, s.direccion, s.localidad, s.departamento,
         st_y(s.geom::geometry), st_x(s.geom::geometry), s.precision,
         s.telefono, s.horario
    from sucursal s
   where s.comercio_key = p_key
     and s.geom is not null
   order by s.departamento, s.localidad, s.direccion
   limit 200;
$$;
