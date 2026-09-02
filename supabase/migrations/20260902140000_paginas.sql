-- Caché de páginas crudas: guardamos el texto tal como lo publicó la fuente y
-- su hash. Si el hash no cambió respecto de la corrida anterior, no hace falta
-- volver a pasar la página por Claude (que es lo único que cuesta plata).
create table pagina_cruda (
  fuente_id      text not null references fuente (id) on delete cascade,
  external_id    text not null,
  url_fuente     text not null,
  contenido      text not null,
  hash           text not null,
  fetched_at     timestamptz not null,
  normalizada_en timestamptz,
  primary key (fuente_id, external_id)
);
create index pagina_cruda_hash_idx on pagina_cruda (fuente_id, hash);

alter table pagina_cruda enable row level security;
-- Sin policy de select: es material interno del pipeline, no se expone.

-- Registro de cada corrida, para el reporte y para saber si el cron sigue vivo.
create table corrida (
  id          uuid primary key default gen_random_uuid(),
  fuente_id   text not null references fuente (id) on delete cascade,
  empezo_en   timestamptz not null default now(),
  termino_en  timestamptz,
  paginas     int not null default 0,
  sin_cambios int not null default 0,
  nuevos      int not null default 0,
  actualizados int not null default 0,
  vencidos    int not null default 0,
  a_revisar   int not null default 0,
  error       text
);
create index corrida_fuente_idx on corrida (fuente_id, empezo_en desc);

alter table corrida enable row level security;
create policy "lectura publica" on corrida for select using (true);
