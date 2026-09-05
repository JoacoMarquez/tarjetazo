-- Páginas de comercio (hito 7). Las sucursales llevan un geography y PostgREST
-- lo devuelve como WKB en hexa: esta función las entrega con lat/lng.
create or replace function sucursales_de_comercio (p_key text)
returns table (
  id           uuid,
  nombre       text,
  direccion    text,
  localidad    text,
  departamento departamento,
  lat          double precision,
  lng          double precision,
  precision    precision_geo
)
language sql stable as $$
  select s.id, s.nombre, s.direccion, s.localidad, s.departamento,
         st_y(s.geom::geometry), st_x(s.geom::geometry), s.precision
    from sucursal s
   where s.comercio_key = p_key
     and s.geom is not null
   order by s.departamento, s.localidad, s.direccion
   limit 200;
$$;
