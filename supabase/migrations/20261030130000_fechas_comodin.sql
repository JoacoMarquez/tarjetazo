-- Fechas comodín (Scotiabank): su feed publica "Vigencia: 2022-01-01 a
-- 3022-06-20" (o 3200, 4022, 2060…) en las promos sin fin. La web mostraba
-- "hasta el 20 de junio de 3022". Una vigencia_hasta a más de 3 años es "sin
-- fecha de fin publicada" (null): es la misma regla que aplica el normalizador
-- (sinFechaComodin), así que una re-normalización deja lo mismo.
--
-- Jorge Martínez: el feed dice 3022, pero sus condiciones dicen "válida para
-- todas las compras realizadas del 1° al 31 de julio de 2023". Las fechas de
-- las condiciones mandan (regla nueva del prompt): queda vencido.
--
-- Idempotente.
update beneficio
   set vigencia_hasta = '2023-07-31'
 where id like 'scotiabank:jorge-martinez-2022-01-01:%'
   and vigencia_hasta is distinct from '2023-07-31';

update beneficio
   set vigencia_hasta = null
 where vigencia_hasta > current_date + interval '3 years';
