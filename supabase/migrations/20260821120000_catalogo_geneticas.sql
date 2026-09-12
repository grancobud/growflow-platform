-- Arma el catalogo de geneticas y engancha lotes y dispensas.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `geneticas` tenia 1 sola fila y las 1.241 dispensas tenian genetica_id en
-- NULL. Por eso el comprobante de dispensacion caia siempre al texto libre del
-- producto y el informe de geneticas no tenia de donde leer.
--
-- EL CATALOGO SALE DE LOS LOTES, no del texto de la dispensa. El lote es lo
-- que la cooperativa efectivamente tuvo en el estante; ong_dispensas.producto
-- es texto tipeado y arrastra cosas que no son variedades (PORTA GRANDE con
-- unidad g cargada mal). La lista de los lotes son 21 nombres limpios.
--
-- LAS DISPENSAS SE ENGANCHAN POR SU LOTE, no por comparar nombres. La dispensa
-- salio de un lote y el lote tiene una variedad: es el unico vinculo que no
-- depende de que dos textos esten escritos igual.
--
-- NN, EXTERIOR NN y Sin identificar SE CARGAN IGUAL. No son variedades: son
-- material sin variedad documentada. Dejarlos afuera esconderia cuanto material
-- no tiene origen identificado, que es justo lo que hay que poder ver. Quedan
-- marcados en notas.
--
-- Nada mas se completa: banco, tipo, THC, CBD, tiempo de flora y demas quedan
-- NULL. No hay de donde sacarlos y no se inventan.
--
-- RESULTADO: 22 geneticas, 95/101 lotes ligados (los 6 restantes son aceite y
-- accesorios, unidad u), 1.213/1.241 dispensas, 0 cruzadas mal.
insert into public.geneticas (nombre, notas)
select distinct btrim(l.producto),
       case when btrim(l.producto) in ('NN', 'EXTERIOR NN', 'Sin identificar')
            then 'Sin variedad documentada. No es un nombre de genetica: es material de origen no identificado.'
            else 'Cargada desde los lotes en existencia. Datos de banco, tipo y cannabinoides pendientes.'
       end
  from public.ong_lotes l
 where l.unidad = 'g' and coalesce(btrim(l.producto),'') <> ''
   and not exists (select 1 from public.geneticas g
                    where lower(btrim(g.nombre)) = lower(btrim(l.producto)));

update public.ong_lotes l
   set genetica_id = g.id
  from public.geneticas g
 where lower(btrim(g.nombre)) = lower(btrim(l.producto))
   and l.genetica_id is null;

update public.ong_dispensas d
   set genetica_id = l.genetica_id
  from public.ong_lotes l
 where l.codigo = d.lote_codigo
   and l.genetica_id is not null
   and d.genetica_id is null;
