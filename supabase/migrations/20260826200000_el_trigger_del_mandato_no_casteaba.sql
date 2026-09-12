-- El trigger del mandato tiraba error de tipos, y volteaba la aprobacion entera.
--
-- `ong_asociados.mandato_hora` es TIMESTAMPTZ, pero solicitud_pasar_mandato le
-- asignaba `new.mandato_fecha::time` — un `time with time zone`. Postgres no
-- convierte solo:
--
--     ERROR: column "mandato_hora" is of type timestamp with time zone
--            but expression is of type time with time zone
--
-- Y como el trigger corre DENTRO del update que engancha el asociado, el error
-- no queda en el trigger: voltea el update. O sea que APROBAR UNA SOLICITUD
-- FALLABA, siempre, sin importar desde donde se aprobara.
--
-- POR QUE NADIE LO VIO
--
-- Estaba tapado por el bug de solicitud_crear (ver 20260826120000): como no se
-- podia crear ninguna solicitud, nunca hubo una que aprobar y el trigger nunca
-- llego a dispararse. Al arreglar el primero, este quedo al descubierto — y
-- justo a tiempo, porque el alta automatica habria fallado en cada persona.
--
-- Es el TERCER bug de la misma migracion del mandato (20260823210000), y los
-- tres son de la misma familia: codigo que nunca se ejecuto.
--
-- EL ARREGLO
--
-- La columna es timestamptz, asi que guarda el INSTANTE de la firma, no una
-- hora suelta. `new.mandato_fecha` ya es exactamente eso. El `::time` sobraba y
-- ademas perdia el dia.
--
-- Se conserva el `coalesce`: una firma sin fecha —que no deberia pasar, la pone
-- la base— igual queda registrada con el momento en que se aprobo.

create or replace function public.solicitud_pasar_mandato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.asociado_id is not null
     and new.mandato_aceptado
     and (old.asociado_id is distinct from new.asociado_id)
  then
    update public.ong_asociados
       set mandato_aceptado = true,
           mandato_fecha    = coalesce(new.mandato_fecha::date, current_date),
           -- timestamptz contra timestamptz. El `::time` de antes no casteaba
           -- y ademas tiraba el dia a la basura.
           mandato_hora     = coalesce(new.mandato_fecha, now()),
           mandato_version  = new.mandato_version
     where id = new.asociado_id
       -- Nunca pisar una firma que ya esta: si el asociado ya firmo, esa firma
       -- es la buena y la de la solicitud es vieja.
       and coalesce(mandato_aceptado, false) = false;
  end if;
  return new;
end;
$$;

-- El trigger lo dispara la base, no un usuario: nadie necesita EXECUTE sobre
-- esta funcion. Antes era invocable por `anon` via /rest/v1/rpc, por el default
-- de Postgres que otorga EXECUTE a PUBLIC.
revoke all on function public.solicitud_pasar_mandato() from public, anon, authenticated;
