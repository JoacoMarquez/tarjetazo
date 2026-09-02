-- Consultas de la pantalla principal (hito 4). Van como funciones y no como
-- queries de PostgREST porque los filtros "vacío = todos" (días, productos,
-- departamentos) se expresan mal en la URL y peor se leen.

-- Un beneficio aplica a mis tarjetas si no restringe productos, o si alguno de
-- los míos está en la lista.
create or replace function aplica_a_productos (b beneficio, p_productos text[])
returns boolean language sql immutable as $$
  select p_productos is null
      or cardinality(b.productos_elegibles) = 0
      or b.productos_elegibles && p_productos;
$$;

-- Un beneficio aplica un día si no restringe días, o si incluye ese día.
create or replace function aplica_al_dia (b beneficio, p_dia smallint)
returns boolean language sql immutable as $$
  select p_dia is null
      or cardinality(b.dias_semana) = 0
      or p_dia = any (b.dias_semana);
$$;

create or replace function beneficios_filtrados (
  p_fuentes       text[] default null,
  p_productos     text[] default null,
  p_categorias    text[] default null,
  p_departamentos text[] default null,
  p_dia           smallint default null,
  p_tipos         text[] default null,
  p_comercio      text default null,
  p_orden         text default 'relevancia',
  p_limit         int default 50,
  p_offset        int default 0
)
returns table (
  id             text,
  fuente_id      text,
  fuente_nombre  text,
  comercio_key   text,
  comercio       text,
  categoria      text,
  logo_url       text,
  titulo         text,
  descuento_raw  text,
  porcentaje     numeric,
  cuotas         int,
  tipo           tipo_beneficio,
  dias_semana    smallint[],
  tope_monto     numeric,
  tope_periodo   tope_periodo,
  canal          canal,
  vigencia_hasta date,
  productos_elegibles text[],
  n_sucursales   bigint,
  total          bigint
)
language sql stable as $$
  with filtrados as (
    select b.*, c.nombre as comercio_nombre, c.categoria as comercio_categoria,
           c.logo_url as comercio_logo, f.nombre as fuente_nombre
      from beneficio b
      join comercio c on c.key = b.comercio_key
      join fuente f on f.id = b.fuente_id
     where b.estado_revision = 'ok'
       and beneficio_vigente(b)
       and (p_fuentes is null or b.fuente_id = any (p_fuentes))
       and (p_categorias is null or c.categoria = any (p_categorias))
       and (p_tipos is null or b.tipo::text = any (p_tipos))
       and (p_comercio is null or b.comercio_key = p_comercio)
       and (
         p_departamentos is null
         or cardinality(b.departamentos) = 0
         or b.departamentos::text[] && p_departamentos
       )
       and aplica_a_productos(b, p_productos)
       and aplica_al_dia(b, p_dia)
  )
  select f.id, f.fuente_id, f.fuente_nombre, f.comercio_key, f.comercio_nombre,
         f.comercio_categoria, f.comercio_logo, f.titulo, f.descuento_raw,
         f.porcentaje, f.cuotas, f.tipo, f.dias_semana, f.tope_monto,
         f.tope_periodo, f.canal, f.vigencia_hasta, f.productos_elegibles,
         (select count(*) from sucursal s where s.comercio_key = f.comercio_key and s.geom is not null),
         count(*) over ()
    from filtrados f
   order by
     case when p_orden = 'porcentaje' then f.porcentaje end desc nulls last,
     case when p_orden = 'cuotas' then f.cuotas end desc nulls last,
     -- Relevancia: primero lo que más ahorra y, a igualdad, lo que vence antes.
     case when p_orden = 'relevancia' then coalesce(f.porcentaje, 0) end desc,
     f.vigencia_hasta asc nulls last,
     f.comercio_nombre asc
   limit p_limit offset p_offset;
$$;

-- Puntos del mapa dentro del cuadro visible. Devuelve una fila por sucursal con
-- el mejor beneficio vigente de su comercio.
create or replace function sucursales_en_bbox (
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
  n_beneficios bigint
)
language sql stable as $$
  select s.id, c.key, c.nombre, c.categoria, c.logo_url, s.direccion,
         st_y(s.geom::geometry), st_x(s.geom::geometry),
         max(b.porcentaje), max(b.cuotas), count(b.id)
    from sucursal s
    join comercio c on c.key = s.comercio_key
    join beneficio b
      on b.comercio_key = c.key
     and b.estado_revision = 'ok'
     and beneficio_vigente(b)
     and (p_fuentes is null or b.fuente_id = any (p_fuentes))
     and aplica_a_productos(b, p_productos)
     and aplica_al_dia(b, p_dia)
   where s.geom is not null
     and st_intersects(
           s.geom,
           st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::geography
         )
     and (p_categorias is null or c.categoria = any (p_categorias))
   group by s.id, c.key, c.nombre, c.categoria, c.logo_url, s.direccion, s.geom
   order by max(b.porcentaje) desc nulls last
   limit p_limit;
$$;

-- Buscador "¿dónde vas a pagar?": comercios por nombre, con el mejor beneficio
-- que le sirve a las tarjetas del usuario.
create or replace function buscar_comercios (
  p_q         text,
  p_fuentes   text[] default null,
  p_productos text[] default null,
  p_limit     int default 8
)
returns table (
  comercio_key   text,
  comercio       text,
  categoria      text,
  logo_url       text,
  best_pct       numeric,
  max_cuotas     int,
  mejor_fuente   text,
  mejor_titulo   text,
  n_beneficios   bigint
)
language sql stable as $$
  with candidatos as (
    select c.key, c.nombre, c.categoria, c.logo_url, b.porcentaje, b.cuotas,
           f.nombre as fuente, b.titulo,
           row_number() over (partition by c.key order by b.porcentaje desc nulls last) as rn,
           count(*) over (partition by c.key) as n
      from comercio c
      join beneficio b on b.comercio_key = c.key
       and b.estado_revision = 'ok'
       and beneficio_vigente(b)
       and (p_fuentes is null or b.fuente_id = any (p_fuentes))
       and aplica_a_productos(b, p_productos)
      join fuente f on f.id = b.fuente_id
     where c.nombre ilike '%' || p_q || '%'
  )
  select key, nombre, categoria, logo_url, porcentaje, cuotas, fuente, titulo, n
    from candidatos
   where rn = 1
   order by porcentaje desc nulls last, nombre
   limit p_limit;
$$;
