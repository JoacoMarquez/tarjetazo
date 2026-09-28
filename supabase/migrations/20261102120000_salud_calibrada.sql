-- Salud calibrada con tres semanas de corridas reales (2026-09-28).
--
-- Saltos. Una corrida con `--limite` trae 5 páginas y la siguiente, completa,
-- parecía un salto de +10.000 %: eran las únicas alertas de salto. La corrida
-- guarda ahora si fue parcial y Salud la ignora. Sin las parciales, la
-- cantidad de páginas varía menos de 1 % (máximo 5,5 %) y las bajas por
-- corrida son casi cero: el umbral baja de 20 % a 10 %.
--
-- Nombres parecidos. Muestra los mismos ~100 pares todos los días, también los
-- ya revisados: un par se puede marcar "no son el mismo" y no vuelve. Los
-- comercios sin beneficios no se ven en la web: fusionarlos no cambia nada.
--
-- Porcentaje alto (60 %) queda igual: el máximo real es 50 % y hay 35 en ese
-- valor, todos legítimos. Frescura (180 días) tampoco se toca: la base tiene
-- menos de un mes y ningún beneficio llegó a esa edad.

alter table corrida add column if not exists parcial boolean not null default false;
-- Las de antes: ninguna fuente tiene menos de 36 páginas, así que 10 o menos
-- fue una corrida con --limite.
update corrida set parcial = true where paginas is not null and paginas <= 10 and not parcial;

create or replace function salud_saltos (p_umbral numeric default 10)
returns table (
  fuente_id text, corrida_id uuid, empezo_en timestamptz,
  paginas int, paginas_anterior int, variacion_paginas_pct numeric,
  nuevos int, vencidos int, activos bigint, bajas_pct numeric, alerta boolean)
language sql stable as $$
  with cerradas as (
    select c.*, row_number() over (partition by c.fuente_id order by c.empezo_en desc) as n
      from corrida c
     where c.termino_en is not null and c.error is null and not c.parcial
  ), activos as (
    select b.fuente_id, count(*) as n from beneficio b where b.estado_revision = 'ok' group by 1
  ), par as (
    select u.fuente_id, u.id, u.empezo_en, u.paginas, a.paginas as paginas_anterior,
           u.nuevos, u.vencidos, coalesce(ac.n, 0) as activos
      from cerradas u
      left join cerradas a on a.fuente_id = u.fuente_id and a.n = 2
      left join activos ac on ac.fuente_id = u.fuente_id
     where u.n = 1
  ), calc as (
    select par.*,
           case when paginas_anterior > 0
                then round(100.0 * (paginas - paginas_anterior) / paginas_anterior, 1) end as variacion,
           case when activos + vencidos > 0
                then round(100.0 * vencidos / (activos + vencidos), 1) end as bajas
      from par
  )
  select fuente_id, id, empezo_en, paginas, paginas_anterior, variacion,
         nuevos, vencidos, activos, bajas,
         coalesce(abs(variacion) >= p_umbral, false) or coalesce(bajas >= p_umbral, false)
    from calc
   order by fuente_id;
$$;

-- "No son el mismo comercio": una regla en base, como los alias.
create table if not exists comercio_par_distinto (
  key_a      text not null references comercio (key) on delete cascade,
  key_b      text not null references comercio (key) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (key_a, key_b),
  check (key_a < key_b)
);
alter table comercio_par_distinto enable row level security;

create or replace function salud_nombres_parecidos (p_similitud real default 0.6, p_limite int default 200)
returns table (key_a text, nombre_a text, n_a int, key_b text, nombre_b text, n_b int, similitud real)
language sql stable as $$
  select a.key, a.nombre, a.n_beneficios, b.key, b.nombre, b.n_beneficios,
         similarity(a.nombre, b.nombre) as s
    from comercio a
    join comercio b on a.key < b.key and a.nombre % b.nombre
   where similarity(a.nombre, b.nombre) >= p_similitud
     and a.n_beneficios > 0 and b.n_beneficios > 0
     and not exists (select 1 from comercio_par_distinto d where d.key_a = a.key and d.key_b = b.key)
   order by s desc, a.nombre
   limit p_limite;
$$;

do $$
declare f text;
begin
  foreach f in array array['salud_saltos(numeric)', 'salud_nombres_parecidos(real, int)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
