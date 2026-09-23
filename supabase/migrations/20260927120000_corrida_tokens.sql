-- Tokens del modelo por corrida (#22), para estimar el costo en el backoffice
-- y en el resumen diario. Es un estimado: la referencia sigue siendo el saldo
-- de la consola de Anthropic (los contadores de `usage` ya subestimaron).
alter table corrida
  add column if not exists tokens_entrada         int not null default 0,
  add column if not exists tokens_cache_escritura int not null default 0,
  add column if not exists tokens_cache_lectura   int not null default 0,
  add column if not exists tokens_salida          int not null default 0;
