-- Reglas que se crean desde el backoffice (/admin/revision) y que el pipeline
-- lee al arrancar. Conviven con las de código (`normalizador.ts`): primero se
-- busca acá, por texto exacto normalizado, y después en los regex por fuente.
-- `texto` va normalizado con `normalizarNombreTarjeta` de @tarjetazo/core.

-- "Visa Infinite Select" → [itau-visa-signature]. Un nombre puede ser varias
-- tarjetas, igual que en las reglas de código.
create table producto_alias (
  id           uuid primary key default gen_random_uuid(),
  fuente_id    text not null references fuente (id) on delete cascade,
  texto        text not null,
  producto_ids text[] not null check (cardinality(producto_ids) > 0),
  created_at   timestamptz not null default now(),
  unique (fuente_id, texto)
);

-- Nombres que no son una tarjeta ("Puntos", "corporativas"): ni se mapean ni
-- vuelven a la cola.
create table regla_ignorar (
  id         uuid primary key default gen_random_uuid(),
  fuente_id  text not null references fuente (id) on delete cascade,
  texto      text not null,
  created_at timestamptz not null default now(),
  unique (fuente_id, texto)
);

-- Problemas de esta fila que se descartaron a mano, sin crear una regla. La
-- fila queda resuelta cuando todos sus problemas están cubiertos por un alias,
-- una regla de ignorar o esta lista.
alter table beneficio_revision
  add column descartados text[] not null default '{}';

-- Material interno: sin policies, solo entra la service role.
alter table producto_alias enable row level security;
alter table regla_ignorar  enable row level security;
