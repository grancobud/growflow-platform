-- `resumen_plantas` la podia leer ANON, con el nombre del paciente adentro.
--
-- 31/08/2026. No aparecio buscandola: aparecio verificando OTRA cosa. Al listar
-- las vistas para confirmar que las dos nuevas no le quedaran abiertas a `anon`,
-- la consulta mostro tambien estas dos:
--
--   relname           reloptions              anon_lee
--   lotes_stock       null                    TRUE
--   resumen_plantas   null                    TRUE
--
-- `lotes_stock` estaba a salvo por accidente: su `where mi_rol() <> all (...)`
-- le devuelve cero filas a anon igual. El grant sobraba y se saco lo mismo.
--
-- `resumen_plantas` NO TENIA WHERE NINGUNO. Es security definer —el default de
-- una vista, que es justamente lo que se olvida— asi que corria con los
-- permisos de su dueno y se salteaba el RLS de `plantas` y de `pacientes`.
--
-- MEDIDO, no deducido, ejecutando `set local role anon`:
--   select count(*), max(paciente_nombre) from resumen_plantas
--   -> 75 filas, «Virginia Barnes»
--
-- Y la publishable key viaja en el bundle publico, asi que eso era alcanzable
-- con un GET a la API REST desde cualquier lado, sin cuenta. Expone que una
-- persona con nombre y apellido es paciente de cannabis medicinal: el dato
-- sensible del art. 2 de la Ley 25.326, que es la ley que uno cita cuando
-- discute esto.
--
-- DOS ARREGLOS, PORQUE UNO SOLO NO ALCANZA:
--
-- 1. El WHERE, igual que `lotes_stock`. Es la barrera de verdad: mientras la
--    vista sea security definer, el grant es lo unico que la separa del mundo, y
--    un grant se vuelve a poner solo el dia que alguien corre un `grant select on
--    all tables`.
-- 2. El nombre del paciente sale por `puede_ver_padron()`. El cultivador y el
--    auditor tienen que ver las plantas —es su trabajo— y ninguno de los dos ve
--    `pacientes`: que el nombre se les colara por esta vista contradecia lo que
--    la tabla ya decia que no.
--
-- LA LECCION, que es la de siempre en este repo y volvio a pasar: una vista NO
-- es una tabla. Una tabla sin policies no la lee nadie; una vista sin WHERE la
-- lee todo el mundo. Al crear una vista sobre datos con RLS hay que decidir su
-- barrera a mano, y despues MIRARLA:
--
--   select c.relname, c.reloptions,
--          has_table_privilege('anon', 'public.'||c.relname, 'SELECT')
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'v';

create or replace view public.resumen_plantas as
select p.id,
    p.codigo,
    coalesce(p.apodo, g.nombre, 'Sin nombre'::text) as nombre,
    g.nombre as genetica,
    g.banco,
    g.tipo,
    p.fase,
    p.fecha_germinacion,
    current_date - p.fecha_germinacion as dias_de_vida,
    p.sustrato,
    p.maceta,
    p.ubicacion,
    p.slot,
    p.activa,
    p.paciente_id,
    case when public.puede_ver_padron() then pac.nombre_completo end as paciente_nombre,
    ( select max(e.fecha) from eventos e where e.planta_id = p.id and e.tipo = 'Riego'::text) as ultimo_riego,
    ( select count(*) from eventos e where e.planta_id = p.id) as total_eventos,
    p.genetica_id
   from plantas p
     left join geneticas g on g.id = p.genetica_id
     left join pacientes pac on pac.id = p.paciente_id
  where public.mi_rol() <> all (array['sin_perfil'::text, 'demo'::text]);

revoke all on public.resumen_plantas from anon;
grant select on public.resumen_plantas to authenticated;

revoke all on public.lotes_stock from anon;
grant select on public.lotes_stock to authenticated;
