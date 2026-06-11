// ════════════════════════════════════════════════════════════════════════════
//  OnlyFast — shared Setup Sheet PDF builder
//  Builds a print-friendly HTML document for a saved setup, organized visually
//  around a car chassis diagram. Used by both ShareSetupModal (export your own
//  setup) and ViewSharedSetupModal (export a setup shared with you), so the
//  layout stays identical everywhere.
//
//  The user prints this window and chooses "Save as PDF" — no external deps.
// ════════════════════════════════════════════════════════════════════════════
import { getClassConfig, FieldDef } from '@/lib/classConfigs';

const ONLYFAST_LOGO = 'https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png';

// "Car Style A" — the default dirt-track chassis diagram (nose pointing UP).
export const CAR_STYLE_A = 'https://d64gsuwffb70l.cloudfront.net/69d2840337913981eed0ea87_1781129606987_8ea1dcb1.png';
// Stock-car (Pro Stock / Pure Stock) top-down chassis diagram, nose UP.
// LF/LR appear on the LEFT, RF/RR on the RIGHT (matches the corner layout).
export const CAR_STYLE_STOCK = 'https://d64gsuwffb70l.cloudfront.net/69d2840337913981eed0ea87_1781136270336_2325a0c7.png';
// Lightning Sprint open-wheel top-down chassis diagram, nose UP (no front wing).
export const CAR_STYLE_SPRINT = 'https://d64gsuwffb70l.cloudfront.net/69d2840337913981eed0ea87_1781137003306_3410cbbc.jpg';

export type CarStyle = 'A' | 'stock' | 'sprint' | 'none';

// Decide which chassis diagram to use for a given class.
export function getCarStyle(raceClass?: string | null): CarStyle {
  const name = (raceClass || '').trim().toLowerCase();
  // Pro Stock / Pure Stock use the stock-car diagram.
  if (name === 'pro stock' || name === 'pure stock') return 'stock';
  // Lightning Sprints use the dedicated sprint diagram.
  if (name.includes('lightning')) return 'sprint';
  // Any other sprint car class has no diagram yet.
  if (name.includes('sprint')) return 'none';
  return 'A';
}

// Map a car style to its diagram image URL (or null when no diagram).
// TEMP: every setup uses the stock-car diagram for now (it's the cleanest one).
function carStyleImage(_style: CarStyle): string | null {
  return CAR_STYLE_STOCK;
}

const esc = (v: any): string =>
  v === null || v === undefined ? '' :
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const has = (v: any): boolean =>
  v !== null && v !== undefined && String(v).trim() !== '';

// Pull the display value for a config field key off a (flat) setup row.
// Handles the special Toe (amount + direction) and legacy stagger keys.
function fieldValue(setup: any, key: string): string {
  if (key === 'toe') {
    const amt = setup.toe;
    const dir = setup.toe_direction;
    if (!has(amt)) return '';
    return has(dir) ? `${amt} ${dir === 'in' ? 'In' : dir === 'out' ? 'Out' : dir}` : String(amt);
  }
  // Front/Rear stagger: prefer the explicit modified keys, fall back to legacy
  // single `stagger` value so older saved setups still render something.
  if (key === 'front_stagger') {
    if (has(setup.front_stagger)) return String(setup.front_stagger);
    return '';
  }
  if (key === 'rear_stagger') {
    if (has(setup.rear_stagger)) return String(setup.rear_stagger);
    if (has(setup.stagger)) return String(setup.stagger);
    return '';
  }
  return has(setup[key]) ? String(setup[key]) : '';
}

// Build the rows for a list of FieldDefs against a corner prefix (or no prefix).
function rowsFor(setup: any, fields: FieldDef[], prefix = ''): Array<[string, string]> {
  return fields
    .map((f): [string, string] => {
      const key = prefix ? `${prefix}_${f.key}` : f.key;
      const val = prefix ? (has(setup[key]) ? String(setup[key]) : '') : fieldValue(setup, f.key);
      return [f.label, val];
    })
    .filter(([, v]) => has(v));
}

function miniTable(rows: Array<[string, string]>): string {
  if (!rows.length) return '<div class="empty">—</div>';
  return `<table>${rows
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('')}</table>`;
}

// Custom fields are stored as a { "Field name": "value" } jsonb object.
function customRows(setup: any): Array<[string, string]> {
  const cf = setup.custom_fields;
  if (!cf || typeof cf !== 'object') return [];
  return Object.entries(cf)
    .map(([k, v]): [string, string] => [k, v == null ? '' : String(v)])
    .filter(([, v]) => has(v));
}

export interface SetupPdfMeta {
  shareCode?: string;
}

// Build the full print HTML for a setup row.
export function buildSetupPdfHtml(setup: any, meta: SetupPdfMeta = {}): string {
  const config = getClassConfig(setup.race_class || '');
  const style = getCarStyle(setup.race_class);

  const setupTitle =
    setup.setup_name || setup.track_name || 'Race Setup';
  const sub = [
    setup.race_class,
    setup.track_name && setup.track_name !== setupTitle ? setup.track_name : null,
    setup.race_date,
  ].filter(has);

  const sessionLabel =
    setup.session_label ||
    (setup.setup_type === 'main' ? 'Main Event' :
     setup.setup_type === 'heat' ? 'Heat' :
     setup.setup_type === 'base' ? 'Hot Laps / Base' : '');

  // Four-corner data
  const lf = rowsFor(setup, config.frontCornerFields, 'lf');
  const rf = rowsFor(setup, config.frontCornerFields, 'rf');
  const lr = rowsFor(setup, config.rearCornerFields, 'lr');
  const rr = rowsFor(setup, config.rearCornerFields, 'rr');

  // General Chassis + Rear-End & Drivetrain (top-level keys)
  const general = rowsFor(setup, config.generalFields);
  const rearEnd = rowsFor(setup, config.suspensionFields);

  const custom = customRows(setup);
  const notes = has(setup.notes) ? String(setup.notes) : '';

  const cornerBox = (title: string, rows: Array<[string, string]>) => `
    <div class="corner">
      <div class="corner-title">${esc(title)}</div>
      ${miniTable(rows)}
    </div>`;

  const diagramSrc = carStyleImage(style);
  const carDiagram = diagramSrc
    ? `<div class="car"><img src="${diagramSrc}" alt="Chassis diagram" /></div>`
    : `<div class="car car-none"><div class="car-none-label">Chassis diagram<br/>coming soon</div></div>`;

  // Four-corner block — LF / RF across the top (front/nose), LR / RR across the
  // bottom (rear), with the nose-up car diagram in the middle column.
  const cornersBlock = `
    <section class="card">
      <h2>Four Corners</h2>
      <div class="corners">
        ${cornerBox('Left Front (LF)', lf)}
        ${carDiagram}
        ${cornerBox('Right Front (RF)', rf)}
        ${cornerBox('Left Rear (LR)', lr)}
        <div class="car-spacer"></div>
        ${cornerBox('Right Rear (RR)', rr)}
      </div>
    </section>`;

  const generalBlock = general.length
    ? `<section class="card"><h2>General Chassis</h2>${miniTable(general)}</section>` : '';
  const rearEndBlock = rearEnd.length
    ? `<section class="card"><h2>Rear End &amp; Drive Train</h2>${miniTable(rearEnd)}</section>` : '';
  // Extra class-specific sections (e.g. the Lightning Sprint "Wing" section).
  const extraBlocks = config.extraSections
    .map(section => {
      const rows = rowsFor(setup, section.fields);
      return rows.length
        ? `<section class="card"><h2>${esc(section.title)}</h2>${miniTable(rows)}</section>`
        : '';
    })
    .join('');
  const customBlock = custom.length
    ? `<section class="card page-2"><h2>Custom Fields</h2>${miniTable(custom)}</section>` : '';
  const notesBlock = notes
    ? `<section class="card page-2"><h2>Notes</h2><p class="notes">${esc(notes).replace(/\n/g, '<br/>')}</p></section>` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(setupTitle)} — OnlyFast Setup Sheet</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1A1B23; margin: 0; padding: 28px; background: #fff; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 2px solid #E5E7EB; }
  .header img { height: 54px; width: auto; }
  .header h1 { font-size: 22px; margin: 0; color: #1A1B23; }
  .header .sub { font-size: 12px; color: #6B7280; margin-top: 3px; }
  .badge { display: inline-block; background: #00A8E8; color: #fff; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-top: 6px; }
  .exported { font-size: 10px; color: #9CA3AF; text-align: right; white-space: nowrap; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #00A8E8; margin: 0 0 10px 0; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
  .card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #F0F0F2; }
  th { width: 55%; color: #6B7280; font-weight: 500; }
  td { color: #1A1B23; font-weight: 700; }
  .empty { font-size: 12px; color: #C0C4CC; padding: 4px 6px; }
  .corners { display: grid; grid-template-columns: 1fr 200px 1fr; grid-template-rows: 1fr 1fr; gap: 14px; align-items: start; }
  .corner { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 8px 10px; }
  .corner-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1A1B23; margin-bottom: 6px; }
  /* Diagram spans both corner rows and STRETCHES to full height so the drawn
     front wheels line up with LF/RF (top row) and rear wheels with LR/RR. */
  .car { grid-row: 1 / span 2; display: flex; align-items: stretch; justify-content: center; }
  .car img { width: 100%; height: 100%; max-height: 380px; object-fit: contain; }
  /* Drop the rear corner boxes to the bottom of their row to meet the rear wheels. */
  .corner:nth-child(4), .corner:nth-child(6) { align-self: end; }
  .car-spacer { grid-row: 2; }
  .car-none { border: 1px dashed #D1D5DB; border-radius: 12px; min-height: 220px; }
  .car-none-label { color: #9CA3AF; font-size: 12px; text-align: center; font-weight: 600; }
  .notes { font-size: 12px; line-height: 1.5; color: #1A1B23; margin: 0; white-space: pre-wrap; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; text-align: center; }
  .page-2 { page-break-inside: avoid; }
  @media print { body { padding: 14px; } }
  @media (max-width: 640px) { .corners { grid-template-columns: 1fr 1fr; } .car { grid-row: auto; grid-column: 1 / span 2; } .car-spacer { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <img src="${ONLYFAST_LOGO}" alt="OnlyFast" />
    <div style="flex:1;">
      <h1>${esc(setupTitle)}</h1>
      <div class="sub">${sub.map(esc).join(' · ')}</div>
      ${sessionLabel ? `<span class="badge">${esc(sessionLabel)}</span>` : ''}
    </div>
    <div class="exported">Exported<br/>${new Date().toLocaleDateString()}</div>
  </div>

  ${generalBlock}
  ${cornersBlock}
  ${rearEndBlock}
  ${extraBlocks}
  ${customBlock}
  ${notesBlock}

  <div class="footer">OnlyFast Setup Sheet${meta.shareCode ? ` · Share code: ${esc(meta.shareCode)}` : ''}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body>
</html>`;
}

// Open a new window with the print-friendly setup sheet and trigger printing.
export function openSetupPdf(setup: any, meta: SetupPdfMeta = {}): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false;
  w.document.open();
  w.document.write(buildSetupPdfHtml(setup, meta));
  w.document.close();
  return true;
}
