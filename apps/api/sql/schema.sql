-- Workshop OS. NOT applied by code: a schema change needs Thulaib's yes.
-- One records table keyed by kind, one audit table, one clients table. RLS is on with
-- NO policies, so the anon key every BB front end carries reads nothing here. The API
-- reaches these with the service role key, server side only.
create table if not exists wos_clients (slug text primary key, config jsonb not null, created_at timestamptz default now());
create table if not exists wos_records (id uuid primary key default gen_random_uuid(), client text not null references wos_clients(slug), kind text not null check (kind in ('jobs','customers','activities','photos')), data jsonb not null default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists wos_records_client_kind on wos_records (client, kind, updated_at desc);
create table if not exists wos_audit (id bigserial primary key, client text not null, seat text, action text not null, kind text, record_id uuid, at timestamptz default now());
alter table wos_clients enable row level security; alter table wos_records enable row level security; alter table wos_audit enable row level security;
-- photos: the data document carries a Storage URL in live mode, never the bytes. Bucket wos-photos, one folder per client, 1200px JPEG.
