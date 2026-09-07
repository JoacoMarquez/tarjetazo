-- "Cerca tuyo" de la home pinta cada local con el color de la tarjeta que
-- conviene ahí, y para eso necesita saber de qué fuente sale el mejor
-- beneficio de esa sucursal. `sucursales_en_bbox` sólo devolvía el máximo
-- agregado, que no dice de quién es.
--
-- Cambia la lista de columnas, así que hay que borrar la función antes:
-- `create or replace` no puede cambiar el tipo de retorno.
drop function if exists sucursales_en_bbox (
  double precision, double precision, double precision, double precision,
  text[], text[], text[], smallint, int
);

create function sucursales_en_bbox (
  p_sur     double precision,
  p_oeste   double precision,
  p_norte   double precision,
  p_este    double precision,
  p_fuentes    text[] default null,
  p_productos  text[] default null,
  p_categorias text[] default null,
  p_dia        smallint default null,
  p_limit      int default 300
)
returns table (
  sucursal_id  uuid,
  comercio_key text,
  comercio     text,
  categoria    text,
  logo_url     text,
  direccion    text,
  lat          double precision,
  lng          double precision,
  best_pct     numeric,
  max_cuotas   int,
  n_beneficios bigint,
  mejor_fuente_id text,
  mejor_fuente    text,
  mejor_productos text[]
)
language sql stable as $$
  with pares as (
    select s.id as sid, c.key, c.nombre, c.categoria, c.logo_url, s.direccion, s.geom,
           b.id as bid, b.porcentaje, b.cuotas, b.fuente_id, b.productos_elegibles,
           f.nombre as fuente_nombre
      from sucursal s
      join comercio c on c.key = s.comercio_key
      join beneficio b
        on b.comercio_key = c.key
       and b.estado_revision = 'ok'
       and beneficio_vigente(b)
       and (p_fuentes is null or b.fuente_id = any (p_fuentes))
       and aplica_a_productos(b, p_productos)
       and aplica_al_dia(b, p_dia)
      join fuente f on f.id = b.fuente_id
     where s.geom is not null
       and st_intersects(
             s.geom,
             st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::geography
           )
       and (p_categorias is null or c.categoria = any (p_categorias))
  ),
  agregado as (
    select sid, key, nombre, categoria, logo_url, direccion, geom,
           max(porcentaje) as best_pct, max(cuotas) as max_cuotas, count(bid) as n_beneficios
      from pares
     group by sid, key, nombre, categoria, logo_url, direccion, geom
  ),
  -- El beneficio que manda en cada sucursal: el de mayor descuento y, si
  -- ninguno tiene porcentaje, el de más cuotas.
  mejor as (
    select distinct on (sid) sid, fuente_id, fuente_nombre, productos_elegibles
      from pares
     order by sid, porcentaje desc nulls last, cuotas desc nulls last, bid
  )
  select a.sid, a.key, a.nombre, a.categoria, a.logo_url, a.direccion,
         st_y(a.geom::geometry), st_x(a.geom::geometry),
         a.best_pct, a.max_cuotas, a.n_beneficios,
         m.fuente_id, m.fuente_nombre, m.productos_elegibles
    from agregado a
    join mejor m on m.sid = a.sid
   order by a.best_pct desc nulls last
   limit p_limit;
$$;
