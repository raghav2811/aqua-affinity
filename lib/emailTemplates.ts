// ─────────────────────────────────────────────────────────────────────────────
//  lib/emailTemplates.ts
//  HTML email templates for farmer alerts and industry fine notifications
// ─────────────────────────────────────────────────────────────────────────────

// Shared palette
const PRIMARY   = '#0ea5e9';
const DEEP_BLUE = '#0c4a6e';
const LIGHT_BG  = '#f0f9ff';
const BORDER    = '#bae6fd';
const CRITICAL  = '#ef4444';
const WARNING   = '#f59e0b';
const SUCCESS   = '#22c55e';

function base(title: string, accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(14,165,233,0.08);">

        <!-- Header banner -->
        <tr>
          <td style="background:${accentColor};padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">AQUA AFFINITY · IoT MONITORING PLATFORM</p>
                  <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:22px;">💧</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${LIGHT_BG};padding:18px 32px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
              This is an automated alert from the <strong>Aqua Affinity Groundwater IoT Platform</strong>.
              For support, contact your Block Agriculture Officer or the platform administrator.<br/>
              <span style="color:#94a3b8;">Do not reply to this email directly.</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function metricRow(label: string, value: string, highlight = false): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${highlight ? CRITICAL : DEEP_BLUE};text-align:right;border-bottom:1px solid #f1f5f9;">${value}</td>
  </tr>`;
}

// ── 1. Farmer groundwater alert ───────────────────────────────────────────────
export interface FarmerAlertEmailData {
  farmerName: string;
  sensorId: string;
  sensorName: string;
  location: string;
  cropType: string;
  alertLevel: 'warning' | 'critical';
  alertMessage: string;
  groundwaterLevel: number;
  criticalDepthThreshold: number;
  sprinklerState: 'active' | 'blocked' | 'standby';
  timestamp: string;
}

export function farmerAlertEmail(data: FarmerAlertEmailData): { subject: string; html: string } {
  const isCritical = data.alertLevel === 'critical';
  const accentColor = isCritical ? CRITICAL : WARNING;
  const levelLabel  = isCritical ? '🚨 CRITICAL ALERT' : '⚠️ WARNING ALERT';
  const sprinklerBadge = data.sprinklerState === 'blocked'
    ? `<span style="background:${CRITICAL}20;color:${CRITICAL};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Sprinkler BLOCKED</span>`
    : data.sprinklerState === 'standby'
    ? `<span style="background:${WARNING}20;color:${WARNING};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Sprinkler STANDBY</span>`
    : `<span style="background:${SUCCESS}20;color:${SUCCESS};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Sprinkler ACTIVE</span>`;

  const subject = `${levelLabel}: Groundwater ${isCritical ? 'Critical' : 'Warning'} — ${data.sensorId} (${data.location})`;

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Dear <strong>${data.farmerName}</strong>,<br/><br/>
      Your groundwater monitoring sensor has detected a condition that requires your immediate attention.
      Please review the details below and take appropriate action.
    </p>

    <!-- Alert badge -->
    <div style="background:${accentColor}12;border-left:4px solid ${accentColor};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor};">${levelLabel}</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">${data.alertMessage.replace(/^[^\s]+\s/, '')}</p>
    </div>

    <!-- Sensor details table -->
    <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:${DEEP_BLUE};text-transform:uppercase;letter-spacing:0.5px;">Sensor Details</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${metricRow('Sensor ID', data.sensorId)}
      ${metricRow('Sensor Name', data.sensorName)}
      ${metricRow('Location', data.location)}
      ${metricRow('Crop Type', data.cropType)}
      ${metricRow('Groundwater Depth', `${data.groundwaterLevel.toFixed(1)} m below surface`, data.groundwaterLevel > data.criticalDepthThreshold)}
      ${metricRow('Critical Threshold', `${data.criticalDepthThreshold} m`)}
      ${metricRow('Alert Time', new Date(data.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }))}
    </table>

    <!-- Sprinkler status -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
      <span style="font-size:13px;color:#475569;font-weight:500;">Sprinkler Status:</span>
      ${sprinklerBadge}
    </div>

    ${isCritical ? `
    <!-- Action box for critical -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${CRITICAL};">Immediate Actions Required</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;line-height:2;">
        <li>Stop all irrigation activities immediately</li>
        <li>Contact your Block Agriculture Officer</li>
        <li>Switch to alternative water sources if available</li>
        <li>Monitor the sensor readings through the platform dashboard</li>
      </ul>
    </div>` : `
    <!-- Action box for warning -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${WARNING};">Recommended Actions</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;line-height:2;">
        <li>Reduce irrigation frequency and quantity</li>
        <li>Schedule irrigation only during cooler hours (early morning)</li>
        <li>Consider drought-resistant irrigation methods</li>
        <li>Monitor groundwater levels closely over the next 48 hours</li>
      </ul>
    </div>`}

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
      You can view real-time sensor data and manage your settings on the
      <strong style="color:${PRIMARY};">Aqua Affinity Dashboard</strong>.
    </p>
  `;

  return { subject, html: base(isCritical ? '🚨 Critical Groundwater Alert' : '⚠️ Groundwater Warning', accentColor, body) };
}

// ── 2. Industry fine / violation alert ───────────────────────────────────────
export interface IndustryFineEmailData {
  recipientName: string;
  industryName: string;
  sensorId: string;
  location: string;
  industryType: 'small_micro' | 'water_intensive';
  violationType: 'critical' | 'no_noc' | 'warning';
  todayExtraction: number;
  dailyLimit: number;
  finePerDay: number;
  daysExceeded: number;
  totalFine30Days: number;
  nocAnnualFine?: number;
  nocFineCategory?: string;
  timestamp: string;
}

export function industryFineEmail(data: IndustryFineEmailData): { subject: string; html: string } {
  const isNoNoc    = data.violationType === 'no_noc';
  const isCritical = data.violationType === 'critical';
  const accentColor = isNoNoc || isCritical ? CRITICAL : WARNING;

  const formatINR = (n: number) =>
    '₹' + n.toLocaleString('en-IN');

  const excessLitres = Math.max(0, data.todayExtraction - data.dailyLimit);
  const excessPct    = ((data.todayExtraction / data.dailyLimit) * 100).toFixed(0);
  const industryLabel = data.industryType === 'water_intensive' ? 'Water-Intensive Industry' : 'Small / Micro Industry';

  const subject = isNoNoc
    ? `VIOLATION NOTICE: No NOC — Annual Fine ${formatINR(data.nocAnnualFine ?? 0)} | ${data.industryName}`
    : `FINE NOTICE: Daily Extraction Limit Exceeded — ${data.industryName} (${data.sensorId})`;

  const titleText = isNoNoc
    ? '⛔ NOC Violation Notice'
    : isCritical
    ? '🚨 Extraction Limit Exceeded'
    : '⚠️ Extraction Limit Warning';

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Dear <strong>${data.recipientName}</strong>,<br/><br/>
      ${isNoNoc
        ? 'Your facility is operating groundwater extraction <strong>without a valid NOC (No Objection Certificate)</strong>. This is a regulatory violation subject to annual fines.'
        : isCritical
        ? 'Your facility has <strong>exceeded the permitted daily groundwater extraction limit</strong>. Fines are applicable as per the groundwater regulation schedule.'
        : 'Your facility is approaching the permitted daily groundwater extraction limit. Please take corrective action to avoid penalties.'}
    </p>

    <!-- Warning banner -->
    <div style="background:${accentColor}12;border-left:4px solid ${accentColor};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor};">
        ${isNoNoc ? 'NOC VIOLATION' : isCritical ? 'DAILY LIMIT EXCEEDED' : 'APPROACHING DAILY LIMIT'}
      </p>
      <p style="margin:0;font-size:14px;color:#334155;">
        ${isNoNoc
          ? `Operating without NOC — ${data.nocFineCategory ?? 'Fine applicable'}`
          : `Today's extraction: ${(data.todayExtraction / 1000).toFixed(1)} KLD (${excessPct}% of limit${excessLitres > 0 ? `, excess: ${(excessLitres/1000).toFixed(1)} KLD` : ''})`}
      </p>
    </div>

    <!-- Facility details -->
    <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:${DEEP_BLUE};text-transform:uppercase;letter-spacing:0.5px;">Facility Details</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${metricRow('Industry Name', data.industryName)}
      ${metricRow('Sensor ID', data.sensorId)}
      ${metricRow('Location', data.location)}
      ${metricRow('Industry Classification', industryLabel)}
      ${metricRow('Permitted Daily Limit', `${(data.dailyLimit / 1000).toFixed(0)} KLD (${data.dailyLimit.toLocaleString('en-IN')} L)`)}
      ${metricRow("Today's Extraction", `${(data.todayExtraction / 1000).toFixed(1)} KLD`, data.todayExtraction > data.dailyLimit)}
      ${metricRow('Notice Date', new Date(data.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' }))}
    </table>

    <!-- Fine summary -->
    <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:${DEEP_BLUE};text-transform:uppercase;letter-spacing:0.5px;">Fine Summary</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${isNoNoc ? `
      ${metricRow('Violation Type', 'Operating without NOC', true)}
      ${metricRow('Extraction Category', data.nocFineCategory ?? '—')}
      ${metricRow('Annual Fine Applicable', formatINR(data.nocAnnualFine ?? 0), true)}
      ` : `
      ${metricRow('Fine Per Day', formatINR(data.finePerDay))}
      ${metricRow('Days Exceeded (30-day)', String(data.daysExceeded), data.daysExceeded > 0)}
      ${metricRow('Total Fine (30-day)', formatINR(data.totalFine30Days), data.totalFine30Days > 0)}
      `}
    </table>

    <!-- Action required -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${CRITICAL};">Compliance Actions Required</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;line-height:2;">
        ${isNoNoc ? `
        <li>Apply for NOC from the Central Ground Water Authority (CGWA) immediately</li>
        <li>Prepare documentation for extraction volumes and purpose</li>
        <li>Annual fine of ${formatINR(data.nocAnnualFine ?? 0)} is due pending NOC acquisition</li>
        ` : `
        <li>Reduce daily extraction to within the permitted limit of ${(data.dailyLimit/1000).toFixed(0)} KLD</li>
        <li>Implement water-recycling or treatment-and-reuse systems</li>
        <li>Contact the CGWA for a limit review if business requirements have changed</li>
        `}
        <li>Log into your Aqua Affinity dashboard to view detailed extraction reports</li>
        <li>Retain this notice as part of your regulatory compliance record</li>
      </ul>
    </div>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
      Fine notices are generated automatically by the <strong style="color:${PRIMARY};">Aqua Affinity IoT Platform</strong>
      based on real-time sensor data. Disputed readings must be raised within 7 days of this notice.
    </p>
  `;

  return { subject, html: base(titleText, accentColor, body) };
}
