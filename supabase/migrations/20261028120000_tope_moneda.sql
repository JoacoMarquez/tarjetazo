-- Moneda del tope. `tope_monto` suponía pesos y hay topes en dólares (BROU Agro,
-- Scotiabank, BBVA Consolid) que se guardaban o se mostraban como "$ 200/día".
--
-- Desde acá un tope siempre es cuánto te devuelven como máximo, en `tope_moneda`.
-- Un tope "de compra" (el descuento aplica hasta cierto gasto) se guarda ya
-- convertido con el porcentaje: 15% con tope de compra USD 2.000 → 300 USD por
-- compra. Así todos los topes significan lo mismo.
--
-- Idempotente: se puede correr dos veces.

-- 1. Columna ---------------------------------------------------------------
alter table beneficio
  add column if not exists tope_moneda text not null default 'UYU';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'beneficio_tope_moneda_ck') then
    alter table beneficio
      add constraint beneficio_tope_moneda_ck check (tope_moneda in ('UYU', 'USD'));
  end if;
end $$;

-- 2. Consultas que devuelven el tope -----------------------------------------
-- `beneficios_filtrados` (definida en 20260902190000_consultas_app, sin
-- redefiniciones posteriores) es la única función que devuelve los campos del
-- tope: `comparar_fuentes` solo cuenta cuántos tienen tope. Cambia la lista de
-- columnas, así que hay que borrarla antes: `create or replace` no puede
-- cambiar el tipo de retorno.
drop function if exists beneficios_filtrados (
  text[], text[], text[], text[], smallint, text[], text, text, int, int
);

create function beneficios_filtrados (
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

-- 3. Los 16 beneficios vigentes con el tope en dólares (2026-09-27) ----------
-- Leídos de `legales_raw` uno por uno. Cada fila se corrige solo si sigue
-- siendo el tramo que se revisó (mismo porcentaje y cuotas): los ids son
-- posicionales (`fuente:página:n`) y una re-normalización podría haberlos
-- corrido. La condición final hace que una segunda corrida no toque nada.
--
-- id                                      antes              después             por qué
-- bbva:viajes-consolid:0                  sin tope           100 USD beneficio   "Tope de descuento … por primera compra por única vez … USD100"
-- brou:almacn-rural:0                     200 dia            200 USD dia         "Tope de descuento de U$S 200 … por tarjeta, por día" (el total de U$S 1.000 por vigencia no se guarda: un tope por beneficio, vale el diario)
-- brou:interagrovial:0                    200 dia            200 USD dia         "Tope de descuento: U$S 200 por tarjeta, por día"
-- brou:outlet-viajes-siur:0               100 beneficio      100 USD beneficio   "Tope de descuento: USD 100 por cuenta durante toda la vigencia"
-- scotiabank:art-computer-2022-01-01:0    2500 compra        375 USD compra      15% crédito, "Tope de compra para devolución: USD 2.500" → 15% de 2.500
-- scotiabank:art-computer-2022-01-01:1    2500 compra        250 USD compra      10% débito, mismo tope de compra → 10% de 2.500
-- scotiabank:bodega-bouza-2024-12-26:0    2000 compra        500 USD compra      25%, "Tope de compra para efectuar el descuento USD 2.000" → 25% de 2.000
-- scotiabank:bodega-bouza-2024-12-26:1    2000 compra        300 USD compra      15%, mismo tope de compra → 15% de 2.000
-- scotiabank:bouza-vinos-tapas-2024-12-13:0  2000 compra     500 USD compra      25%, "Tope de compra USD 2000" → 25% de 2.000
-- scotiabank:bouza-vinos-tapas-2024-12-13:1  2000 compra     300 USD compra      15%, mismo tope de compra → 15% de 2.000
-- scotiabank:jorge-martinez-2022-01-01:0  sin tope           120 USD beneficio   12 cuotas, "Tope de devolución por cuenta es de USD120" → por cuenta = beneficio
-- scotiabank:jorge-martinez-2022-01-01:1  sin tope           120 USD beneficio   18 cuotas, ídem
-- scotiabank:las-espinas-2026-01-13:0     2000 compra        500 USD compra      25%, "Tope de compra para efectuar el descuento USD 2.000" → 25% de 2.000
-- scotiabank:las-espinas-2026-01-13:1     2000 compra        300 USD compra      15%, mismo tope de compra → 15% de 2.000
-- scotiabank:maximstore-2024-11-15:0      500 compra         500 USD compra      15%, "Tope de devolución: USD 500" (ya es devolución; sin período escrito, queda por compra)
-- scotiabank:maximstore-2024-11-15:1      sin tope           sin tope (UYU)      12/18 cuotas sin recargo: el tope de devolución es del 15% de al lado, no de las cuotas
with correccion (id, porcentaje, cuotas, tope_monto, tope_periodo, tope_moneda) as (
  values
    ('bbva:viajes-consolid:0',                    10::numeric, null::int, 100::numeric, 'beneficio'::tope_periodo, 'USD'),
    ('brou:almacn-rural:0',                       10, null, 200,  'dia',       'USD'),
    ('brou:interagrovial:0',                      20, null, 200,  'dia',       'USD'),
    ('brou:outlet-viajes-siur:0',                 10, null, 100,  'beneficio', 'USD'),
    ('scotiabank:art-computer-2022-01-01:0',      15, null, 375,  'compra',    'USD'),
    ('scotiabank:art-computer-2022-01-01:1',      10, null, 250,  'compra',    'USD'),
    ('scotiabank:bodega-bouza-2024-12-26:0',      25, null, 500,  'compra',    'USD'),
    ('scotiabank:bodega-bouza-2024-12-26:1',      15, null, 300,  'compra',    'USD'),
    ('scotiabank:bouza-vinos-tapas-2024-12-13:0', 25, null, 500,  'compra',    'USD'),
    ('scotiabank:bouza-vinos-tapas-2024-12-13:1', 15, null, 300,  'compra',    'USD'),
    ('scotiabank:jorge-martinez-2022-01-01:0',    null, 12, 120,  'beneficio', 'USD'),
    ('scotiabank:jorge-martinez-2022-01-01:1',    null, 18, 120,  'beneficio', 'USD'),
    ('scotiabank:las-espinas-2026-01-13:0',       25, null, 500,  'compra',    'USD'),
    ('scotiabank:las-espinas-2026-01-13:1',       15, null, 300,  'compra',    'USD'),
    ('scotiabank:maximstore-2024-11-15:0',        15, null, 500,  'compra',    'USD'),
    ('scotiabank:maximstore-2024-11-15:1',        null, 18, null, null,        'UYU')
)
update beneficio b
   set tope_monto = c.tope_monto,
       tope_periodo = c.tope_periodo,
       tope_moneda = c.tope_moneda,
       updated_at = now()
  from correccion c
 where b.id = c.id
   and b.porcentaje is not distinct from c.porcentaje
   and b.cuotas is not distinct from c.cuotas
   and (b.tope_monto, b.tope_periodo, b.tope_moneda)
       is distinct from (c.tope_monto, c.tope_periodo, c.tope_moneda);
