-- Magic-link token store (LLP-12)
-- A durable single-use store for passwordless sign-in tokens, so auth works
-- across stateless serverless invocations WITHOUT requiring a separate KV
-- service. Written and read ONLY by the service role in /api/auth/*.
-- Apply via the Supabase SQL editor or `supabase db push`.

create table if not exists public.magic_tokens (
  id         text primary key,               -- opaque token id (magic:<id> key)
  value      text not null,                  -- JSON payload (email, etc.)
  expires_at timestamptz not null            -- hard expiry; enforced on consume
);

-- Sweep helper: quickly find expired rows for optional cleanup.
create index if not exists magic_tokens_expires_at on public.magic_tokens (expires_at);

-- RLS on, with NO client policies: the anon/authenticated keys can neither read
-- nor write. All access is via the service role, which bypasses RLS.
alter table public.magic_tokens enable row level security;
