-- Run this in Supabase SQL Editor AFTER `supabase-schema.sql`.
-- Creates a profile row when a new auth user is created, using SECURITY DEFINER so
-- it is not blocked by RLS (fixes "new row violates row-level security policy for table profiles"
-- when the client inserts before a session JWT is attached, or when sign-up returns no session).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nick text;
  g text;
  cal int;
begin
  nick := coalesce(nullif(btrim(new.raw_user_meta_data->>'nickname'), ''), split_part(coalesce(new.email, 'user'), '@', 1));
  if nick = '' then
    nick := 'User';
  end if;

  g := lower(btrim(coalesce(new.raw_user_meta_data->>'goal_type', 'maintain_weight')));
  if g not in ('lose_weight', 'maintain_weight', 'gain_weight') then
    g := 'maintain_weight';
  end if;

  if new.raw_user_meta_data ? 'daily_calorie_target' and jsonb_typeof(new.raw_user_meta_data->'daily_calorie_target') = 'number' then
    cal := floor((new.raw_user_meta_data->'daily_calorie_target')::text::numeric)::integer;
  elsif new.raw_user_meta_data->>'daily_calorie_target' is not null and btrim(new.raw_user_meta_data->>'daily_calorie_target') <> '' then
    cal := floor((new.raw_user_meta_data->>'daily_calorie_target')::numeric)::integer;
  else
    cal := null;
  end if;

  insert into public.profiles (id, email, nickname, goal_type, daily_calorie_target, created_at, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    nick,
    g,
    cal,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    nickname = excluded.nickname,
    goal_type = excluded.goal_type,
    daily_calorie_target = excluded.daily_calorie_target,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
