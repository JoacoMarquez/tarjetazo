-- Auditoría por muestreo (#20): una vez por semana, 10 beneficios publicados
-- elegidos al azar con peso, para comparar a ojo contra la página del banco.
-- Zod detecta datos imposibles; esto estima cuántos datos posibles están mal.

create table auditoria (
  id            uuid primary key default gen_random_uuid(),
  beneficio_id  text not null references beneficio (id) on delete cascade,
  semana        date not null,          -- lunes de la semana, en Uruguay
  resultado     text check (resultado in ('bien', 'mal')),
  nota          text,
  creado_en     timestamptz not null default now(),
  respondido_en timestamptz,
  unique (beneficio_id, semana)
);
create index auditoria_semana_idx on auditoria (semana);
alter table auditoria enable row level security;  -- sin policies: solo service role

create or replace function semana_uy () returns date
language sql stable as $$
  select date_trunc('week', hoy_uy())::date;
$$;

-- Completa la muestra de la semana hasta p_n. Muestreo ponderado sin reemplazo
-- (Efraimidis–Spirakis: ordenar por -ln(u)/peso). Pesos:
--   × 3    la página se normalizó en los últimos 14 días (lo recién leído)
--   × 2    porcentaje ≥ 40 (donde un error de lectura más se nota)
--   × 2    fuente con menos de 10 auditorías respondidas (fuentes nuevas)
--   × 0,2  BBVA: parser determinista, casi no se equivoca
-- Fuera de la muestra: lo auditado como "bien" en los últimos 90 días.
create or replace function auditoria_armar (p_n int default 10)
returns int language plpgsql as $$
declare
  v_semana date := semana_uy();
  v_faltan int;
  v_insertados int;
begin
  select p_n - count(*) into v_faltan from auditoria where semana = v_semana;
  if v_faltan <= 0 then return 0; end if;

  with respondidas as (
    select b.fuente_id, count(*) as n
      from auditoria a join beneficio b on b.id = a.beneficio_id
     where a.resultado is not null
     group by 1
  ), candidatos as (
    select b.id,
           (case when p.normalizada_en > now() - interval '14 days' then 3 else 1 end)
         * (case when b.porcentaje >= 40 then 2 else 1 end)
         * (case when coalesce(r.n, 0) < 10 then 2 else 1 end)
         * (case when b.fuente_id = 'bbva' then 0.2 else 1 end) as peso
      from beneficio b
      join pagina_cruda p
        on p.fuente_id = b.fuente_id
       and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':')
      left join respondidas r on r.fuente_id = b.fuente_id
     where b.estado_revision = 'ok'
       and beneficio_vigente(b, hoy_uy())
       and not exists (
             select 1 from auditoria a
              where a.beneficio_id = b.id
                and (a.semana = v_semana
                     or (a.resultado = 'bien' and a.respondido_en > now() - interval '90 days')))
  )
  insert into auditoria (beneficio_id, semana)
  select id, v_semana
    from candidatos
   order by -ln(1 - random()) / peso
   limit v_faltan;
  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

-- Precisión estimada por fuente sobre lo respondido en los últimos 180 días.
create or replace function auditoria_precision ()
returns table (fuente_id text, respondidas bigint, bien bigint, precision_pct numeric)
language sql stable as $$
  select b.fuente_id, count(*), count(*) filter (where a.resultado = 'bien'),
         round(100.0 * count(*) filter (where a.resultado = 'bien') / count(*), 0)
    from auditoria a join beneficio b on b.id = a.beneficio_id
   where a.resultado is not null and a.respondido_en > now() - interval '180 days'
   group by 1
   order by 1;
$$;

revoke execute on function auditoria_armar(int) from public, anon, authenticated;
revoke execute on function auditoria_precision() from public, anon, authenticated;
revoke execute on function semana_uy() from public, anon, authenticated;
grant execute on function auditoria_armar(int) to service_role;
grant execute on function auditoria_precision() to service_role;
grant execute on function semana_uy() to service_role;
