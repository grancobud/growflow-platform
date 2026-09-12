-- EL ROL DE QUIEN ABRE LA SEDE.
--
-- Socio lo definio con precision el 02/09/2026, mirando el panel: «este
-- acceso seria el que le daria al Socio al dia de la fecha, para que abra la
-- sede, tome los valores de las salas, haga control de stock, dinero y pueda
-- hacer las tareas de los botones».
--
-- Es exactamente eso y nada mas: el panel de apertura, la lectura de ambiente,
-- el control de caja y stock, y las tres cosas del mostrador -entregar, cobrar,
-- anotar una visita-. NO ve el cultivo, ni lo institucional, ni las fichas
-- clinicas, ni los costos, ni las tablas, ni los usuarios.
--
-- ⚠️ ESTE MAPA VIVE EN DOS LADOS Y HAY QUE TOCAR LOS DOS. Aca estan las
-- funciones que usa el RLS; en `hooks/useAuth.ts` esta el mapa que decide que
-- se dibuja. Tocar solo uno deja una pantalla que se muestra y una base que
-- devuelve cero, que es como se ve un permiso mal hecho: rota, no prohibida.

create or replace function public.puede_ver_plata()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select public.mi_rol() in
    ('administrador', 'administrador_sistema', 'administrativo', 'auditor', 'mostrador');
$function$;

-- EL PADRON SI, LA FICHA CLINICA NO.
--
-- Para entregarle a alguien hay que poder encontrarlo y ver su cupo. Lo que no
-- ve es la patologia ni el medico tratante: eso lo corta `puede_ver_clinico()`
-- columna por columna en `pacientes_segun_rol`, que es la misma separacion que
-- ya tiene el administrativo.
create or replace function public.puede_ver_padron()
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select public.puede_ver_clinico() or public.mi_rol() in ('administrativo', 'mostrador');
$function$;
