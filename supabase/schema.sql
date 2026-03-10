-- ============================================================
--  GroundwaterIQ — Supabase Schema
--  Run the entire file in the Supabase SQL Editor
--  Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
--  1. TABLES
-- ─────────────────────────────────────────────────────────────

-- Industry sensors (24 sensors across 4 Tamil Nadu zones)
CREATE TABLE IF NOT EXISTS industry_sensors (
  id                   TEXT        PRIMARY KEY,
  name                 TEXT        NOT NULL,
  industry_name        TEXT        NOT NULL,
  location             TEXT        NOT NULL,
  lat                  FLOAT       NOT NULL,
  lng                  FLOAT       NOT NULL,
  industry_type        TEXT        NOT NULL
                         CHECK (industry_type IN ('small_micro', 'water_intensive')),
  has_noc              BOOLEAN     NOT NULL DEFAULT FALSE,
  groundwater_level    FLOAT       NOT NULL,
  moisture_percentage  INTEGER     NOT NULL,
  today_extraction     INTEGER     NOT NULL,
  zone_id              TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily extraction history (last 30 days per industry sensor)
CREATE TABLE IF NOT EXISTS daily_extractions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id  TEXT    NOT NULL REFERENCES industry_sensors(id) ON DELETE CASCADE,
  date       DATE    NOT NULL,
  liters     INTEGER NOT NULL,
  UNIQUE (sensor_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_extractions_sensor_date
  ON daily_extractions (sensor_id, date DESC);

-- Rainfall forecasts (next 7 days per industry sensor)
CREATE TABLE IF NOT EXISTS rainfall_forecasts (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id   TEXT    NOT NULL REFERENCES industry_sensors(id) ON DELETE CASCADE,
  date        DATE    NOT NULL,
  mm          FLOAT   NOT NULL,
  probability INTEGER NOT NULL,
  UNIQUE (sensor_id, date)
);
CREATE INDEX IF NOT EXISTS idx_rainfall_forecasts_sensor_date
  ON rainfall_forecasts (sensor_id, date DESC);

-- VR / Farmer sensors (5 sensors pushed from VR world)
CREATE TABLE IF NOT EXISTS vr_sensors (
  id                       TEXT        PRIMARY KEY,
  name                     TEXT        NOT NULL,
  farmer_name              TEXT        NOT NULL,
  location                 TEXT        NOT NULL,
  lat                      FLOAT       NOT NULL,
  lng                      FLOAT       NOT NULL,
  crop_type                TEXT        NOT NULL,
  field_area_hectares      FLOAT       NOT NULL,
  critical_depth_threshold FLOAT       NOT NULL DEFAULT 12,
  safe_depth_threshold     FLOAT       NOT NULL DEFAULT 8,
  sprinkler_state          TEXT        NOT NULL DEFAULT 'standby'
                             CHECK (sprinkler_state IN ('active', 'blocked', 'standby')),
  last_checked             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hourly sensor readings pushed by VR sensors
CREATE TABLE IF NOT EXISTS sensor_readings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id         TEXT        NOT NULL REFERENCES vr_sensors(id) ON DELETE CASCADE,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  groundwater_level FLOAT       NOT NULL,
  soil_moisture     INTEGER     NOT NULL,
  water_flow_rate   FLOAT       NOT NULL,
  pump_status       TEXT        NOT NULL CHECK (pump_status IN ('on', 'off')),
  temperature       FLOAT       NOT NULL,
  ph                FLOAT       NOT NULL,
  turbidity         FLOAT       NOT NULL,
  battery_level     INTEGER     NOT NULL,
  signal_strength   INTEGER     NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_ts
  ON sensor_readings (sensor_id, timestamp DESC);

-- Farmer alert notifications
CREATE TABLE IF NOT EXISTS farmer_alerts (
  id           TEXT        PRIMARY KEY,
  sensor_id    TEXT        NOT NULL REFERENCES vr_sensors(id) ON DELETE CASCADE,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level        TEXT        NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
  message      TEXT        NOT NULL,
  acknowledged BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farmer_alerts_sensor
  ON farmer_alerts (sensor_id, timestamp DESC);


-- ─────────────────────────────────────────────────────────────
--  2. TRIGGERS — auto-update updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_industry_sensors_updated_at ON industry_sensors;
CREATE TRIGGER trg_industry_sensors_updated_at
  BEFORE UPDATE ON industry_sensors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_vr_sensors_updated_at ON vr_sensors;
CREATE TRIGGER trg_vr_sensors_updated_at
  BEFORE UPDATE ON vr_sensors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
--  3. ROW LEVEL SECURITY (RLS)
--  The anon (public) key can read everything and write sensor
--  data. In production, tighten write policies to service_role.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE industry_sensors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_extractions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_sensors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_alerts      ENABLE ROW LEVEL SECURITY;

-- Public reads
CREATE POLICY "read industry_sensors"
  ON industry_sensors FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "read daily_extractions"
  ON daily_extractions FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "read rainfall_forecasts"
  ON rainfall_forecasts FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "read vr_sensors"
  ON vr_sensors FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "read sensor_readings"
  ON sensor_readings FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "read farmer_alerts"
  ON farmer_alerts FOR SELECT TO anon, authenticated USING (TRUE);

-- Write policies (IoT sensors push data, dashboard acknowledges alerts)
CREATE POLICY "insert industry_sensors"
  ON industry_sensors FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "update industry_sensors"
  ON industry_sensors FOR UPDATE TO anon, authenticated USING (TRUE);

CREATE POLICY "insert daily_extractions"
  ON daily_extractions FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "upsert daily_extractions"
  ON daily_extractions FOR UPDATE TO anon, authenticated USING (TRUE);

CREATE POLICY "insert rainfall_forecasts"
  ON rainfall_forecasts FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "upsert rainfall_forecasts"
  ON rainfall_forecasts FOR UPDATE TO anon, authenticated USING (TRUE);

CREATE POLICY "insert sensor_readings"
  ON sensor_readings FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "update vr_sensors"
  ON vr_sensors FOR UPDATE TO anon, authenticated USING (TRUE);

CREATE POLICY "insert vr_sensors"
  ON vr_sensors FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "insert farmer_alerts"
  ON farmer_alerts FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "update farmer_alerts"
  ON farmer_alerts FOR UPDATE TO anon, authenticated USING (TRUE);


-- ─────────────────────────────────────────────────────────────
--  4. HELPER — latest reading per VR sensor (materialised view)
--  Use this in queries that only need the most-recent reading.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vr_sensor_latest_reading AS
SELECT DISTINCT ON (sensor_id) *
FROM   sensor_readings
ORDER  BY sensor_id, timestamp DESC;


-- ─────────────────────────────────────────────────────────────
--  DONE — run /api/seed to populate initial data
-- ─────────────────────────────────────────────────────────────
