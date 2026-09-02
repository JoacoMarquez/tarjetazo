-- Tarjetazo — esquema inicial (hito 1). Ver docs/03-spec.md.
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- enums
create type tipo_fuente     as enum ('banco', 'emisor', 'billetera', 'club');
create type instrumento     as enum ('credito', 'debito', 'prepaga', 'saldo');
create type red             as enum ('visa', 'mastercard', 'amex', 'cabal', 'propia');
create type tier            as enum ('gold', 'platinum', 'black', 'signature');
create type tipo_beneficio  as enum ('porcentaje', 'cuotas', 'reintegro', '2x1');
create type canal           as enum ('presencial', 'online', 'ambos');
create type mecanica        as enum ('qr', 'nfc', 'app');
create type tope_periodo    as enum ('dia', 'semana', 'mes', 'compra', 'beneficio');
create type estado_revision as enum ('ok', 'revisar', 'descartado');
create type departamento    as enum (
  'artigas', 'canelones', 'cerro-largo', 'colonia', 'durazno', 'flores', 'florida',
  'lavalleja', 'maldonado', 'montevideo', 'paysandu', 'rio-negro', 'rivera', 'rocha',
  'salto', 'san-jose', 'soriano', 'tacuarembo', 'treinta-y-tres'
);

-- ---------------------------------------------------------------- tablas
create table fuente (
  id         text primary key,
  nombre     text not null,
  tipo       tipo_fuente not null,
  logo_url   text,
  url        text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

create table producto (
  id          text primary key,
  fuente_id   text not null references fuente (id) on delete cascade,
  nombre      text not null,
  instrumento instrumento not null,
  red         red not null,
  tier        tier
);
create index producto_fuente_idx on producto (fuente_id);

create table categoria (
  slug    text primary key,
  label   text not null,
  orden   int not null,
  en_home boolean not null default false
);

create table comercio (
  key          text primary key,
  nombre       text not null,
  categoria    text not null references categoria (slug),
  logo_url     text,
  -- derivados: los recalcula recalcular_derivados_comercio()
  best_pct     numeric(5, 2),
  max_cuotas   int,
  n_beneficios int not null default 0,
  n_fuentes    int not null default 0,
  updated_at   timestamptz not null default now()
);
create index comercio_categoria_idx on comercio (categoria);
create index comercio_nombre_trgm_idx on comercio using gin (nombre gin_trgm_ops);

create table sucursal (
  id           uuid primary key default gen_random_uuid(),
  comercio_key text not null references comercio (key) on delete cascade,
  direccion    text not null,
  localidad    text,
  departamento departamento not null,
  geom         geography (point, 4326),
  geocoded_at  timestamptz,
  unique (comercio_key, direccion, departamento)
);
create index sucursal_geom_idx on sucursal using gist (geom);
create index sucursal_comercio_idx on sucursal (comercio_key);
create index sucursal_depto_idx on sucursal (departamento);

create table beneficio (
  id                  text primary key,
  fuente_id           text not null references fuente (id) on delete cascade,
  comercio_key        text not null references comercio (key) on delete cascade,
  titulo              text not null,
  descuento_raw       text not null,
  porcentaje          numeric(5, 2),
  cuotas              int,
  tipo                tipo_beneficio not null,
  dias_semana         smallint[] not null default '{}',   -- 0=domingo … 6=sábado; vacío = todos
  vigencia_desde      date,
  vigencia_hasta      date,
  departamentos       departamento[] not null default '{}', -- vacío = todo el país
  productos_elegibles text[] not null default '{}',         -- vacío = todos los de la fuente
  tope_monto          numeric(12, 2),
  tope_periodo        tope_periodo,
  canal               canal not null default 'presencial',
  mecanica            mecanica[] not null default '{}',
  acumulable          boolean,
  compra_minima       numeric(12, 2),
  requiere_activacion boolean not null default false,
  legales_raw         text,
  como_usarlo         text[] not null default '{}',
  url_fuente          text not null,
  fetched_at          timestamptz not null,
  estado_revision     estado_revision not null default 'ok',
  updated_at          timestamptz not null default now(),
  constraint beneficio_porcentaje_ck check (tipo <> 'porcentaje' or porcentaje is not null),
  constraint beneficio_cuotas_ck     check (tipo <> 'cuotas' or cuotas is not null),
  constraint beneficio_tope_ck       check (tope_monto is null or tope_periodo is not null),
  constraint beneficio_vigencia_ck   check (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta >= vigencia_desde),
  constraint beneficio_dias_ck       check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);
create index beneficio_comercio_idx on beneficio (comercio_key);
create index beneficio_fuente_idx on beneficio (fuente_id);
create index beneficio_vigencia_idx on beneficio (vigencia_hasta);
create index beneficio_estado_idx on beneficio (estado_revision);
create index beneficio_departamentos_idx on beneficio using gin (departamentos);
create index beneficio_productos_idx on beneficio using gin (productos_elegibles);

-- Cola de revisión manual: lo que no pasa Zod o el normalizador marca como dudoso.
create table beneficio_revision (
  id         uuid primary key default gen_random_uuid(),
  fuente_id  text not null references fuente (id) on delete cascade,
  raw        jsonb not null,
  motivo     text not null,
  url_fuente text,
  created_at timestamptz not null default now(),
  resuelto   boolean not null default false
);
create index beneficio_revision_pendiente_idx on beneficio_revision (fuente_id) where not resuelto;

-- ---------------------------------------------------------------- vigencia
-- Un beneficio está vigente hoy si no venció y ya empezó.
create or replace function beneficio_vigente (b beneficio, en_fecha date default current_date)
returns boolean language sql immutable as $$
  select (b.vigencia_desde is null or b.vigencia_desde <= en_fecha)
     and (b.vigencia_hasta is null or b.vigencia_hasta >= en_fecha);
$$;

-- ---------------------------------------------------------------- derivados
create or replace function recalcular_derivados_comercio (p_comercio_key text)
returns void language sql as $$
  update comercio c
     set best_pct     = d.best_pct,
         max_cuotas   = d.max_cuotas,
         n_beneficios = d.n_beneficios,
         n_fuentes    = d.n_fuentes,
         updated_at   = now()
    from (
      select max(b.porcentaje)            as best_pct,
             max(b.cuotas)                as max_cuotas,
             count(*)                     as n_beneficios,
             count(distinct b.fuente_id)  as n_fuentes
        from beneficio b
       where b.comercio_key = p_comercio_key
         and b.estado_revision = 'ok'
         and beneficio_vigente(b)
    ) d
   where c.key = p_comercio_key;
$$;

create or replace function trg_beneficio_derivados () returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' or old.comercio_key is distinct from new.comercio_key then
    perform recalcular_derivados_comercio(old.comercio_key);
  end if;
  if tg_op <> 'DELETE' then
    perform recalcular_derivados_comercio(new.comercio_key);
  end if;
  return null;
end;
$$;

create trigger beneficio_derivados_trg
after insert or update or delete on beneficio
for each row execute function trg_beneficio_derivados ();

-- ---------------------------------------------------------------- mapa
-- Sucursales con beneficios vigentes dentro de un radio, opcionalmente filtradas
-- por las fuentes que tiene el usuario ("mis tarjetas").
create or replace function sucursales_cercanas (
  p_lat        double precision,
  p_lng        double precision,
  p_radio_m    integer default 3000,
  p_fuentes    text[] default null,
  p_categorias text[] default null,
  p_limit      integer default 200
)
returns table (
  sucursal_id  uuid,
  comercio_key text,
  nombre       text,
  categoria    text,
  direccion    text,
  lat          double precision,
  lng          double precision,
  distancia_m  double precision,
  best_pct     numeric,
  n_beneficios bigint
)
language sql stable as $$
  with punto as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select s.id,
         c.key,
         c.nombre,
         c.categoria,
         s.direccion,
         st_y(s.geom::geometry),
         st_x(s.geom::geometry),
         st_distance(s.geom, punto.g),
         max(b.porcentaje),
         count(b.id)
    from sucursal s
    join comercio c on c.key = s.comercio_key
    join punto on true
    join beneficio b
      on b.comercio_key = c.key
     and b.estado_revision = 'ok'
     and beneficio_vigente(b)
     and (p_fuentes is null or b.fuente_id = any (p_fuentes))
   where s.geom is not null
     and st_dwithin(s.geom, punto.g, p_radio_m)
     and (p_categorias is null or c.categoria = any (p_categorias))
   group by s.id, c.key, c.nombre, c.categoria, s.direccion, s.geom, punto.g
   order by st_distance(s.geom, punto.g)
   limit p_limit;
$$;

-- ---------------------------------------------------------------- RLS
-- Todo el catálogo es público de lectura; escribe solo el pipeline (service role,
-- que saltea RLS). La cola de revisión no se expone.
alter table fuente             enable row level security;
alter table producto           enable row level security;
alter table categoria          enable row level security;
alter table comercio           enable row level security;
alter table sucursal           enable row level security;
alter table beneficio          enable row level security;
alter table beneficio_revision enable row level security;

create policy "lectura publica" on fuente    for select using (true);
create policy "lectura publica" on producto  for select using (true);
create policy "lectura publica" on categoria for select using (true);
create policy "lectura publica" on comercio  for select using (true);
create policy "lectura publica" on sucursal  for select using (true);
create policy "lectura publica" on beneficio for select using (estado_revision = 'ok');
