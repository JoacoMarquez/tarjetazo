-- "Solo mis tarjetas" mostraba beneficios de bancos que el usuario no tiene.
-- Un beneficio sin productos explícitos vale para todas las tarjetas de SU
-- fuente, pero aplica_a_productos lo dejaba pasar para cualquier selección:
-- con una sola BROU Visa Débito aparecían los de ANDA, Pronto+ o Santander.
-- Ahora la lista vacía cuenta solo si alguno de los productos pedidos es de
-- esa fuente. El arreglo de fuentes es un subselect sin correlación: se
-- calcula una vez por consulta, no por fila. Deja de ser immutable porque lee
-- la tabla producto (stable sigue permitiendo inlinearla).
create or replace function aplica_a_productos (b beneficio, p_productos text[])
returns boolean language sql stable as $$
  select case
    when cardinality(p_productos) > 300 then false
    else p_productos is null
      or b.productos_elegibles && p_productos
      or (
        cardinality(b.productos_elegibles) = 0
        and b.fuente_id = any (array(
          select p.fuente_id from producto p where p.id = any (p_productos)
        ))
      )
  end;
$$;

-- La paginación (limit/offset) necesita un orden total: con empates en
-- porcentaje, vigencia y nombre, el mismo beneficio salía en dos páginas y
-- otro no salía en ninguna. Se desempata por id.
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
     f.comercio_nombre asc,
     f.id asc
   limit p_limit offset p_offset;
$$;
