-- Catálogo de tarjetas (#27, grill de F4 en el issue y en docs/04-backoffice.md).
-- El scraper lee las páginas oficiales de Santander, BROU y BBVA y deja
-- SUGERENCIAS: nunca escribe en la ficha. La bandeja (#26) las acepta.

-- Ficha por familia (un pack Trilogy es una ficha). La escribe solo el operador.
create table producto_ficha (
  familia_id         text primary key,          -- familiaDe(producto) en @tarjetazo/core
  fuente_id          text not null references fuente (id) on delete cascade,
  costo_anual        numeric(12, 2),
  costo_moneda       text check (costo_moneda in ('UYU', 'UI', 'USD')),
  costo_bonificado   text,                       -- "gratis el primer año", "sin costo cobrando el sueldo"
  ingreso_minimo     numeric(12, 2),             -- en pesos
  requisitos         text[] not null default '{}',
  tasa_tea           numeric(6, 2),
  programa           text,                       -- puntos, millas
  seguros            text[] not null default '{}',
  salas_vip          text,
  link_solicitud     text,
  otros              text[] not null default '{}',
  imagen_frente      text,                       -- ruta en Storage (bucket tarjetas)
  imagen_dorso       text,
  imagen_origen      text,                       -- URL del banco de la que salió el frente
  url_oficial        text,
  actualizado_en     timestamptz not null default now()
);

create table producto_ficha_sugerencia (
  id           uuid primary key default gen_random_uuid(),
  fuente_id    text not null references fuente (id) on delete cascade,
  familia_id   text,                             -- null en una alta
  tipo         text not null check (tipo in ('campo', 'alta')),
  campo        text,                             -- columna de producto_ficha, o 'imagen'
  valor        jsonb not null,                   -- lo que se vio (en una alta, la tarjeta entera)
  valor_actual jsonb,                            -- lo que hay en la ficha hoy
  nombre_visto text not null,
  url          text not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'ignorada')),
  creada_en    timestamptz not null default now(),
  resuelta_en  timestamptz,
  check (tipo = 'alta' or (familia_id is not null and campo is not null))
);
create index producto_ficha_sugerencia_pendiente_idx on producto_ficha_sugerencia (fuente_id) where estado = 'pendiente';

-- Caché de páginas del catálogo: si el hash no cambió, no se vuelve a extraer.
create table catalogo_pagina (
  fuente_id   text not null references fuente (id) on delete cascade,
  url         text primary key,
  hash        text not null,
  contenido   text not null,
  visto_en    timestamptz not null default now(),
  extraido_en timestamptz
);

-- Cada revisión semanal (o manual), para "última revisión" en el backoffice.
create table catalogo_revision (
  id          uuid primary key default gen_random_uuid(),
  empezo_en   timestamptz not null default now(),
  termino_en  timestamptz,
  paginas     int not null default 0,
  extraidas   int not null default 0,
  tarjetas    int not null default 0,
  sugerencias int not null default 0,
  tokens_entrada int not null default 0,
  tokens_salida  int not null default 0,
  error       text
);

alter table producto_ficha            enable row level security;
alter table producto_ficha_sugerencia enable row level security;
alter table catalogo_pagina           enable row level security;
alter table catalogo_revision         enable row level security;
-- Sin policies: solo la service role. La ficha se abre al público con #11.
