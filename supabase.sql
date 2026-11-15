-- Optional permanent storage for questions, notebook and attempts on a free host.
-- Run once: Supabase dashboard -> SQL Editor -> paste -> Run.
create table if not exists byterush_docs (
  owner text not null,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, kind)
);
-- Row level security ON with no policies: the public (anon) key can't read anything.
-- Only the server, using the secret service key, can read and write.
alter table byterush_docs enable row level security;
