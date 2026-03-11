-- Migration: add blockchain_log table
-- Run this in your Supabase Dashboard → SQL Editor

create table if not exists blockchain_log (
  id           uuid default gen_random_uuid() primary key,
  tx_hash      text        not null,
  block_number bigint,
  sensor_id    text,
  data_hash    text        not null,
  payload      jsonb,
  chain        text        not null default 'simulation',
  created_at   timestamptz not null default now()
);

-- Index for fast queries by sensor and time
create index if not exists blockchain_log_sensor_id_idx  on blockchain_log (sensor_id);
create index if not exists blockchain_log_created_at_idx on blockchain_log (created_at desc);

-- Row-level security: authenticated users can read; service role can write
alter table blockchain_log enable row level security;

create policy "Allow authenticated reads"
  on blockchain_log for select
  using (auth.role() = 'authenticated');

create policy "Allow service-role inserts"
  on blockchain_log for insert
  with check (true);
