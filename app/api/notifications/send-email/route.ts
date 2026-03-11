// ─────────────────────────────────────────────────────────────────────────────
//  app/api/notifications/send-email/route.ts
//  POST /api/notifications/send-email
//
//  Accepts either a farmer_alert or industry_fine payload and sends the
//  appropriate email via Resend.
//
//  Body shape:
//    { type: 'farmer_alert',  to: string, data: FarmerAlertEmailData }
//    { type: 'industry_fine', to: string, data: IndustryFineEmailData }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { farmerAlertEmail, industryFineEmail } from '@/lib/emailTemplates';
import type { FarmerAlertEmailData, IndustryFineEmailData } from '@/lib/emailTemplates';
import { generateFarmerAlertPdf, generateIndustryFinePdf } from '@/lib/generatePdfReport';

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address must be a verified domain in your Resend account.
// While testing, Resend allows sending from onboarding@resend.dev to your own email.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'Aqua Affinity <onboarding@resend.dev>';

type FarmerAlertPayload = {
  type: 'farmer_alert';
  to: string;
  data: FarmerAlertEmailData;
};

type IndustryFinePayload = {
  type: 'industry_fine';
  to: string;
  data: IndustryFineEmailData;
};

type EmailPayload = FarmerAlertPayload | IndustryFinePayload;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[send-email] RESEND_API_KEY not set — skipping email send');
    return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY not configured' }, { status: 200 });
  }

  let payload: EmailPayload;
  try {
    payload = (await req.json()) as EmailPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.to || !payload.type) {
    return NextResponse.json({ error: 'Missing required fields: to, type' }, { status: 400 });
  }

  // Validate email address format
  if (!payload.to.includes('@')) {
    return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
  }

  let subject: string;
  let html: string;

  if (payload.type === 'farmer_alert') {
    const tpl = farmerAlertEmail(payload.data);
    subject   = tpl.subject;
    html      = tpl.html;
  } else if (payload.type === 'industry_fine') {
    const tpl = industryFineEmail(payload.data);
    subject   = tpl.subject;
    html      = tpl.html;
  } else {
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  }

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      ['mememzofficial@gmail.com'],
    subject,
    html,
  });

  if (error) {
    console.error('[send-email] Resend error:', error);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailId: data?.id }, { status: 200 });
}
