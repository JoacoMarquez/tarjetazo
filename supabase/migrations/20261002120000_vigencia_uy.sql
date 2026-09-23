-- La vigencia se evaluaba con `current_date`, que en Supabase es UTC: entre
-- las 21:00 y las 00:00 de Uruguay ya es el día siguiente y un beneficio que
-- vence hoy desaparecía de la web tres horas antes (#37). El default pasa a
-- ser la fecha de Uruguay; todas las consultas públicas llaman
-- `beneficio_vigente(b)` sin fecha, así que se corrigen sin tocarlas.
--
-- `hoy_uy()` ya es ejecutable por anon y authenticated (migración de #30).
create or replace function beneficio_vigente (b beneficio, en_fecha date default hoy_uy())
returns boolean language sql immutable as $$
  select (b.vigencia_desde is null or b.vigencia_desde <= en_fecha)
     and (b.vigencia_hasta is null or b.vigencia_hasta >= en_fecha);
$$;
