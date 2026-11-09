/**
 * vocalPaperPrintHelper.ts
 * Moteur d'impression A4 100 % Noir & Blanc sans pop-up (iframe invisible),
 * repères d'angle optiques ■ (fiducials) et cartouche de code de feuille (< 125 lignes).
 */
import type { VocalSheetOpticalCode } from '../../types/vocalPaperWorkshop.types';

export function renderFiducialCornersHTML(): string {
  const base = 'position:absolute;width:6.5mm;height:6.5mm;background:#000;color:#fff;font-size:7pt;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:20;';
  return `
    <div class="fiducial-tl" style="${base}top:1.5mm;left:1.5mm;">■</div>
    <div class="fiducial-tr" style="${base}top:1.5mm;right:1.5mm;">■</div>
    <div class="fiducial-bl" style="${base}bottom:1.5mm;left:1.5mm;">■</div>
    <div class="fiducial-br" style="${base}bottom:1.5mm;right:1.5mm;">■</div>
  `;
}

export function renderOpticalSheetCodeBadge(code: VocalSheetOpticalCode): string {
  return `<span class="optical-sheet-code" style="display:inline-block;border:2px solid #000;padding:1px 6px;font-family:monospace;font-size:8.5pt;font-weight:900;letter-spacing:0.5px;background:#fff;color:#000;">[CODE: ${code}]</span>`;
}

export function renderBwCheckbox(checked: boolean, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:8pt;font-weight:700;white-space:nowrap;">
    <span style="display:inline-block;width:10px;height:10px;border:1.5px solid #000;background:${checked ? '#000' : '#fff'};"></span>
    <span>${label}</span>
  </span>`;
}

export function wrapVocalSheetA4Document(
  innerPageHtml: string,
  orientation: 'portrait' | 'landscape',
  title = 'Atelier Papier du Chant — O Girador'
): string {
  const maxW = orientation === 'landscape' ? '281mm' : '194mm';
  const pageH = orientation === 'landscape' ? 'calc(210mm - 14mm)' : 'calc(297mm - 14mm)';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 7mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .vocal-sheet-page {
      position: relative;
      width: 100%;
      max-width: ${maxW};
      height: ${pageH};
      max-height: ${pageH};
      margin: 0 auto;
      padding: 6.5mm 8mm;
      border: 2px solid #000;
      background: #fff;
      color: #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hatch-bw {
      background-image: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 1px, #fff 3.5px) !important;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 0; text-align: center; vertical-align: middle; color: #000; }
    .beat-sep-right { border-right: 2.2px solid #000 !important; }
    .measure-sep-right { border-right: 3px double #000 !important; }
    .strong-row-top { border-top: 2px solid #000 !important; }
    @media print {
      html, body { width: 100% !important; height: 100% !important; overflow: hidden !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${innerPageHtml}
</body>
</html>`;
}

export function printViaInvisibleIframe(htmlContent: string, _title = 'Atelier Papier du Chant'): void {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
    return;
  }
  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    }
  }, 250);
}
