-- Comparador (hito 8): qué fuente conviene según los rubros donde uno gasta.
--
-- El puntaje es deliberadamente simple y se muestra en pantalla tal cual:
--   valor  = porcentaje/100            (descuento o reintegro)
--          | min(cuotas,12)/12 * 0.6   (cuotas: financiar vale menos que ahorrar)
--          | 0.5                       (2x1)
--   días   = cantidad de días que aplica / 7   (vacío = todos = 1)
--   tope   = 0.85 si tiene tope de monto, 1 si no
--   puntos = suma de valor * días * tope sobre los beneficios vigentes del rubro.
-- Se devuelve una fila por fuente y rubro con los componentes, para que la
-- página pueda explicar de dónde sale cada número.
create or replace function comparar_fuentes (
  p_categorias    text[] default null,
  p_departamentos text[] default null
)
returns table (
  fuente_id     text,
  fuente_nombre text,
  categoria     text,
  n_beneficios  bigint,
  n_comercios   bigint,
  mejor_pct     numeric,
  con_tope      bigint,
  todos_los_dias bigint,
  puntos        numeric
)
language sql stable as $$
  with b as (
    select bf.fuente_id, f.nombre as fuente_nombre, c.categoria, bf.comercio_key,
           bf.porcentaje, bf.cuotas, bf.tipo, bf.dias_semana, bf.tope_monto,
           case bf.tipo
             when 'cuotas' then least(coalesce(bf.cuotas, 0), 12) / 12.0 * 0.6
             when '2x1'    then 0.5
             else coalesce(bf.porcentaje, 0) / 100.0
           end as valor,
           case when cardinality(bf.dias_semana) = 0 then 1.0
                else cardinality(bf.dias_semana) / 7.0 end as f_dias,
           case when bf.tope_monto is null then 1.0 else 0.85 end as f_tope
      from beneficio bf
      join comercio c on c.key = bf.comercio_key
      join fuente f on f.id = bf.fuente_id
     where bf.estado_revision = 'ok'
       and beneficio_vigente(bf)
       and (p_categorias is null or c.categoria = any (p_categorias))
       and (
         p_departamentos is null
         or cardinality(bf.departamentos) = 0
         or bf.departamentos::text[] && p_departamentos
       )
  )
  select fuente_id, fuente_nombre, categoria,
         count(*), count(distinct comercio_key), max(porcentaje),
         count(*) filter (where tope_monto is not null),
         count(*) filter (where cardinality(dias_semana) = 0),
         round(sum(valor * f_dias * f_tope)::numeric, 2)
    from b
   group by fuente_id, fuente_nombre, categoria
   order by fuente_id, categoria;
$$;
