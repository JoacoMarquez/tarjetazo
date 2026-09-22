-- Tiers que faltaban (#40). Va en su propia migración: Postgres no deja usar
-- un valor nuevo de un enum en la misma transacción que lo agrega.
alter type tier add value if not exists 'infinite';
alter type tier add value if not exists 'world';
alter type tier add value if not exists 'world_elite';
