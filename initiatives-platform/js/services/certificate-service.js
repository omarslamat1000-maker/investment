// شهادة إنجاز المبادرة — تصميم فاخر باسم أمانة منطقة المدينة المنورة يُرسم على Canvas
// ويُنزَّل صورة PNG. بيانات القالب (الموقّع ونص التقدير) يعدلها مدير النظام فقط.
import { dataProvider } from '../data/data-provider.js';
import { fmtDate, fmtHijri, nowIso } from '../core/date-time.js';

export const CERT_TEMPLATE_ID = 'certificate-template';

export const DEFAULT_CERT_TEMPLATE = {
  id: CERT_TEMPLATE_ID,
  entityLine: 'أمانة منطقة المدينة المنورة',
  subEntityLine: 'منصة مبادرات البنية التحتية والشراكات المجتمعية',
  heading: 'شهادة شكر وتقدير',
  appreciationText: 'تتقدم أمانة منطقة المدينة المنورة بخالص الشكر والتقدير إلى',
  bodyText: 'نظير إسهامهم المتميز في تنفيذ المبادرة وما تحقق بها من أثر ملموس على جودة الحياة في المدينة المنورة، سائلين الله لهم دوام التوفيق والعطاء.',
  signatoryName: 'م. عبدالله الحربي',
  signatoryTitle: 'أمين منطقة المدينة المنورة'
};

export async function getCertTemplate() {
  const saved = await dataProvider.get('settings', CERT_TEMPLATE_ID);
  return { ...DEFAULT_CERT_TEMPLATE, ...(saved || {}) };
}

export async function saveCertTemplate(patch) {
  const current = await getCertTemplate();
  const record = { ...current, ...patch, id: CERT_TEMPLATE_ID };
  await dataProvider.put('settings', record);
  return record;
}

const W = 2000; const H = 1414; // نسبة A4 عرضية
const GREEN = '#073B2E'; const GREEN_DARK = '#052A20';
const GOLD = '#C9A227'; const GOLD_SOFT = '#E8D9A8';
const CREAM = '#FBF9F2';

function drawArch(ctx, x, y, w, h, stroke, lineWidth) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function fitText(ctx, text, maxWidth, baseSize, family, weight = 700) {
  let size = baseSize;
  do {
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 22);
  return size;
}

// رسم الشهادة كاملة على Canvas — تعيد عنصر canvas جاهزًا للعرض والتنزيل
export async function renderCertificateCanvas({ initiative, recipientNames, template }) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // الأرضية
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  // إطار خارجي أخضر عميق
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, 46); ctx.fillRect(0, H - 46, W, 46);
  ctx.fillRect(0, 0, 46, H); ctx.fillRect(W - 46, 0, 46, H);
  // إطار ذهبي مزدوج
  ctx.strokeStyle = GOLD; ctx.lineWidth = 6;
  ctx.strokeRect(78, 78, W - 156, H - 156);
  ctx.strokeStyle = GOLD_SOFT; ctx.lineWidth = 2;
  ctx.strokeRect(96, 96, W - 192, H - 192);

  // زخرفة أقواس علوية وسفلية (هوية المنصة)
  const archW = 64; const archH = 76; const gap = 26;
  const rowCount = 9;
  const totalW = rowCount * archW + (rowCount - 1) * gap;
  let startX = (W - totalW) / 2;
  for (let i = 0; i < rowCount; i++) {
    const emphasized = i === Math.floor(rowCount / 2);
    drawArch(ctx, startX + i * (archW + gap), 122, archW, archH, emphasized ? GOLD : GOLD_SOFT, emphasized ? 7 : 4);
  }
  for (let i = 0; i < rowCount; i++) {
    drawArch(ctx, startX + i * (archW + gap), H - 210, archW, archH, i === Math.floor(rowCount / 2) ? GOLD : GOLD_SOFT, i === Math.floor(rowCount / 2) ? 7 : 4);
  }

  // زوايا زخرفية
  ctx.strokeStyle = GOLD; ctx.lineWidth = 5;
  const c = 150; const off = 120;
  for (const [cx, cy, dx, dy] of [[off, off, 1, 1], [W - off, off, -1, 1], [off, H - off, 1, -1], [W - off, H - off, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * c, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * c);
    ctx.stroke();
  }

  // النصوص
  const kufi = 'Noto Kufi Arabic'; const plex = 'IBM Plex Sans Arabic';
  ctx.fillStyle = GREEN;
  ctx.font = `700 44px "${kufi}", sans-serif`;
  ctx.fillText(template.entityLine, W / 2, 300);
  ctx.fillStyle = '#5B6E66';
  ctx.font = `400 30px "${plex}", sans-serif`;
  ctx.fillText(template.subEntityLine, W / 2, 352);

  // العنوان
  ctx.fillStyle = GOLD;
  ctx.font = `700 110px "${kufi}", sans-serif`;
  ctx.fillText(template.heading, W / 2, 510);
  // خط فاصل ذهبي
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2 - 300, 552); ctx.lineTo(W / 2 + 300, 552); ctx.stroke();

  ctx.fillStyle = '#3C4F47';
  ctx.font = `400 38px "${plex}", sans-serif`;
  ctx.fillText(template.appreciationText, W / 2, 646);

  // اسم المكرَّم
  const recipient = recipientNames.join(' و ');
  ctx.fillStyle = GREEN_DARK;
  const rSize = fitText(ctx, recipient, W - 500, 84, kufi);
  ctx.font = `700 ${rSize}px "${kufi}", sans-serif`;
  ctx.fillText(recipient, W / 2, 748);

  // اسم المبادرة
  ctx.fillStyle = '#3C4F47';
  ctx.font = `400 34px "${plex}", sans-serif`;
  ctx.fillText('وذلك لإسهامهم في إنجاح مبادرة', W / 2, 826);
  ctx.fillStyle = GREEN;
  const tSize = fitText(ctx, `«${initiative.title}»`, W - 460, 56, kufi);
  ctx.font = `700 ${tSize}px "${kufi}", sans-serif`;
  ctx.fillText(`«${initiative.title}»`, W / 2, 900);

  // نص التقدير
  ctx.fillStyle = '#5B6E66';
  ctx.font = `400 30px "${plex}", sans-serif`;
  wrapText(ctx, template.bodyText, W / 2, 968, W - 620, 46);

  // التاريخ والتوقيع والمعرف
  const dateLine = `${fmtHijri(nowIso())} — ${fmtDate(nowIso())}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#3C4F47';
  ctx.font = `700 30px "${plex}", sans-serif`;
  ctx.fillText('التاريخ', W - 300, 1150);
  ctx.font = `400 28px "${plex}", sans-serif`;
  ctx.fillText(dateLine, W - 300, 1196);

  ctx.textAlign = 'left';
  ctx.font = `700 30px "${plex}", sans-serif`;
  ctx.fillText(template.signatoryTitle, 300, 1150);
  ctx.font = `700 36px "${kufi}", sans-serif`;
  ctx.fillStyle = GREEN;
  ctx.fillText(template.signatoryName, 300, 1200);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8AA096';
  ctx.font = `400 22px "${plex}", sans-serif`;
  ctx.fillText(`رقم المبادرة: ${initiative.id}`, W / 2, H - 116);

  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = probe;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

export function downloadCanvasPng(canvas, fileName) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = fileName;
  a.click();
}
