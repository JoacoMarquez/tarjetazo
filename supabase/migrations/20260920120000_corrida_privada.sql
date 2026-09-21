-- `corrida` deja de ser de lectura pública: los errores y conteos del pipeline
-- son material interno, igual que `pagina_cruda` y `beneficio_revision` (que
-- nunca tuvieron policy de select). Nada de la web pública la leía; el
-- backoffice (/admin) la lee con la service role, que saltea RLS.
drop policy if exists "lectura publica" on corrida;
