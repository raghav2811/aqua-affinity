-- ============================================================
-- Run this in the Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- 1. blockchain_log  (connected to vr_sensors via sensor_id)
-- ============================================================
create table if not exists blockchain_log (
  id           uuid         default gen_random_uuid() primary key,
  tx_hash      text         not null unique,
  block_number bigint,
  sensor_id    text         references vr_sensors(id) on delete set null,
  data_hash    text         not null,
  payload      jsonb,
  chain        text         not null default 'simulation',
  created_at   timestamptz  not null default now()
);

create index if not exists blockchain_log_sensor_id_idx  on blockchain_log(sensor_id);
create index if not exists blockchain_log_created_at_idx on blockchain_log(created_at desc);

-- Allow the service-role key (used by getSupabaseAdmin) to read/write
alter table blockchain_log enable row level security;

create policy "service role full access on blockchain_log"
  on blockchain_log for all
  using (true)
  with check (true);


-- 2. metrics_snapshots  (hourly aggregated readings from FarmerDashboard)
-- ============================================================
create table if not exists metrics_snapshots (
  id                        uuid         default gen_random_uuid() primary key,
  captured_at               timestamptz  not null default now(),

  total_sensors             int,
  sensors_active            int,
  sensors_blocked           int,
  sensors_standby           int,

  avg_groundwater_level_m   numeric(6,2),
  min_groundwater_level_m   numeric(6,2),
  max_groundwater_level_m   numeric(6,2),

  total_flow_rate_lpm       numeric(8,2),
  est_daily_usage_liters    numeric(14,2),

  avg_soil_moisture_pct     numeric(5,1),
  avg_temperature_c         numeric(5,1),

  sensors_pump_on           int,
  total_alerts_unread       int
);

create index if not exists metrics_snapshots_captured_at_idx on metrics_snapshots(captured_at desc);

alter table metrics_snapshots enable row level security;

create policy "service role full access on metrics_snapshots"
  on metrics_snapshots for all
  using (true)
  with check (true);
