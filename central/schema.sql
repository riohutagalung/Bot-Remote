create table public.rh_settings (id text primary key, value jsonb not null);
create table public.rh_sessions (token_hash text primary key, expires_at timestamptz not null);
create table public.rh_devices (id text primary key, token_hash text not null, name text not null, info jsonb not null default '{}', last_seen timestamptz, created_at timestamptz not null default now());
create table public.rh_commands (id uuid primary key default gen_random_uuid(), device_id text not null references public.rh_devices(id), action text not null check(action in ('stop_ahk','block_ahk','unblock_ahk','close_windows','shutdown','cancel_shutdown')), status text not null default 'pending' check(status in ('pending','delivered','completed')), result jsonb, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 seconds');
create index rh_commands_pending on public.rh_commands(device_id,created_at) where status='pending';
create table public.rh_login_limits (key text primary key, attempts integer not null, until_at timestamptz not null);
alter table public.rh_settings enable row level security;
alter table public.rh_sessions enable row level security;
alter table public.rh_devices enable row level security;
alter table public.rh_commands enable row level security;
alter table public.rh_login_limits enable row level security;
revoke all on public.rh_settings,public.rh_sessions,public.rh_devices,public.rh_commands,public.rh_login_limits from anon,authenticated;
grant all on public.rh_settings,public.rh_sessions,public.rh_devices,public.rh_commands,public.rh_login_limits to service_role;
create function public.rh_login_attempt(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.rh_login_limits where until_at<now();
 insert into public.rh_login_limits(key,attempts,until_at) values(p_key,1,now()+interval '1 minute') on conflict(key) do update set attempts=public.rh_login_limits.attempts+1 returning attempts into n;
 return n<=10;
end; $$;
create function public.rh_claim(p_device text) returns setof public.rh_commands language sql security invoker set search_path='' as $$
 update public.rh_commands set status='delivered' where id in (select id from public.rh_commands where device_id=p_device and status='pending' and expires_at>now() order by created_at for update skip locked limit 10) returning *;
$$;
revoke all on function public.rh_login_attempt(text),public.rh_claim(text) from public,anon,authenticated;
grant execute on function public.rh_login_attempt(text),public.rh_claim(text) to service_role;
