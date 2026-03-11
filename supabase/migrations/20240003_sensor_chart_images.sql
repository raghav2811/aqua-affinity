-- ============================================================
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Table: sensor_chart_images
-- Stores one row per VR sensor mapping sensor_id → JPEG filename in the
-- Supabase Storage bucket "metrics-charts"
-- ============================================================
CREATE TABLE IF NOT EXISTS sensor_chart_images (
  sensor_id      text        PRIMARY KEY REFERENCES vr_sensors(id) ON DELETE CASCADE,
  image_filename text        NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sensor_chart_images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sensor_chart_images'
      AND policyname = 'service role full access on sensor_chart_images'
  ) THEN
    CREATE POLICY "service role full access on sensor_chart_images"
      ON sensor_chart_images FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- NOTE: Also create the storage bucket in Supabase Dashboard:
--   Storage → New bucket → Name: "metrics-charts" → Private → Create
-- OR the upload API route will auto-create it on first use.
