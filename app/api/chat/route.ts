/**
 * POST /api/chat
 *
 * Personalized AI chatbot powered by Groq (llama-3.3-70b-versatile, free tier).
 * Context is built SERVER-SIDE from hardcoded static data so the bot always
 * has the real sensor values regardless of Supabase connectivity.
 *
 * Body: { messages: {role,content}[], role: string, farmerName?: string, companyName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { vrSensors }         from '@/lib/farmerSensors';
import { industrySensors }   from '@/lib/data';
import { calculateFine }     from '@/lib/fineCalculation';

// ── Language instruction suffix ──────────────────────────────────────────────

const LANGUAGE_SUFFIX: Record<string, string> = {
  en: 'Always respond in clear, simple English.',
  ta: 'IMPORTANT: Always respond entirely in Tamil (தமிழ்). Use simple, everyday Tamil that a village farmer would understand. Do NOT use English unless quoting a number or unit. Use Tamil script throughout.',
  hi: 'IMPORTANT: Always respond entirely in Hindi (हिंदी). Use simple, everyday Hindi that a village farmer would understand. Do NOT use English unless quoting a number or unit. Use Devanagari script throughout.',
};

// ── Role-based system prompt builder — uses static data directly ──────────────

function buildSystemPrompt(
  role: string,
  farmerName: string | undefined,
  companyName: string | undefined,
  language = 'en',
): string {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const base = `You are AquaBot — an AI assistant embedded in GroundwaterIQ, an IoT groundwater monitoring platform for Tamil Nadu, India. Today is ${today}. Keep every reply concise (under 5 sentences unless a detailed explanation is clearly needed). Never reveal another user's data.`;

  // ── Farmer ────────────────────────────────────────────────────────────────
  if (role === 'farmer') {
    const name = farmerName ?? 'Farmer';
    const norm = name.trim().toLowerCase();
    const mine = vrSensors.filter(s => s.farmerName?.trim().toLowerCase() === norm);
    const s    = mine[0];

    if (!s) {
      return `${base}\n\nYou are helping farmer ${name}. No sensor is registered for this farmer. Answer general questions about irrigation, groundwater, and crops in Tamil Nadu.`;
    }

    const r  = s.currentReading;
    const st = s.sprinklerState;
    const stLabel = st === 'active' ? '🟢 ACTIVE' : st === 'blocked' ? '🔴 BLOCKED' : '🟡 STANDBY';
    const activeAlerts = s.alerts.filter(a => !a.acknowledged).map(a => a.message);
    const alertStr = activeAlerts.length > 0 ? activeAlerts.join(' | ') : 'None';

    return `${base}

You are helping ${name}, a farmer in Tamil Nadu.

── SENSOR DATA ──────────────────────────────────
Sensor   : ${s.id}
Location : ${s.location}
Crop     : ${s.cropType}  |  Field: ${s.fieldAreaHectares} ha
Sprinkler: ${stLabel}
Thresholds: Safe ≤${s.safeDepthThreshold} m  |  Critical >${s.criticalDepthThreshold} m

Current Reading (live as of ${r?.timestamp ?? 'unknown'}):
  Groundwater Depth : ${r?.groundwaterLevel ?? 'N/A'} m below surface
  Soil Moisture     : ${r?.soilMoisture ?? 'N/A'} %
  Water Flow Rate   : ${r?.waterFlowRate ?? 'N/A'} L/min
  Air Temperature   : ${r?.temperature ?? 'N/A'} °C
  pH                : ${r?.ph ?? 'N/A'}
  Turbidity         : ${r?.turbidity ?? 'N/A'} NTU
  Pump Status       : ${r?.pumpStatus ?? 'N/A'}
  Battery           : ${r?.batteryLevel ?? 'N/A'} %
  Signal            : ${r?.signalStrength ?? 'N/A'} %

Active Alerts: ${alertStr}
─────────────────────────────────────────────────

Using the EXACT numbers above, answer questions about this farmer's groundwater depth, soil moisture, sprinkler status, irrigation timing, water conservation, crop health, and pump decisions. Quote the specific numbers when asked. Never reference other farmers.

${LANGUAGE_SUFFIX[language] ?? LANGUAGE_SUFFIX.en}`;
  }

  // ── Industry ──────────────────────────────────────────────────────────────
  if (role === 'industry') {
    const company = companyName ?? 'Company';
    const mine    = industrySensors.filter(s => s.industryName === company);
    const s       = mine[0];

    if (!s) {
      return `${base}\n\nYou are helping ${company}. No sensor registered for this company. Answer general questions about groundwater extraction, NOC regulations, and water conservation.`;
    }

    const limitL    = s.industryType === 'water_intensive' ? 100_000 : 10_000;
    const limitStr  = `${limitL / 1000} KLD`;
    const extL      = s.todayExtraction ?? 0;
    const extStr    = extL >= 1000 ? `${(extL / 1000).toFixed(1)} KLD` : `${extL} L`;
    const overLimit = extL > limitL;
    const fineInfo  = calculateFine(s);
    const compliance = overLimit
      ? `⚠️ LIMIT EXCEEDED — ${extStr} extracted vs ${limitStr} limit`
      : `✅ Within limit — ${extStr} of ${limitStr} used today`;

    const allSensors = mine.length > 1
      ? mine.map(sx => {
          const ex = sx.todayExtraction ?? 0;
          const lim = sx.industryType === 'water_intensive' ? 100_000 : 10_000;
          return `  ${sx.id} @ ${sx.location}: ${ex >= 1000 ? (ex/1000).toFixed(1)+'KLD' : ex+'L'} / ${lim/1000}KLD — GW ${sx.groundwaterLevel}m`;
        }).join('\n')
      : '';

    return `${base}

You are helping a representative of ${company}.

── SENSOR DATA ──────────────────────────────────
Sensor       : ${s.id}
Location     : ${s.location}
Industry Type: ${s.industryType === 'water_intensive' ? 'Water-Intensive' : 'Small / Micro'}
NOC Status   : ${s.hasNOC ? '✅ Has NOC' : '❌ No NOC (annual penalty applies)'}
${mine.length > 1 ? `\nAll ${mine.length} sensors:\n${allSensors}\n` : ''}
Today's Extraction : ${extStr}
Daily Limit        : ${limitStr}
Compliance         : ${compliance}
Fine Status        : ${fineInfo.status}
Groundwater Level  : ${s.groundwaterLevel} m below ground
Soil Moisture      : ${s.moisturePercentage} %
─────────────────────────────────────────────────

Using the EXACT numbers above, answer questions about extraction status, compliance, NOC penalties (₹500/day small over-limit; ₹5,000/day water-intensive over-limit; ₹2L–₹10L annual NOC fine), water conservation strategies, and groundwater management. Do NOT mention other companies.`;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  const overLimitCount = industrySensors.filter(s => calculateFine(s).status !== 'normal').length;
  const noNOCCount     = industrySensors.filter(s => !s.hasNOC).length;
  const criticalFarmers = vrSensors
    .filter(s => s.sprinklerState === 'blocked')
    .map(s => `${s.farmerName} (${s.id}, ${s.location}): GW ${s.currentReading?.groundwaterLevel}m`)
    .join(' | ');

  return `${base}

You are helping the platform Administrator.

── PLATFORM SUMMARY ──────────────────────────────
Industry Sensors      : ${industrySensors.length} across 4 zones (Tiruppur, Coimbatore, Chennai, Madurai)
Farmer Sensors        : ${vrSensors.length} (VRS-01 to VRS-0${vrSensors.length})
Over Extraction Limit : ${overLimitCount} / ${industrySensors.length}
Without NOC           : ${noNOCCount}
Critical Farmers      : ${criticalFarmers || 'None'}
─────────────────────────────────────────────────

Answer questions about platform health, zone-level compliance trends, sensor statistics, policy recommendations, and groundwater risk across Tamil Nadu.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, role, farmerName, companyName, language } = (await req.json()) as {
      messages:    { role: string; content: string }[];
      role:        string;
      farmerName?: string;
      companyName?: string;
      language?:   string;
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AquaBot is not configured yet. Ask the admin to add GROQ_API_KEY to .env.local (free at console.groq.com).' },
        { status: 503 },
      );
    }

    const systemPrompt = buildSystemPrompt(role ?? 'admin', farmerName, companyName, language ?? 'en');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 450,
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq ${groqRes.status}: ${errText}`);
    }

    const data  = await groqRes.json();
    const reply = (data.choices?.[0]?.message?.content as string) ?? 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[POST /api/chat]', err);
    return NextResponse.json({ error: 'Failed to get AI response. Please try again.' }, { status: 500 });
  }
}
