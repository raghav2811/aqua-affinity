# Godot Sprinkler Integration

Connects your Godot 4 VR world to the Supabase groundwater database.  
Once every `poll_interval_seconds` the script reads the latest sensor data and
starts or stops the sprinkler particle system automatically.

---

## Quick start

### 1. Copy the script into your project

Place `GroundwaterSprinkler.gd` anywhere inside `res://` — for example
`res://scripts/GroundwaterSprinkler.gd`.

### 2. Build the scene tree

```
YourField (Node3D)
├── GroundwaterSprinkler  (Node3D + GroundwaterSprinkler.gd)
│   ├── Sprinkler         (GPUParticles3D  OR  CPUParticles3D)
│   └── AlertLabel        (Label3D — optional, shows VR notifications)
```

The script discovers child nodes by name at runtime (`get_node_or_null`).
Node names must match exactly: **Sprinkler** and **AlertLabel**.

### 3. Set your credentials

**Option A — Inspector (per-scene, easy)**

Select the `GroundwaterSprinkler` node → set the exported properties:

| Property | Example value |
|---|---|
| `supabase_url` | `https://abcdefgh.supabase.co` |
| `supabase_anon_key` | `eyJhbGciO...` |
| `sensor_id` | `VRS-01` |
| `poll_interval_seconds` | `3600` |
| `critical_depth_threshold` | `12.0` |
| `safe_depth_threshold` | `8.0` |

> **Security note:** Do not hard-code the anon key in a committed `.gd` file.
> Use Option B for shared/published projects.

**Option B — Project Settings (global, safer for source control)**

Go to **Project → Project Settings → General** and add two custom settings:

| Setting name | Value |
|---|---|
| `application/config/supabase_url` | `https://abcdefgh.supabase.co` |
| `application/config/supabase_anon_key` | `eyJhbGciO...` |

The script reads these automatically when the Inspector fields are left blank.

### 4. Run the scene

On `_ready` the script:
1. Creates an `HTTPRequest` child node automatically.
2. Does an immediate poll, then polls every `poll_interval_seconds`.
3. Evaluates groundwater depth with the same logic as the web dashboard:
   - depth > `critical_depth_threshold` → **Sprinkler OFF** (`emitting = false`)
   - depth between safe and critical → **Standby** (no state change, warning logged)
   - depth < `safe_depth_threshold` → **Sprinkler ON** (`emitting = true`)

---

## Reacting to state changes from other scripts

The script emits a signal when the state transitions:

```gdscript
$GroundwaterSprinkler.sprinkler_state_changed.connect(
    func(new_state: String, level: float):
        match new_state:
            "blocked":  $HUD.show_warning("Low groundwater! Sprinkler blocked.")
            "active":   $HUD.show_info("Irrigating — water level OK.")
            "standby":  $HUD.show_info("Standby — monitor water level.")
)
```

Or call `force_check()` from an in-VR trigger button:

```gdscript
$GroundwaterSprinkler.force_check()
```

---

## Which Supabase endpoint is queried?

```
GET {SUPABASE_URL}/rest/v1/vr_sensor_latest_reading
    ?sensor_id=eq.VRS-01
    &select=sensor_id,groundwater_level,...
    &limit=1
```

`vr_sensor_latest_reading` is the PostgreSQL view defined in `supabase/schema.sql`:

```sql
CREATE VIEW vr_sensor_latest_reading AS
  SELECT DISTINCT ON (sensor_id) *
  FROM sensor_readings
  ORDER BY sensor_id, timestamp DESC;
```

Unread alerts are fetched from `farmer_alerts` and displayed in `AlertLabel`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Script prints `supabase_url … must be set` | Inspector fields blank and Project Settings not set |
| HTTP 401 errors in the Godot output | Wrong anon key; check it matches `Project Settings → API` in Supabase dashboard |
| No rows returned | Supabase not seeded — call `POST /api/seed` on the Next.js app first, or use the Simulator in the web dashboard to push readings |
| Sprinkler never turns on | `groundwaterLevel` slider in the web Simulator is above `safe_depth_threshold` (default 8 m) — drag it below 8 m and push |
| `HTTPRequest` node already exists | Scene was duplicated; safe to ignore — old node is reused via `get_node_or_null` |
