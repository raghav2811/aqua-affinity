// ─────────────────────────────────────────────────────────────────────────────
//  lib/generatePdfReport.ts
//  Generates PDF alert/fine reports using pdfkit (server-side only).
//  Returns a Node.js Buffer ready for email attachment or download.
// ─────────────────────────────────────────────────────────────────────────────

import PDFDocument from 'pdfkit';
import type { FarmerAlertEmailData, IndustryFineEmailData } from './emailTemplates';

// ── constants ─────────────────────────────────────────────────────────────────
const M  = 50;              // page margin (pt)
const PW = 595.28 - M * 2; // usable width on A4 (≈ 495 pt)

// ── core stream helper ────────────────────────────────────────────────────────
function makePdf(buildFn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: M, size: 'A4' });
    const parts: Buffer[] = [];
    doc.on('data',  (c: Buffer) => parts.push(c));
    doc.on('end',   ()          => resolve(Buffer.concat(parts)));
    doc.on('error', reject);
    buildFn(doc);
    doc.end();
  });
}

// ── drawing helpers ───────────────────────────────────────────────────────────

/** Coloured header banner. Returns Y position after the banner. */
function banner(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  accent: string,
): number {
  doc.rect(M, 40, PW, 66).fillColor(accent).fill();

  doc.fillColor('#bfdbfe').font('Helvetica').fontSize(7)
     .text('AQUA AFFINITY  |  GROUNDWATER IoT MONITORING PLATFORM',
       M + 14, 50, { width: PW - 14, characterSpacing: 0.5, lineBreak: false });

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
     .text(title, M + 14, 65, { width: PW - 28, lineBreak: false });

  doc.fillColor('#dbeafe').font('Helvetica').fontSize(8.5)
     .text(subtitle, M + 14, 88, { width: PW - 28, lineBreak: false });

  return 122; // Y after banner + padding
}

/** Bold section heading with a coloured left-bar. Returns new Y. */
function sectionHead(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  accent: string,
): number {
  doc.rect(M, y, 3, 13).fillColor(accent).fill();
  doc.fillColor('#0c4a6e').font('Helvetica-Bold').fontSize(9.5)
     .text(text.toUpperCase(), M + 10, y + 1, { characterSpacing: 0.3, lineBreak: false });
  return y + 22;
}

/** Two-column key/value table with alternating row shading. Returns new Y. */
function table(
  doc: PDFKit.PDFDocument,
  rows: [string, string, boolean?][],
  y: number,
): number {
  const rowH = 25;
  const c1   = PW * 0.46; // label column width

  rows.forEach(([label, value, hi], i) => {
    const ry = y + i * rowH;
    doc.rect(M, ry, PW, rowH).fillColor(i % 2 === 0 ? '#f8fafc' : '#ffffff').fill();
    doc.rect(M, ry, PW, rowH).strokeColor('#e2e8f0').lineWidth(0.4).stroke();

    doc.fillColor('#475569').font('Helvetica').fontSize(9.5)
       .text(label, M + 10, ry + 8, { width: c1 - 16, lineBreak: false });

    doc.fillColor(hi ? '#ef4444' : '#0c4a6e').font('Helvetica-Bold').fontSize(9.5)
       .text(value, M + c1 + 6, ry + 8, { width: PW - c1 - 14, align: 'right', lineBreak: false });
  });

  return y + rows.length * rowH + 14;
}

/** Alert/violation info box with accent left border. Returns new Y. */
function infoBox(
  doc: PDFKit.PDFDocument,
  label: string,
  body: string,
  accent: string,
  y: number,
): number {
  doc.font('Helvetica').fontSize(9.5);
  const textH = doc.heightOfString(body, { width: PW - 28 });
  const boxH  = textH + 38;

  doc.rect(M, y, PW, boxH).fillColor('#fafafa').fill();
  doc.rect(M, y, 3, boxH).fillColor(accent).fill();
  doc.rect(M, y, PW, boxH).strokeColor(accent).lineWidth(0.4).stroke();

  doc.fillColor(accent).font('Helvetica-Bold').fontSize(8)
     .text(label, M + 14, y + 10, { characterSpacing: 0.5, lineBreak: false });

  doc.fillColor('#334155').font('Helvetica').fontSize(9.5)
     .text(body, M + 14, y + 25, { width: PW - 28 });

  return y + boxH + 12;
}

/** Bulleted action list. Returns new Y. */
function actionList(
  doc: PDFKit.PDFDocument,
  items: string[],
  y: number,
  accent: string,
): number {
  doc.font('Helvetica').fontSize(9.5);
  items.forEach((item) => {
    // bullet
    doc.fillColor(accent).font('Helvetica').fontSize(14)
       .text('\u2022', M + 6, y, { lineBreak: false });
    // item text
    doc.fillColor('#334155').font('Helvetica').fontSize(9.5)
       .text(item, M + 20, y, { width: PW - 24 });
    // advance by rendered text height
    doc.font('Helvetica').fontSize(9.5);
    y += doc.heightOfString(item, { width: PW - 24 }) + 8;
  });
  return y + 6;
}

/** Footer rule + attribution line. */
function pageFooter(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#bae6fd').lineWidth(0.5).stroke();
  const ts = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short',
  });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
     .text('Automated report — Aqua Affinity Groundwater IoT Platform.', M, y + 8, { width: PW, align: 'center' });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
     .text('Generated: ' + ts, M, y + 20, { width: PW, align: 'center' });
}

/** Strip leading emoji/symbol prefix (e.g. "🚨 [VRS-05]..." → "[VRS-05]...") */
function stripEmoji(msg: string): string {
  return msg.replace(/^\S+\s/, '');
}

// ── Farmer alert PDF ──────────────────────────────────────────────────────────

export function generateFarmerAlertPdf(data: FarmerAlertEmailData): Promise<Buffer> {
  const isCrit = data.alertLevel === 'critical';
  const accent = isCrit ? '#ef4444' : '#f59e0b';

  return makePdf((doc) => {
    const ts = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short',
    });

    let y = banner(
      doc,
      isCrit ? 'Critical Groundwater Alert' : 'Groundwater Warning Alert',
      `Report generated: ${ts}`,
      accent,
    );

    y = infoBox(
      doc,
      isCrit ? 'CRITICAL ALERT' : 'WARNING ALERT',
      stripEmoji(data.alertMessage),
      accent,
      y,
    );

    y = sectionHead(doc, 'Sensor Details', y, accent);
    y = table(doc, [
      ['Sensor ID',          data.sensorId],
      ['Sensor Name',        data.sensorName],
      ['Location',           data.location],
      ['Crop Type',          data.cropType],
      ['Groundwater Depth',
       `${data.groundwaterLevel.toFixed(1)} m below surface`,
       data.groundwaterLevel > data.criticalDepthThreshold],
      ['Critical Threshold', `${data.criticalDepthThreshold} m`],
      ['Sprinkler Status',   data.sprinklerState.toUpperCase()],
      ['Alert Time',         new Date(data.timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
      })],
    ], y);

    y = sectionHead(
      doc,
      isCrit ? 'Immediate Actions Required' : 'Recommended Actions',
      y,
      accent,
    );
    y = actionList(
      doc,
      isCrit
        ? [
            'Stop all irrigation activities immediately.',
            'Contact your Block Agriculture Officer.',
            'Switch to alternative water sources if available.',
            'Monitor sensor readings via the Aqua Affinity dashboard.',
          ]
        : [
            'Reduce irrigation frequency and quantity.',
            'Schedule irrigation only during cooler hours (early morning).',
            'Consider drought-resistant irrigation methods.',
            'Monitor groundwater levels closely over the next 48 hours.',
          ],
      y,
      accent,
    );

    pageFooter(doc, y + 16);
  });
}

// ── Industry fine PDF ─────────────────────────────────────────────────────────

export function generateIndustryFinePdf(data: IndustryFineEmailData): Promise<Buffer> {
  const accent  = '#ef4444';
  const fmtINR  = (n: number) => 'Rs. ' + n.toLocaleString('en-IN');
  const isNoNoc = data.violationType === 'no_noc';
  const titleTxt = isNoNoc
    ? 'NOC Violation Notice'
    : data.violationType === 'critical'
    ? 'Extraction Limit Exceeded'
    : 'Extraction Limit Warning';

  return makePdf((doc) => {
    const ts = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short',
    });

    let y = banner(doc, titleTxt, `Notice Date: ${ts}`, accent);

    const vMsg = isNoNoc
      ? `Operating without NOC. Category: ${data.nocFineCategory ?? 'Annual fine applicable'}.`
      : `Today's extraction: ${(data.todayExtraction / 1000).toFixed(1)} KLD  |  ` +
        `Permitted: ${(data.dailyLimit / 1000).toFixed(0)} KLD  |  ` +
        `Excess: ${Math.max(0, (data.todayExtraction - data.dailyLimit) / 1000).toFixed(1)} KLD`;

    y = infoBox(doc, isNoNoc ? 'NOC VIOLATION' : 'DAILY LIMIT EXCEEDED', vMsg, accent, y);

    y = sectionHead(doc, 'Facility Details', y, accent);
    y = table(doc, [
      ['Industry Name',         data.industryName],
      ['Sensor ID',             data.sensorId],
      ['Location',              data.location],
      ['Classification',        data.industryType === 'water_intensive'
        ? 'Water-Intensive Industry' : 'Small / Micro Industry'],
      ['Permitted Daily Limit', `${(data.dailyLimit / 1000).toFixed(0)} KLD (${data.dailyLimit.toLocaleString('en-IN')} L)`],
      ["Today's Extraction",    `${(data.todayExtraction / 1000).toFixed(1)} KLD`,
        data.todayExtraction > data.dailyLimit],
    ], y);

    y = sectionHead(doc, 'Fine Summary', y, accent);
    y = table(doc, isNoNoc
      ? [
          ['Violation Type',    'Operating without NOC', true],
          ['Extraction Category', data.nocFineCategory ?? '---'],
          ['Annual Fine',       fmtINR(data.nocAnnualFine ?? 0), true],
        ]
      : [
          ['Fine Per Day',           fmtINR(data.finePerDay)],
          ['Days Exceeded (30-day)', String(data.daysExceeded), data.daysExceeded > 0],
          ['Total Fine (30-day)',    fmtINR(data.totalFine30Days), data.totalFine30Days > 0],
        ],
      y,
    );

    y = sectionHead(doc, 'Compliance Actions Required', y, accent);
    y = actionList(
      doc,
      isNoNoc
        ? [
            'Apply for NOC from the Central Ground Water Authority (CGWA) immediately.',
            'Prepare documentation for extraction volumes and intended use.',
            `Annual fine of ${fmtINR(data.nocAnnualFine ?? 0)} is applicable pending NOC acquisition.`,
            'Log into the Aqua Affinity dashboard for detailed extraction reports.',
          ]
        : [
            `Reduce daily extraction to within the permitted limit of ${(data.dailyLimit / 1000).toFixed(0)} KLD.`,
            'Implement water recycling or treatment-and-reuse systems.',
            'Contact the CGWA for a limit review if business requirements have changed.',
            'Log into the Aqua Affinity dashboard for detailed extraction reports.',
          ],
      y,
      accent,
    );

    pageFooter(doc, y + 16);
  });
}
