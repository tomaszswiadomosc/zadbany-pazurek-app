-- Zadbany Pazurek: przypomnienia push. Supabase -> SQL Editor -> wklej całość -> Run.
-- KROK A: tabela na zgody na powiadomienia (jedno urządzenie = jeden wiersz).
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "wlasne urzadzenia" on public.push_subs;
create policy "wlasne urzadzenia" on public.push_subs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- KROK B: harmonogram. Co godzinę woła funkcję push-pory; funkcja sama wysyła tylko o 8, 13 i 19 czasu polskiego.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule('push-pory') where exists (select 1 from cron.job where jobname = 'push-pory');
select cron.schedule('push-pory', '0 * * * *', $$
  select net.http_post(
    url := 'https://jwwcvbbsksumglmxvbzm.supabase.co/functions/v1/push-pory',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3d2N2YmJza3N1bWdsbXh2YnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzOTI2MzksImV4cCI6MjEwOTk2ODYzOX0.t7GFOMqhq8s3DuH6eYtkiB5UOyy30S9WzTaSv-A-UzA', 'x-cron-secret', '82ea7f140310ab6c4cb4bec1356c21dfd0ba462da336bfd8'),
    body := '{}'::jsonb
  );
$$);
