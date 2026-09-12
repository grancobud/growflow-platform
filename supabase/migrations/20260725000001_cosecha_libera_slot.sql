-- Una planta cosechada sale de la Sala de Riego y libera su lugar.
--
-- Antes, cosechar solo cambiaba `fase`; la Sala filtra por `activa`, así que la
-- planta seguía apareciendo y contando para el total de riego (el contador decía
-- 45/45 con 3 plantas ya cosechadas adentro).
--
-- El trigger va sobre `cosechas` porque es el punto común de los 3 caminos que
-- registran cosecha. Solo el de /plantas creaba el evento CambioFase; las cargadas
-- desde /cosecha no cambiaban ni la fase.

create or replace function public.marcar_planta_cosechada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.planta_id is not null then
    update plantas
       set activa = false, slot = null, fase = 'Cosechada'
     where id = new.planta_id and activa;
  end if;
  return new;
end $$;

drop trigger if exists trg_cosecha_libera_slot on cosechas;
create trigger trg_cosecha_libera_slot
  after insert on cosechas
  for each row execute function public.marcar_planta_cosechada();

-- Marcar la fase a mano también la saca de la Sala.
-- (De paso se le fija el search_path, que el linter marcaba como mutable.)
create or replace function public.aplicar_cambio_fase()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.tipo = 'CambioFase' and new.planta_id is not null and new.detalle is not null then
    update plantas set fase = new.detalle
    where id = new.planta_id
      and new.detalle in ('Germinacion','Plantula','Vegetativo','Floracion','Secado','Curado','Cosechada','Muerta');

    if new.detalle = 'Cosechada' then
      update plantas set activa = false, slot = null where id = new.planta_id;
    end if;
  end if;
  return new;
end $function$;

-- Backfill: las que ya estaban cosechadas y seguían ocupando lugar en la Sala.
update plantas p
   set activa = false, slot = null, fase = 'Cosechada'
 where p.activa
   and exists (select 1 from cosechas c where c.planta_id = p.id);
