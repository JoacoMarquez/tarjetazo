-- Bajas del catálogo (después de la auditoría de 20261020120000). El scraper de
-- catálogo solo proponía altas; ahora también propone la baja de una familia
-- que el banco dejó de publicar, y Salud avisa de los productos activos sin
-- página oficial. Ninguna de las dos cosas cambia el catálogo sola.

-- 1. Sugerencias de baja: una por familia, sin campo.
alter table producto_ficha_sugerencia drop constraint if exists producto_ficha_sugerencia_tipo_check;
alter table producto_ficha_sugerencia drop constraint if exists producto_ficha_sugerencia_check;
alter table producto_ficha_sugerencia
  add constraint producto_ficha_sugerencia_tipo_check check (tipo in ('campo', 'alta', 'baja')),
  add constraint producto_ficha_sugerencia_check check (
    tipo = 'alta'
    or (tipo = 'baja' and familia_id is not null)
    or (tipo = 'campo' and familia_id is not null and campo is not null)
  );

-- 2. Qué familias salieron de cada página en su última extracción. Null = se
-- extrajo antes de esta columna: el scraper la vuelve a extraer una vez.
alter table catalogo_pagina add column if not exists familias text[];

-- 3. Salud: productos activos sin página oficial. Un producto así nunca se
-- cotejó con el banco (así se coló la Amex de Santander).
create or replace function salud_productos_sin_url ()
returns table (producto_id text, fuente_id text, nombre text)
language sql stable as $$
  select p.id, p.fuente_id, p.nombre
    from producto p
   where p.activo and p.url_oficial is null
   order by p.fuente_id, p.id;
$$;

create or replace function salud_resumen ()
returns table (tipo text, cantidad bigint)
language sql stable as $$
  select i.tipo, count(*) from salud_inconsistencias(60, 1000000) i group by 1
  union all select 'paginas_sin_beneficios', count(*) from salud_paginas_vacias(1000000)
  union all select 'saltos', count(*) from salud_saltos() s where s.alerta
  union all select 'nombres_parecidos', count(*) from salud_nombres_parecidos(0.6, 1000000)
  union all select 'comercios_sin_sucursal', count(*) from salud_comercios_sin_sucursal(1000000)
  union all select 'frescura', count(*) from salud_frescura(180, 1000000)
  union all select m.tipo, count(*) from salud_manuales(7) m group by 1
  union all select 'producto_sin_url', count(*) from salud_productos_sin_url();
$$;

revoke execute on function salud_productos_sin_url() from public, anon, authenticated;
grant execute on function salud_productos_sin_url() to service_role;
