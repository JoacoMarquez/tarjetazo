-- Beneficio ocultado a mano desde el backoffice (#21): el banco lo sigue
-- publicando pero está muerto. Va sola: Postgres no deja usar un valor nuevo
-- de un enum en la misma transacción que lo agrega.
alter type estado_revision add value if not exists 'oculto';
