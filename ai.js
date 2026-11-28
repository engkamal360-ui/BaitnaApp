// On-device reading (no AI service, no internet, no tokens).
// Text recognition runs inside the phone with Tesseract (Arabic + English models shipped in the app under www/ocr/).
// Nothing in this file talks to a server; images never leave the device.
import { createWorker } from 'tesseract.js';

export const aiAvailable = true; // always available: it's local
let wP = null, idle = null;
const base = () => new URL('ocr/', location.href).href;
function worker() {
  clearTimeout(idle);
  if (!wP) {
    wP = createWorker(['ara', 'eng'], 1, { workerPath: base() + 'worker.min.js', corePath: base(), langPath: base() + 'lang', gzip: true, cacheMethod: 'none', workerBlobURL: false })
      .catch((e) => { wP = null; throw e; });
  }
  return wP;
}
const release = () => { clearTimeout(idle); idle = setTimeout(() => { const p = wP; wP = null; if (p) p.then((w) => w.terminate()).catch(() => {}); }, 60000); };

// grayscale + contrast stretch → noticeably better OCR on phone photos
function prep(dataUrl, maxSide = 1800) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data; let lo = 255, hi = 0;
      for (let i = 0; i < p.length; i += 4) { const v = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; p[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
      const r = Math.max(1, hi - lo); let sum = 0;
      for (let i = 0; i < p.length; i += 4) { const v = Math.max(0, Math.min(255, ((p[i] - lo) * 255) / r)); p[i] = v; sum += v; }
      const inv = sum / (p.length / 4) < 110; // dashboards: light digits on a dark screen → invert so text is dark on light
      for (let i = 0; i < p.length; i += 4) { const v = inv ? 255 - p[i] : p[i]; p[i] = p[i + 1] = p[i + 2] = v; }
      g.putImageData(d, 0, 0); res(c.toDataURL('image/png'));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}
async function ocr(dataUrl, params) {
  const w = await worker();
  try {
    await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', ...(params || {}) });
    const r = await w.recognize(await prep(dataUrl));
    return r.data;
  } finally { release(); }
}

// ---------- text helpers ----------
export const normDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
const SKIP = /(إجمالي|اجمالي|الاجمالى|الإجمالى|المجموع|مجموع|الصافي|صافي|المطلوب|total|subtotal|net|ضريبة|ضريبه|القيمة المضافة|vat|tax|خصم|discount|نقد|نقدي|كاش|cash|باقي|الباقي|change|visa|فيزا|mastercard|بطاقة|card|تاريخ|date|وقت|time|فاتورة|فاتوره|invoice|receipt|ايصال|إيصال|رقم|no\.|tel|هاتف|تليفون|كاشير|cashier|شكرا|شكراً|thank|عدد الأصناف|items|qty|الكمية|السعر|price|amount|المبلغ|مدفوع|paid|رصيد|balance|www|\.com|@)/i;
const TOTAL = /(إجمالي|اجمالي|الاجمالى|الإجمالى|المجموع|الصافي|المطلوب|net total|grand total|^total|total due)/i;
const nums = (line) => (normDigits(line).match(/\d+(?:[.,]\d{1,3})?/g) || []).map((x) => parseFloat(x.replace(',', '.'))).filter((n) => !isNaN(n));

export function parseReceiptText(text, knownNames) {
  const lines = normDigits(text).split(/\n+/).map((l) => l.replace(/[|_~`^*#=]+/g, ' ').replace(/\s+/g, ' ').trim()).filter((l) => l.length > 1);
  const known = (knownNames || []).filter(Boolean).sort((a, b) => b.length - a.length);
  let store = null, date = null, total = null; const items = [];
  const dm = normDigits(text).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dm) {
    let y, m, d; if (dm[1]) { y = +dm[1]; m = +dm[2]; d = +dm[3]; } else { d = +dm[4]; m = +dm[5]; y = +dm[6]; if (y < 100) y += 2000; }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000) date = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  for (const l of lines.slice(0, 4)) { const letters = (l.match(/[A-Za-z؀-ۿ]/g) || []).length; if (letters >= 3 && !SKIP.test(l) && nums(l).length === 0) { store = l.slice(0, 40); break; } }
  for (const l of lines) {
    const n = nums(l);
    if (TOTAL.test(l) && n.length) { total = Math.max(...n.filter((x) => x < 1e6)); continue; }
    if (SKIP.test(l) || !n.length) continue;
    const name = l.replace(/[\d.,:%\-+/\\()[\]{}xX×@]+/g, ' ').replace(/\b(EGP|LE|ج\.?م|جنيه|ج|kg|كجم|كيلو|gm|جم)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const nm2 = /[؀-ۿ]/.test(name) ? name.replace(/[A-Za-z<>]+/g, ' ').replace(/\s+/g, ' ').trim() : name; // OCR noise inside Arabic lines
    if ((nm2.match(/[A-Za-z؀-ۿ]/g) || []).length < 2) continue;
    const cand = n.filter((x) => x > 0 && x < 100000 && !(Number.isInteger(x) && x > 99999));
    if (!cand.length) continue;
    const price = Math.max(...cand);
    let qty = null;
    const qm = normDigits(l).match(/(\d+(?:\.\d+)?)\s*[xX×*]/) || normDigits(l).match(/[xX×*]\s*(\d+(?:\.\d+)?)/);
    if (qm) qty = parseFloat(qm[1]);
    else if (cand.length >= 2) { const small = cand.filter((x) => x !== price && x <= 20 && (Number.isInteger(x) || x % 0.25 === 0)); if (small.length) qty = small[0]; }
    const hit = known.find((k) => k.length > 1 && l.includes(k));
    items.push({ name: hit || nm2.slice(0, 40), qty, unit: null, price });
  }
  return { store, date, items, total };
}

export async function readReceipt(dataUrl, knownNames) {
  const d = await ocr(dataUrl, { tessedit_pageseg_mode: '4' });
  const r = parseReceiptText(d.text || '', knownNames);
  if (!r.items.length) throw new Error('nothing-read');
  return r;
}

// Odometer: digits only; prefer the longest number (the trip meter is shorter), and one not below the last reading.
export async function readOdometer(dataUrl, lastKm) {
  const a = await ocr(dataUrl, { tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '11' });
  let txt = a.text || '';
  if (!/\d{4,7}/.test(txt)) { const b = await ocr(dataUrl, { tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '6' }); txt += '\n' + (b.text || ''); }
  const toks = [];
  (normDigits(txt).match(/\d{3,}/g) || []).forEach((run) => { // letters like "ODO" can turn into extra zeros → also try the right-hand part
    if (run.length <= 8) toks.push(Number(run));
    for (let n = 4; n <= 7 && n < run.length; n++) toks.push(Number(run.slice(-n)));
  });
  if (!toks.length) return { km: null };
  let pool = toks;
  if (lastKm != null) { const ok = toks.filter((x) => x >= lastKm && x < lastKm + 50000); if (ok.length) pool = ok; }
  pool = [...new Set(pool)].filter((x) => x >= 100 && x < 2000000);
  if (!pool.length) return { km: null };
  pool.sort((a, b) => String(b).length - String(a).length || (lastKm != null ? Math.abs(a - lastKm) - Math.abs(b - lastKm) : b - a));
  return { km: pool[0] };
}
