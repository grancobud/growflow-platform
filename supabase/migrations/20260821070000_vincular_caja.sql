-- Liga cada movimiento de caja con el comprobante que lo respalda.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Los 1.690 asientos tenian dispensa_id y documento_id en NULL: la plata se
-- movio y no habia forma de saber que papel la respalda.
--
-- Empareja por fecha + monto exacto, SOLO donde el match es UNICO EN LAS DOS
-- DIRECCIONES: un asiento que matchea una sola dispensa Y esa dispensa matchea
-- un solo asiento. Sin la segunda condicion, dos entregas de $XX.XXX el mismo
-- dia se ligarian cruzadas. Un vinculo equivocado es PEOR que ninguno: hace
-- creer que el respaldo esta y apunta al papel de otro.
--
-- RESULTADO: 1.152 de 1.690 vinculados (68,2%), 0 duplicados en ambas
-- direcciones. Lo ambiguo queda suelto a proposito.
with cand as (
  select c.id cid, d.id did from public.ong_caja c
    join public.ong_dispensas d on d.fecha = c.fecha and d.aporte = c.monto
   where c.tipo = 'ingreso' and c.dispensa_id is null),
unicos as (
  select cid, did from cand
   where cid in (select cid from cand group by cid having count(*) = 1)
     and did in (select did from cand group by did having count(*) = 1))
update public.ong_caja c set dispensa_id = u.did from unicos u where c.id = u.cid;

with cand as (
  select c.id cid, g.id gid from public.ong_caja c
    join public.ong_documentos g on g.fecha = c.fecha and g.monto = c.monto and g.tipo = 'gasto'
   where c.tipo = 'egreso' and c.documento_id is null),
unicos as (
  select cid, gid from cand
   where cid in (select cid from cand group by cid having count(*) = 1)
     and gid in (select gid from cand group by gid having count(*) = 1))
update public.ong_caja c set documento_id = u.gid from unicos u where c.id = u.cid;
