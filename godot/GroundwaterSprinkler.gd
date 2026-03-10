## GroundwaterSprinkler.gd
##
## Attach to any Node3D in your Godot 4 scene.
## Reads groundwater data from your Supabase database every `poll_interval_seconds`
## and controls a GPUParticles3D (or CPUParticles3D) sprinkler node accordingly.
##
## Scene tree expected:
##   GroundwaterSprinkler   <-- this script
##   └── Sprinkler          <-- GPUParticles3D or CPUParticles3D node
##   └── AlertLabel         <-- Label3D node (optional, for VR HUD notifications)
##   └── HTTPRequest        <-- HTTPRequest node (will be created at runtime if absent)
##
## Project Settings (optional – overrides export vars):
##   application/config/supabase_url       = "https://xxxx.supabase.co"
##   application/config/supabase_anon_key  = "eyJhbGci..."

extends Node3D

## ── Export variables (set these in the Inspector) ─────────────────────────────

## Full Supabase project URL  (https://<your-project>.supabase.co)
@export var supabase_url: String = ""
## Anon/public API key from Project Settings → API
@export var supabase_anon_key: String = ""
## Which VR sensor to track (matches id in the vr_sensors table, e.g. "VRS-01")
@export var sensor_id: String = "VRS-01"
## Seconds between polls — mirror to 3600 for real hourly checks
@export var poll_interval_seconds: float = 30.0
## Groundwater depth in metres above which sprinkler is BLOCKED (too deep = too little water)
@export var critical_depth_threshold: float = 12.0
## Groundwater depth in metres below which sprinkler is ACTIVE (shallow = plenty of water)
@export var safe_depth_threshold: float = 8.0

## ── Node references ───────────────────────────────────────────────────────────

@onready var sprinkler: Node      = get_node_or_null("Sprinkler")
@onready var alert_label: Node    = get_node_or_null("AlertLabel")

## ── Internal state ────────────────────────────────────────────────────────────

var _http: HTTPRequest
var _poll_timer: Timer
var _fetching_alerts: bool = false
var _last_state: String = ""   # "active" | "standby" | "blocked"

# ─────────────────────────────────────────────────────────────────────────────
func _ready() -> void:
	# ── Resolve configuration (Inspector → Project Settings → fallback) ─────
	if supabase_url.is_empty():
		supabase_url = ProjectSettings.get_setting(
			"application/config/supabase_url", "")
	if supabase_anon_key.is_empty():
		supabase_anon_key = ProjectSettings.get_setting(
			"application/config/supabase_anon_key", "")

	if supabase_url.is_empty() or supabase_anon_key.is_empty():
		push_error("[GroundwaterSprinkler] supabase_url and supabase_anon_key must be set.")
		return

	# ── Create HTTPRequest child ─────────────────────────────────────────────
	_http = HTTPRequest.new()
	_http.name = "HTTP"
	add_child(_http)
	_http.request_completed.connect(_on_reading_response)

	# ── Start polling timer ──────────────────────────────────────────────────
	_poll_timer = Timer.new()
	_poll_timer.name = "PollTimer"
	_poll_timer.wait_time = poll_interval_seconds
	_poll_timer.autostart = true
	_poll_timer.timeout.connect(_fetch_latest_reading)
	add_child(_poll_timer)

	# Immediate first poll
	_fetch_latest_reading()


# ─────────────────────────────────────────────────────────────────────────────
#  HTTP: fetch latest reading from the vr_sensor_latest_reading view
# ─────────────────────────────────────────────────────────────────────────────
func _fetch_latest_reading() -> void:
	if _http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return   # previous request still in flight

	# Uses the view created by schema.sql:
	#   CREATE VIEW vr_sensor_latest_reading AS
	#     SELECT DISTINCT ON (sensor_id) * FROM sensor_readings ORDER BY sensor_id, timestamp DESC
	var endpoint: String = (
		supabase_url
		+ "/rest/v1/vr_sensor_latest_reading"
		+ "?sensor_id=eq." + sensor_id
		+ "&select=sensor_id,groundwater_level,soil_moisture,water_flow_rate,"
		+         "pump_status,temperature,ph,turbidity,battery_level,signal_strength,timestamp"
		+ "&limit=1"
	)

	var headers: PackedStringArray = [
		"apikey: " + supabase_anon_key,
		"Authorization: Bearer " + supabase_anon_key,
		"Accept: application/json",
	]

	var err: int = _http.request(endpoint, headers, HTTPClient.METHOD_GET)
	if err != OK:
		push_warning("[GroundwaterSprinkler] HTTPRequest error code: %d" % err)


# ─────────────────────────────────────────────────────────────────────────────
#  Response handler for sensor readings
# ─────────────────────────────────────────────────────────────────────────────
func _on_reading_response(result: int, response_code: int,
		_headers: PackedStringArray, body: PackedByteArray) -> void:

	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		push_warning(
			"[GroundwaterSprinkler] Bad response: result=%d code=%d" % [result, response_code])
		return

	var json := JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		push_warning("[GroundwaterSprinkler] JSON parse failed")
		return

	var rows = json.get_data()
	if not (rows is Array) or rows.is_empty():
		push_warning("[GroundwaterSprinkler] No rows returned for sensor: " + sensor_id)
		return

	var row: Dictionary = rows[0]
	_apply_decision(row)

	# Also fetch unacknowledged alerts for the HUD label (non-blocking second request)
	if alert_label != null and not _fetching_alerts:
		_fetch_unread_alerts()


# ─────────────────────────────────────────────────────────────────────────────
#  Core decision logic (mirrors evaluateWaterLevel in sensorMonitor.ts)
# ─────────────────────────────────────────────────────────────────────────────
func _apply_decision(row: Dictionary) -> void:
	var level: float = float(row.get("groundwater_level", critical_depth_threshold))
	var new_state: String

	if level > critical_depth_threshold:
		new_state = "blocked"
		_set_sprinkler(false)
		print("[GroundwaterSprinkler] BLOCKED — depth %.1f m > %.1f m (critical). Sprinkler OFF." \
			  % [level, critical_depth_threshold])

	elif level > safe_depth_threshold:
		new_state = "standby"
		# Standby — keep current state; do not toggle mid-irrigation
		print("[GroundwaterSprinkler] STANDBY — depth %.1f m in warning zone (%.1f–%.1f m)." \
			  % [level, safe_depth_threshold, critical_depth_threshold])

	else:
		new_state = "active"
		_set_sprinkler(true)
		print("[GroundwaterSprinkler] ACTIVE — depth %.1f m < %.1f m (safe). Sprinkler ON." \
			  % [level, safe_depth_threshold])

	if new_state != _last_state:
		_last_state = new_state
		emit_signal("sprinkler_state_changed", new_state, level)


# ─────────────────────────────────────────────────────────────────────────────
#  Sprinkler particle node control
# ─────────────────────────────────────────────────────────────────────────────
func _set_sprinkler(active: bool) -> void:
	if sprinkler == null:
		return
	# Works for both GPUParticles3D and CPUParticles3D
	if sprinkler.has_method("set_emitting"):
		sprinkler.set_emitting(active)
	# Fallback: toggle visibility
	sprinkler.visible = active


# ─────────────────────────────────────────────────────────────────────────────
#  Fetch unread alerts (for VR HUD label)
# ─────────────────────────────────────────────────────────────────────────────
func _fetch_unread_alerts() -> void:
	_fetching_alerts = true

	var endpoint: String = (
		supabase_url
		+ "/rest/v1/farmer_alerts"
		+ "?sensor_id=eq." + sensor_id
		+ "&acknowledged=eq.false"
		+ "&order=timestamp.desc"
		+ "&limit=3"
		+ "&select=message,level,timestamp"
	)

	var headers: PackedStringArray = [
		"apikey: " + supabase_anon_key,
		"Authorization: Bearer " + supabase_anon_key,
		"Accept: application/json",
	]

	# Use a separate HTTPRequest for alerts to avoid conflicting with the main one
	var http_alerts := HTTPRequest.new()
	http_alerts.name = "HTTPAlerts"
	add_child(http_alerts)
	# Lambda captures http_alerts reference so it can be freed after the call
	http_alerts.request_completed.connect(
		func(result, code, _hdrs, body):
			_on_alerts_response(result, code, body)
			http_alerts.queue_free()
			_fetching_alerts = false
	)

	var err := http_alerts.request(endpoint, headers, HTTPClient.METHOD_GET)
	if err != OK:
		http_alerts.queue_free()
		_fetching_alerts = false


func _on_alerts_response(_result: int, response_code: int,
		body: PackedByteArray) -> void:

	if response_code != 200:
		return

	var json := JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		return

	var rows = json.get_data()
	if not (rows is Array) or rows.is_empty():
		if alert_label != null and alert_label.has_method("set_text"):
			alert_label.set_text("")
		return

	# Build a short multi-line message for the 3D Label
	var lines: PackedStringArray = []
	for r in rows:
		var msg: String = str(r.get("message", ""))
		# Strip emoji / leading special chars for cleaner VR label
		msg = msg.replace("🚨", "").replace("⚠️", "").replace("✅", "").strip_edges()
		lines.append(msg.left(80))    # truncate to 80 chars per line

	if alert_label != null and alert_label.has_method("set_text"):
		alert_label.set_text("\n".join(lines))


# ─────────────────────────────────────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────────────────────────────────────

## Emitted whenever the sprinkler state transitions (e.g. "blocked" → "active")
signal sprinkler_state_changed(new_state: String, groundwater_level: float)

## Force an immediate poll (e.g. call from an in-VR button)
func force_check() -> void:
	_fetch_latest_reading()

## Returns the last known state string: "active" | "standby" | "blocked" | ""
func get_sprinkler_state() -> String:
	return _last_state
