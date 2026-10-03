-- Corrige 20261114210000: el texto idéntico también contaba como el mismo
-- local aunque no tuviera número de puerta. Dos locales de una cadena en la
-- misma calle sin número ("Avenida José Belloni", "General Artigas") quedaban
-- como uno (la limpieza borró 10). El número de puerta es obligatorio siempre;
-- el texto exacto sin número ya lo cubre el índice único de las fuentes.
create or replace function misma_sucursal (
  dir_a text, geom_a geography, dir_b text, geom_b geography
)
returns boolean language sql immutable as $$
  select clave_direccion(dir_a) = clave_direccion(dir_b)
     and clave_direccion(dir_a) ~ '\d+( bis)?$'
     and (geom_a is null or geom_b is null or st_dwithin(geom_a, geom_b, 200));
$$;
