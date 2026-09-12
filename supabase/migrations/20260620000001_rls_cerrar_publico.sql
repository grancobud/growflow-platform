-- Cierra el acceso anonimo (rol public) que quedaba en 4 tablas.
-- El resto ya estaba en authenticated. La app se loguea (demo) -> sin impacto.
-- Verificado: anon -> 0 filas; authenticated -> acceso completo.

drop policy if exists todo_costos on public.costos;
create policy auth_costos on public.costos for all to authenticated using (true) with check (true);

drop policy if exists todo_insumos on public.insumos;
create policy auth_insumos on public.insumos for all to authenticated using (true) with check (true);

drop policy if exists todo_mantenimientos on public.mantenimientos;
create policy auth_mantenimientos on public.mantenimientos for all to authenticated using (true) with check (true);

drop policy if exists todo_recordatorios on public.recordatorios;
create policy auth_recordatorios on public.recordatorios for all to authenticated using (true) with check (true);
