-- Clube do Game: schema do Supabase.
-- Rode este arquivo inteiro em Supabase → SQL Editor → New query → Run.
-- É seguro rodar de novo: tudo usa "if not exists" / "or replace".

-- Mês do clube no fuso de Brasília (precisa bater com TIMEZONE em assets/js/config.js).
create or replace function public.club_month() returns text
language sql stable as $$
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')
$$;

-- Jogos sugeridos. Cada jogo pertence à votação de um mês.
create table if not exists public.games (
  id              uuid primary key default gen_random_uuid(),
  month           text not null default public.club_month() check (month ~ '^\d{4}-\d{2}$'),
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  platform        text check (char_length(platform) <= 40),
  duration        text check (duration in ('curto', 'medio', 'longo')),
  pitch           text check (char_length(pitch) <= 280),
  cover_url       text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 500)),
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by_name text check (char_length(created_by_name) <= 60),
  created_at      timestamptz not null default now()
);

-- O mesmo jogo não entra duas vezes na mesma votação (ignora maiúsculas e espaços).
create unique index if not exists games_month_title_key on public.games (month, lower(btrim(title)));

-- Votos. A chave primária (jogo, pessoa) é o que garante 1 voto por jogo por pessoa.
create table if not exists public.votes (
  game_id    uuid not null references public.games (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.games enable row level security;
alter table public.votes enable row level security;

-- Leitura: qualquer visitante vê os jogos e a contagem de votos.
drop policy if exists "games: leitura publica" on public.games;
create policy "games: leitura publica" on public.games for select using (true);

drop policy if exists "votes: leitura publica" on public.votes;
create policy "votes: leitura publica" on public.votes for select using (true);

-- Sugerir: só quem está logado, sempre em nome próprio e só no mês corrente.
drop policy if exists "games: membro sugere no mes atual" on public.games;
create policy "games: membro sugere no mes atual" on public.games for insert to authenticated
  with check (created_by = auth.uid() and month = public.club_month());

-- Remover: só quem sugeriu, e só enquanto a votação do mês está aberta.
drop policy if exists "games: autor remove no mes atual" on public.games;
create policy "games: autor remove no mes atual" on public.games for delete to authenticated
  using (created_by = auth.uid() and month = public.club_month());

-- Votar: só logado, só em nome próprio, só em jogo da votação aberta.
drop policy if exists "votes: membro vota no mes atual" on public.votes;
create policy "votes: membro vota no mes atual" on public.votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and g.month = public.club_month())
  );

-- Tirar o voto: só o próprio, e só enquanto a votação está aberta.
drop policy if exists "votes: membro tira o voto no mes atual" on public.votes;
create policy "votes: membro tira o voto no mes atual" on public.votes for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and g.month = public.club_month())
  );

-- Sem policy de update: ninguém edita votos ou jogos depois de criados.

-- Atualização ao vivo (Realtime) para o site recarregar quando alguém vota.
do $$
begin
  begin alter publication supabase_realtime add table public.games; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.votes; exception when duplicate_object then null; end;
end $$;
