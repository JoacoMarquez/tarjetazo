-- Nativa llama a su tarjeta "Nativa Internacional" (red Cabal, con Diners Club
-- International y Discover), no "Nativa Cabal". El id no cambia: lo usan los
-- beneficios, la ficha y las billeteras guardadas.
update producto set nombre = 'Nativa Internacional' where id = 'nativa-cabal';
