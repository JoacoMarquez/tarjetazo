-- Geocoding (hito 3). Las direcciones no vienen de los bancos: BROU casi nunca
-- las publica. Se arman desde OSM para las cadenas y, cuando una fuente sí
-- publica la dirección, se geocodifica con direcciones.ide.uy.

create type precision_geo as enum (
  'exacta',      -- calle y número
  'calle',       -- la calle, sin número
  'localidad',   -- solo el centro de la localidad
  'aproximada'   -- fallback (Nominatim, OSM sin dirección)
);

alter table sucursal
  add column nombre           text,          -- "Ta-Ta Pocitos", si la fuente lo distingue
  add column precision        precision_geo,
  add column fuente_direccion text,          -- 'osm' | 'ide_uy' | 'nominatim' | 'fuente'
  add column osm_id           text;

-- Un mismo local de OSM no puede entrar dos veces.
create unique index sucursal_osm_idx on sucursal (osm_id) where osm_id is not null;
create index sucursal_sin_geom_idx on sucursal (comercio_key) where geom is null;

-- Caché persistente: los geocodificadores tienen rate limit (Nominatim pide
-- 1 req/s) y las direcciones no cambian. La clave es el texto consultado.
create table geocode_cache (
  consulta      text primary key,
  lat           double precision,
  lng           double precision,
  precision     precision_geo,
  fuente        text not null,
  direccion_normalizada text,
  consultado_en timestamptz not null default now()
);

alter table geocode_cache enable row level security;
-- Sin policy de select: es interno del pipeline.

-- Localidades del país, para el buscador de zona del mapa.
create table localidad (
  id             int primary key,
  nombre         text not null,
  departamento   departamento not null,
  codigo_postal  int,
  geom           geography (point, 4326)
);
create index localidad_geom_idx on localidad using gist (geom);
create index localidad_nombre_idx on localidad using gin (nombre gin_trgm_ops);

alter table localidad enable row level security;
create policy "lectura publica" on localidad for select using (true);
