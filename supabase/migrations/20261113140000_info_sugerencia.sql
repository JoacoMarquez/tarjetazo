-- Sitio web, Instagram, teléfono y horario que vienen de OpenStreetMap (#118).
-- OSM lo edita cualquiera: en vez de publicarse solo, `geo info` los deja acá
-- y se aceptan en /admin/comercios, igual que las ubicaciones.
create table info_sugerencia (
  id           uuid primary key default gen_random_uuid(),
  comercio_key text not null references comercio (key) on delete cascade,
  sucursal_id  uuid references sucursal (id) on delete cascade,  -- teléfono y horario son del local
  campo        text not null check (campo in ('sitio_web', 'instagram', 'telefono', 'horario')),
  valor        text not null,
  osm_ids      text[] not null default '{}',
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'ignorada')),
  creada_en    timestamptz not null default now(),
  resuelta_en  timestamptz,
  -- El mismo valor no se vuelve a sugerir (tampoco si se ignoró); uno distinto sí.
  constraint info_sugerencia_unica unique nulls not distinct (comercio_key, sucursal_id, campo, valor),
  check ((campo in ('telefono', 'horario')) = (sucursal_id is not null))
);
create index info_sugerencia_pendiente_idx on info_sugerencia (comercio_key) where estado = 'pendiente';
alter table info_sugerencia enable row level security;
-- Sin policies: solo la service role (backoffice y job de geo).

-- El conteo de sugerencias del listado suma las de datos de contacto.
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
         ((select count(*) from sucursal_sugerencia g where g.comercio_key = c.key and g.estado = 'pendiente')
          + (select count(*) from info_sugerencia i where i.comercio_key = c.key and i.estado = 'pendiente'))::int,
         (select u.buscado_en from ubicacion_busqueda u where u.comercio_key = c.key)
    from comercio c
    join beneficio b on b.comercio_key = c.key and b.estado_revision = 'ok' and beneficio_vigente(b)
   group by c.key, c.nombre, c.categoria;
$$;
revoke all on function admin_comercios () from public, anon, authenticated;
