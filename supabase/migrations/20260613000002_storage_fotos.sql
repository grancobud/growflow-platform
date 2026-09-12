-- Bucket publico de fotos + politicas (authenticated escribe, anon lee)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='fotos_auth_all') then
    create policy fotos_auth_all on storage.objects for all to authenticated
      using (bucket_id = 'fotos') with check (bucket_id = 'fotos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='fotos_public_read') then
    create policy fotos_public_read on storage.objects for select to anon
      using (bucket_id = 'fotos');
  end if;
end $$;
