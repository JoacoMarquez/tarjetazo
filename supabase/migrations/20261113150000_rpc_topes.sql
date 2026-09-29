-- Las RPC públicas se llaman con la anon key y cualquier cuerpo: sin tope, un
-- array de miles de elementos se compara contra cada beneficio y una llamada
-- cuesta cientos de veces lo normal. Los topes están muy por encima de lo que
-- manda la web (107 productos, 19 departamentos, ~40 familias); pasarlos da
-- un resultado vacío.

-- Los productos: la comparación que se hace fila por fila.
create or replace function aplica_a_productos (b beneficio, p_productos text[])
returns boolean language sql immutable as $$
  select case
    when cardinality(p_productos) > 300 then false
    else p_productos is null
      or cardinality(b.productos_elegibles) = 0
      or b.productos_elegibles && p_productos
  end;
$$;

-- El resto de los filtros de lista. Solo mira los parámetros: en una función
-- SQL inlineada se evalúa una vez, no por fila.
create or replace function topes_de_filtros (
  p_fuentes text[], p_categorias text[], p_departamentos text[], p_tipos text[]
)
returns boolean language sql immutable as $$
  select coalesce(cardinality(p_fuentes), 0) <= 50
     and coalesce(cardinality(p_categorias), 0) <= 50
     and coalesce(cardinality(p_departamentos), 0) <= 30
     and coalesce(cardinality(p_tipos), 0) <= 10;
$$;

create or replace function beneficios_filtrados (
  p_fuentes       text[] default null,
  p_productos     text[] default null,
  p_categorias    text[] default null,
  p_departamentos text[] default null,
  p_dia           smallint default null,
  p_tipos         text[] default null,
  p_comercio      text default null,
  p_orden         text default 'relevancia',
  p_limit         int default 50,
  p_offset        int default 0
)
returns table (
  id             text,
  fuente_id      text,
  fuente_nombre  text,
  comercio_key   text,
  comercio       text,
  categoria      text,
  logo_url       text,
  titulo         text,
  descuento_raw  text,
  porcentaje     numeric,
  cuotas         int,
  tipo           tipo_beneficio,
  dias_semana    smallint[],
  tope_monto     numeric,
  tope_periodo   tope_periodo,
  tope_moneda    text,
  canal          canal,
  vigencia_hasta date,
  productos_elegibles text[],
  n_sucursales   bigint,
  total          bigint
)
language sql stable as $$
  with filtrados as (
    select b.*, c.nombre as comercio_nombre, c.categoria as comercio_categoria,
           c.logo_url as comercio_logo, f.nombre as fuente_nombre
      from beneficio b
      join comercio c on c.key = b.comercio_key
      join fuente f on f.id = b.fuente_id
     where b.estado_revision = 'ok'
       and topes_de_filtros(p_fuentes, p_categorias, p_departamentos, p_tipos)
       and beneficio_vigente(b)
       and (p_fuentes is null or b.fuente_id = any (p_fuentes))
       and (p_categorias is null or c.categoria = any (p_categorias))
       and (p_tipos is null or b.tipo::text = any (p_tipos))
       and (p_comercio is null or b.comercio_key = p_comercio)
       and (
         p_departamentos is null
         or cardinality(b.departamentos) = 0
         or b.departamentos::text[] && p_departamentos
       )
       and aplica_a_productos(b, p_productos)
       and aplica_al_dia(b, p_dia)
  )
  select f.id, f.fuente_id, f.fuente_nombre, f.comercio_key, f.comercio_nombre,
         f.comercio_categoria, f.comercio_logo, f.titulo, f.descuento_raw,
         f.porcentaje, f.cuotas, f.tipo, f.dias_semana, f.tope_monto,
         f.tope_periodo, f.tope_moneda, f.canal, f.vigencia_hasta, f.productos_elegibles,
         (select count(*) from sucursal s where s.comercio_key = f.comercio_key and s.geom is not null),
         count(*) over ()
    from filtrados f
   order by
     case when p_orden = 'porcentaje' then f.porcentaje end desc nulls last,
     case when p_orden = 'cuotas' then f.cuotas end desc nulls last,
     -- Relevancia: primero lo que más ahorra y, a igualdad, lo que vence antes.
     case when p_orden = 'relevancia' then coalesce(f.porcentaje, 0) end desc,
     f.vigencia_hasta asc nulls last,
     f.comercio_nombre asc
   limit p_limit offset p_offset;
$$;

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
       and topes_de_filtros(null, p_categorias, p_departamentos, null)
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

create or replace function beneficios_por_familia (p_familias jsonb)
returns table (familia_id text, vigentes int, exclusivos int)
language sql stable as $$
  with fam as materialized (
    -- Una fila por familia (sin repetidas) y hasta 200: la web manda ~40.
    select distinct on (f->>'id')
           f->>'id'        as familia_id,
           f->>'fuente_id' as fuente_id,
           array(select jsonb_array_elements_text(f->'productos')) as productos
      from jsonb_array_elements(p_familias) f
     where jsonb_array_length(p_familias) <= 200
  )
  select fam.familia_id,
         count(b.id)::int as vigentes,
         count(b.id) filter (
           where cardinality(b.productos_elegibles) > 0
             and b.productos_elegibles <@ fam.productos
         )::int as exclusivos
    from fam
    left join beneficio b
      on b.fuente_id = fam.fuente_id
     and b.estado_revision = 'ok'
     and beneficio_vigente(b)
     and aplica_a_productos(b, fam.productos)
   group by fam.familia_id;
$$;

-- No la usa la web y aceptaba radio y límite sin tope.
revoke execute on function sucursales_cercanas from public, anon, authenticated;
