-- Arma las DDJJ semestrales del art. 8 de los semestres YA CERRADOS.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- `ong_ddjj` estaba en 0. Pacientes vinculados y variedades salen de las
-- entregas registradas.
--
-- SOLO LOS SEMESTRES CERRADOS. El corriente (2026-S2) se deja libre para el
-- boton "Armar la de 2026-S2" de la pantalla Declaraciones, que lo llena en
-- vivo desde el cultivo. Crear la fila aca lo dejaria sin efecto.
--
-- LAS VARIEDADES SE FILTRAN POR unidad = 'g'. Sin ese filtro la lista trae
-- "PICADOR ACRILICO 3P OJITOS ROJOS", "PAPEL FUMANCHU" y "FILTROS WHITE HEMP":
-- parafernalia que se entrega por unidad. Una DDJJ que declare eso como
-- variedad de cannabis ante el Estado es peor que el campo vacio. La flor a
-- granel va por gramo; el aceite, los accesorios y la cuota "Programa
-- REPROCANN" van por unidad.
--
-- `plantas_total` y `plantas_floracion` quedan NULL: son una foto del cultivo
-- en el momento de la declaracion y no hay registro historico por semestre.
-- Inventar un numero de plantas en una DDJJ es exactamente lo que no se hace.
--
-- `presentada` = false y `fecha_presentacion` = NULL: la declaracion se arma,
-- no se presento por TAD. Igual criterio que `carta_porte_presentada`.
--
-- RESULTADO: 2025-S2 (58 vinculados, 19 variedades) y 2026-S1 (72, 12).
-- PENDIENTE EN ORIGEN: la dispensa de "PORTA GRANDE" tiene unidad='g' cargada
-- mal —es un accesorio— y por eso entra a la lista de 2025-S2. Se corrige en
-- la dispensa, no aca.
insert into public.ong_ddjj
  (periodo, pacientes_vinculados, variedades, presentada, fecha_presentacion, notas)
select s.periodo,
       count(distinct s.paciente_id),
       string_agg(distinct s.variedad, ', ' order by s.variedad)
         filter (where s.variedad is not null),
       false, null,
       'Armada desde las ' || count(*) || ' entregas del periodo. Variedades: ' ||
       'flor a granel entregada por gramo. Plantas pendientes de relevar: no hay ' ||
       'registro de cultivo del periodo. NO PRESENTADA ante el Estado.'
  from (
    select case when extract(month from d.fecha) <= 6
                then extract(year from d.fecha)::int || '-S1'
                else extract(year from d.fecha)::int || '-S2' end periodo,
           d.paciente_id,
           case when d.unidad = 'g'
                then coalesce(nullif(btrim(g.nombre),''), nullif(btrim(d.producto),''))
           end variedad
      from public.ong_dispensas d
      left join public.geneticas g on g.id = d.genetica_id
  ) s
 where s.periodo in ('2025-S2', '2026-S1')
   and not exists (select 1 from public.ong_ddjj x where x.periodo = s.periodo)
 group by s.periodo;
