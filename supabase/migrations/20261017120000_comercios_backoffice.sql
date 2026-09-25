-- Página de comercios del backoffice: cobertura de cada comercio (beneficios,
-- sucursales, pin en el mapa) y sugerencias de ubicación. Scotiabank e Itaú no
-- publican direcciones; OSM encuentra un tercio de los comercios por nombre y
-- con errores ("Obra" es una inmobiliaria), así que todo lo que trae es una
-- sugerencia que el operador acepta o ignora, como las fichas de tarjeta.

create table sucursal_sugerencia (
  id           uuid primary key default gen_random_uuid(),
  comercio_key text not null references comercio (key) on delete cascade,
  fuente       text not null default 'osm',
  osm_id       text,                         -- "node/123": para no sugerir dos veces lo mismo
  nombre       text,                         -- el nombre en OSM
  direccion    text not null,
  localidad    text,
  departamento departamento,
  lat          double precision not null,
  lng          double precision not null,
  tipo         text,                         -- "amenity/restaurant"
  consulta     text not null,                -- lo que se buscó
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'ignorada')),
  creada_en    timestamptz not null default now(),
  resuelta_en  timestamptz,
  -- Restricción común y no índice parcial: el upsert de PostgREST no acepta
  -- índices parciales en ON CONFLICT. Los null no chocan entre sí.
  unique (comercio_key, osm_id)
);
create index sucursal_sugerencia_pendiente_idx on sucursal_sugerencia (comercio_key) where estado = 'pendiente';

-- Cuándo se buscó cada comercio: no volver a preguntarle a OSM todas las semanas
-- por lo que no encontró.
create table ubicacion_busqueda (
  comercio_key text primary key references comercio (key) on delete cascade,
  fuente       text not null default 'osm',
  buscado_en   timestamptz not null default now(),
  encontrados  int not null default 0
);

alter table sucursal_sugerencia enable row level security;
alter table ubicacion_busqueda  enable row level security;
-- Sin policies: solo la service role (backoffice y job de geo).

-- Un renglón por comercio con beneficios vigentes publicados.
create or replace function admin_comercios ()
returns table (
  key text, nombre text, categoria text, fuentes text[], beneficios int,
  sucursales int, con_pin int, sugerencias int, buscado_en timestamptz
)
language sql stable as $$
  select c.key, c.nombre, c.categoria,
         array_agg(distinct b.fuente_id order by b.fuente_id),
         count(distinct b.id)::int,
         (select count(*) from sucursal s where s.comercio_key = c.key)::int,
         (select count(*) from sucursal s where s.comercio_key = c.key and s.geom is not null)::int,
         (select count(*) from sucursal_sugerencia g where g.comercio_key = c.key and g.estado = 'pendiente')::int,
         (select u.buscado_en from ubicacion_busqueda u where u.comercio_key = c.key)
    from comercio c
    join beneficio b on b.comercio_key = c.key and b.estado_revision = 'ok' and beneficio_vigente(b)
   group by c.key, c.nombre, c.categoria;
$$;
revoke all on function admin_comercios () from public, anon, authenticated;

-- Todas las sucursales de un comercio para el backoffice, con la fuente de la
-- dirección (las que no vienen de una fuente se pueden borrar desde ahí).
create or replace function admin_sucursales (p_key text)
returns table (
  id uuid, nombre text, direccion text, localidad text, departamento departamento,
  exactitud precision_geo, fuente_direccion text, lat double precision, lng double precision
)
language sql stable as $$
  select s.id, s.nombre, s.direccion, s.localidad, s.departamento, s.precision, s.fuente_direccion,
         st_y(s.geom::geometry), st_x(s.geom::geometry)
    from sucursal s
   where s.comercio_key = p_key
   order by s.departamento, s.localidad, s.direccion;
$$;
revoke all on function admin_sucursales (text) from public, anon, authenticated;
