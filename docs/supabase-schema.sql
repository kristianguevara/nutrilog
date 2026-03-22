-- NutriLog — run in Supabase SQL Editor after creating the project.
-- Auth: for development, consider disabling "Confirm email" (Authentication → Providers → Email)
-- so sign-up returns a session immediately; otherwise users confirm via email before first login.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nickname text not null,
  goal_type text not null,
  daily_calorie_target integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_log_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  time text not null,
  meal_type text not null,
  item_category text not null default 'food',
  food_name text not null,
  quantity numeric not null,
  unit text not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  notes text,
  source_type text not null,
  ai_confidence numeric,
  ai_assumptions text,
  image_metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists food_log_entries_user_id_idx on public.food_log_entries (user_id);
create index if not exists food_log_entries_user_date_idx on public.food_log_entries (user_id, date desc);

create table if not exists public.suggestion_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  generated_at timestamptz not null,
  input_snapshot jsonb not null,
  suggestions jsonb not null
);

create index if not exists suggestion_snapshots_user_id_idx on public.suggestion_snapshots (user_id);

create table if not exists public.coach_advice (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sequence int not null,
  generated_at timestamptz not null,
  input_snapshot jsonb not null,
  summary text not null,
  unique (user_id, date, sequence)
);

create index if not exists coach_advice_user_id_idx on public.coach_advice (user_id);

alter table public.profiles enable row level security;
alter table public.food_log_entries enable row level security;
alter table public.suggestion_snapshots enable row level security;
alter table public.coach_advice enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- food_log_entries
create policy "food_select_own" on public.food_log_entries for select using (auth.uid() = user_id);
create policy "food_insert_own" on public.food_log_entries for insert with check (auth.uid() = user_id);
create policy "food_update_own" on public.food_log_entries for update using (auth.uid() = user_id);
create policy "food_delete_own" on public.food_log_entries for delete using (auth.uid() = user_id);

-- suggestion_snapshots
create policy "sug_select_own" on public.suggestion_snapshots for select using (auth.uid() = user_id);
create policy "sug_insert_own" on public.suggestion_snapshots for insert with check (auth.uid() = user_id);
create policy "sug_update_own" on public.suggestion_snapshots for update using (auth.uid() = user_id);
create policy "sug_delete_own" on public.suggestion_snapshots for delete using (auth.uid() = user_id);

-- coach_advice
create policy "coach_select_own" on public.coach_advice for select using (auth.uid() = user_id);
create policy "coach_insert_own" on public.coach_advice for insert with check (auth.uid() = user_id);
create policy "coach_update_own" on public.coach_advice for update using (auth.uid() = user_id);
create policy "coach_delete_own" on public.coach_advice for delete using (auth.uid() = user_id);

-- Next: run `supabase-profile-trigger.sql` so new users get a profile row without client-side RLS issues.
-- Auth rate limits & email confirmation: see `supabase-auth-dev.md`.
