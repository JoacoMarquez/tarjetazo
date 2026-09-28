-- Páginas que una corrida no pudo normalizar. El 2026-09-28 se acabó el saldo
-- del modelo: cada página fallaba, la corrida terminaba "bien" y Telegram decía
-- que todo había corrido. Ahora el runner guarda cuántas fallaron (y, sin
-- saldo, deja la corrida con error), el tablero las muestra y el resumen de
-- Telegram las marca.
alter table corrida add column if not exists fallidas integer not null default 0;
