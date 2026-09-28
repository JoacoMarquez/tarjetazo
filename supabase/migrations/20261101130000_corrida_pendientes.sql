-- Modo sin modelo (SCRAPER_SIN_MODELO=1): para no gastar saldo de la API, las
-- páginas que cambian en fuentes sin parser propio quedan guardadas sin
-- normalizar. La corrida cuenta cuántas; el tablero y Telegram lo muestran
-- sin tratarlo como problema.
alter table corrida add column if not exists pendientes integer not null default 0;
