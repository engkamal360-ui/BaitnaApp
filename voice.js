// Offline understanding of a spoken/typed command (used when the AI service is unavailable).
// Returns the same shape as AI.parseCommand: { actions: [...] }.

const AR_DIG = '٠١٢٣٤٥٦٧٨٩';
const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => AR_DIG.indexOf(d)).replace(/[إأآ]/g, 'ا');
const WORDN = { 'واحد': 1, 'واحدة': 1, 'اتنين': 2, 'اثنين': 2, 'تلاتة': 3, 'تلات': 3, 'ثلاثة': 3, 'ثلاث': 3, 'اربعة': 4, 'اربع': 4, 'خمسة': 5, 'خمس': 5,
  'ستة': 6, 'ست': 6, 'سبعة': 7, 'سبع': 7, 'تمانية': 8, 'تمنية': 8, 'ثمانية': 8, 'تسعة': 9, 'تسع': 9, 'عشرة': 10, 'عشر': 10, 'حداشر': 11, 'احدعشر': 11, 'اتناشر': 12, 'اثناعشر': 12, 'ربع': 15, 'نص': 30 };
const DAYS = [['الاحد', 'الأحد', 'حد'], ['الاتنين', 'الاثنين', 'اتنين'], ['التلات', 'الثلاثاء', 'التلاتاء'], ['الاربع', 'الاربعاء', 'الأربعاء'], ['الخميس'], ['الجمعة', 'الجمعه'], ['السبت']];
const MONTHS = [['يناير'], ['فبراير'], ['مارس'], ['ابريل', 'أبريل'], ['مايو'], ['يونيو'], ['يوليو'], ['اغسطس', 'أغسطس'], ['سبتمبر'], ['اكتوبر', 'أكتوبر'], ['نوفمبر'], ['ديسمبر']];
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hm = (h, m) => String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');

const RX = {
  timer: /(مؤقت|تايمر|منبه|ذكرني بعد|نبهني بعد)/,
  med: /(دوا|دواء|علاج|حباي|حبه|حبة|قرص|اقراص|شراب|برشام|كبسول|مضاد|نقط|بخاخ)/,
  appt: /(دكتور|دكتوره|دكتورة|د\.|طبيب|كشف|حجز|موعد|معاد|ميعاد|تطعيم|فاكسين|فاتورة|فاتوره|تجديد|قسط|اشتراك|اجتماع|مقابلة|مقابله|عيادة|عياده|تحليل|اشعة|أشعة|سونار|جلسة|جلسه|مدرسة|عزومة|فرح)/,
  when: /(النهارده|النهاردة|اليوم|بكرة|بكره|غدا|غداً|بعد بكرة|بعد بكره|بعد غد|يوم\s|الساعة|الساعه|الاسبوع الجاي|الشهر الجاي)/
};

function findDate(t, todayStr) {
  const today = new Date(todayStr + 'T00:00');
  const add = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  let m;
  if (/بعد (بكرة|بكره|غد)/.test(t)) return { date: add(2), rx: /بعد (بكرة|بكره|غد)/ };
  if (/(بكرة|بكره|غدا|غداً)/.test(t)) return { date: add(1), rx: /(بكرة|بكره|غداً|غدا)/ };
  if (/(النهارده|النهاردة|اليوم)/.test(t)) return { date: add(0), rx: /(النهارده|النهاردة|اليوم)/ };
  if ((m = t.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/))) {
    let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && d < today) d.setFullYear(y + 1);
    return { date: iso(d), rx: new RegExp(m[0].replace(/[\/\-]/g, '\\$&')) };
  }
  for (let i = 0; i < 12; i++) for (const n of MONTHS[i]) {
    const r = new RegExp('(\\d{1,2})\\s*(من\\s*)?(شهر\\s*)?' + n);
    if ((m = t.match(r))) { const d = new Date(today.getFullYear(), i, +m[1]); if (d < today) d.setFullYear(d.getFullYear() + 1); return { date: iso(d), rx: r }; }
  }
  for (let i = 0; i < 7; i++) for (const n of DAYS[i]) {
    const r = new RegExp('(يوم\\s*)?' + n + '(\\s*(الجاي|الجاية|القادم))?');
    if (t.includes(n)) { let diff = (i - today.getDay() + 7) % 7; if (diff === 0) diff = 7; if (/(الجاي|القادم)/.test(t) && diff < 3) diff += 7; return { date: add(diff), rx: r }; }
  }
  if ((m = t.match(/يوم\s*(\d{1,2})(?!\s*(ساع|دقي))/))) { const d = new Date(today.getFullYear(), today.getMonth(), +m[1]); if (d < today) d.setMonth(d.getMonth() + 1); return { date: iso(d), rx: /يوم\s*\d{1,2}/ }; }
  if (/الاسبوع الجاي/.test(t)) return { date: add(7), rx: /الاسبوع الجاي/ };
  return null;
}

function findTime(t) {
  const words = Object.keys(WORDN).join('|');
  const r = new RegExp('(?:الساعة|الساعه|ساعة)\\s*(\\d{1,2}|' + words + ')(?:\\s*[:\\.]\\s*(\\d{2}))?(\\s*(?:و\\s*نص|ونص|و\\s*ربع|وربع|الا\\s*ربع|إلا\\s*ربع|و\\s*\\d{1,2}\\s*دقيقة))?(\\s*(?:الصبح|صباحا|صباحاً|ص|الضهر|الظهر|العصر|المغرب|بالليل|مساء|مساءً|م|بليل)\\b)?');
  const m = t.match(r); if (!m) return null;
  let h = /^\d+$/.test(m[1]) ? +m[1] : WORDN[m[1]], mi = m[2] ? +m[2] : 0;
  const frac = m[3] || '';
  if (/نص/.test(frac)) mi = 30; else if (/الا|إلا/.test(frac)) { h -= 1; mi = 45; } else if (/ربع/.test(frac)) mi = 15; else if (/\d/.test(frac)) mi = +frac.match(/\d+/)[0];
  const per = (m[4] || '') + ' ' + t;
  if (h <= 12) {
    if (/(الصبح|صباحا|صباحاً|\sص\b)/.test(per)) { if (h === 12) h = 0; }
    else if (/(بالليل|بليل|مساء|المغرب|العصر|\sم\b)/.test(per)) { if (h < 12) h += 12; }
    else if (/(الضهر|الظهر)/.test(per)) { if (h < 6) h += 12; }
    else if (h < 8) h += 12;
  }
  return { time: hm(h % 24, mi), rx: m[0] };
}

function findWho(t, ctx) {
  for (const p of ctx.people) if (p.name && p.name.length > 1 && t.includes(p.name)) return p.id;
  if (/(ابني|ابنى|بنتي|بنتى|الولد|البنت|العيال|الطفل)/.test(t)) { const d = ctx.people.find((p) => p.dep); if (d) return d.id; }
  if (/(مراتي|زوجتي|جوزي|زوجي|المدام)/.test(t)) { const o = ctx.people.find((p) => !p.dep && p.id !== ctx.me && p.id !== 'home'); if (o) return o.id; }
  return null;
}

const FILLER = /^(عندي|عندنا|عنده|عندها|سجل|سجّل|سجلي|ضيف|اضف|أضف|ضيفلي|فكرني|افتكر|انا|أنا|محتاج|محتاجين|عايز|عايزين|لازم|في|فيه|و)\s+/;
const clean = (s) => { let x = s.trim(); for (let i = 0; i < 4; i++) x = x.replace(FILLER, ''); return x.replace(/\s{2,}/g, ' ').replace(/^(ب|ل|في)\s/, '').trim(); };

function medTimes(t) {
  let m;
  if ((m = t.match(/كل\s*(\d{1,2})\s*ساع/))) { const n = Math.max(1, Math.round(24 / +m[1])); return Array.from({ length: Math.min(n, 6) }, (_, i) => hm((8 + i * +m[1]) % 24, 0)); }
  if (/(3|تلات|ثلاث)\s*مرات/.test(t)) return ['08:00', '14:00', '20:00'];
  if (/(مرتين|2\s*مرات)/.test(t)) return ['09:00', '21:00'];
  const tm = findTime(t); if (tm) return [tm.time];
  if (/(بالليل|قبل النوم)/.test(t)) return ['22:00'];
  return ['09:00'];
}

export function shopFromPhrase(ph, guessCat) {
  const W = { 'نص': 0.5, 'نصف': 0.5, 'ربع': 0.25, 'واحد': 1, 'اتنين': 2, 'اثنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'اربعة': 4, 'خمسة': 5 };
  const UW = { 'كيلو': 'kg', 'كجم': 'kg', 'كيس': 'bag', 'اكياس': 'bag', 'علبة': 'box', 'علبه': 'box', 'علب': 'box', 'باكو': 'pack', 'عبوة': 'pack', 'زجاجة': 'bottle', 'ازازة': 'bottle', 'ازازه': 'bottle', 'طبق': 'tray', 'رغيف': 'loaf', 'جرام': 'g', 'لتر': 'l', 'قطعة': 'piece', 'حتة': 'piece' };
  let qty = null, unit = null; const rest = [];
  toLatin(ph).split(/\s+/).forEach((w) => { if (/^\d+(\.\d+)?$/.test(w)) qty = parseFloat(w); else if (W[w] != null && qty == null) qty = W[w]; else if (UW[w] && !unit) unit = UW[w]; else rest.push(w); });
  if (unit && qty == null) qty = 1;
  const name = clean(rest.join(' '));
  return { type: 'shop', name, qty, unit, cat: guessCat(name), note: null };
}

export function localCommand(text, ctx, guessCat) {
  const actions = [];
  const clauses = toLatin(text).split(/[،,\n؛]|\.\s|\s(?:وكمان|وبعدين|كمان)\s/).map((x) => x.trim()).filter(Boolean);
  let shopBuf = [];
  const flushShop = () => { shopBuf.forEach((ph) => ph.split(/\sو(?=\S)/).forEach((p) => { const a = shopFromPhrase(p, guessCat); if (a.name) actions.push(a); })); shopBuf = []; };
  clauses.forEach((c) => {
    let m;
    if (/(دفعت|دفعنا|دافع|اتدفع|سددت|paid)/.test(c) && (m = c.match(/(\d+(?:\.\d+)?)\s*(الف|ألف|آلاف|الاف)?/))) {
      flushShop();
      const amount = parseFloat(m[1]) * (m[2] ? 1000 : 1);
      const d = findDate(c, ctx.today);
      let name = c.replace(m[0], ' ').replace(/(دفعت|دفعنا|دافع|اتدفع|سددت|جنيه|جنية|ج\.م|ج)(?=\s|$)/g, ' '); if (d) name = name.replace(d.rx, ' ');
      actions.push({ type: 'exp', name: clean(name), amount, ecat: null, date: d ? d.date : ctx.today, who: findWho(c, ctx) }); return;
    }
    if (RX.timer.test(c) && (m = c.match(/(\d{1,3}|ربع|نص)\s*(دقيق|دقايق|د\b)/))) {
      flushShop();
      const mins = /^\d+$/.test(m[1]) ? +m[1] : WORDN[m[1]];
      const name = clean(c.replace(RX.timer, '').replace(m[0], '').replace(/(شغل|شغّل|ابدأ|ابدا|اعمل|اعملي|لـ|ل)\s*/g, '')) || 'مؤقت';
      actions.push({ type: 'timer', name, minutes: mins }); return;
    }
    if (RX.med.test(c) && /(كل|مرة|مرات|مرتين|الساعة|الساعه|يوميا|يومياً|بعد الاكل|قبل)/.test(c) && !/(دكتور|كشف|حجز)/.test(c)) {
      flushShop();
      const who = findWho(c, ctx);
      const name = clean(c.replace(/(^|\s)(اخد|آخد|ياخد|تاخد|باخد|هياخد|هتاخد|دوا|دواء|علاج|ابني|بنتي|مراتي|زوجتي|لابني|لبنتي|لمراتي)(?=\s|$)/g, ' ').replace(/كل\s*\d+\s*ساع\S*/, '').replace(/(مرتين|\d\s*مرات|تلات مرات|مرة)\s*(في اليوم|يوميا|يومياً)?/, '').replace(/(الساعة|الساعه)\s*\S+(\s*(الصبح|بالليل|مساء|صباحا))?/, ''));
      actions.push({ type: 'med', name: name || c, dose: null, times: medTimes(c), who }); return;
    }
    if (RX.appt.test(c) || RX.when.test(c)) {
      flushShop();
      const d = findDate(c, ctx.today), tm = findTime(c), who = findWho(c, ctx);
      let title = c; if (d) title = title.replace(d.rx, ' '); if (tm) title = title.replace(tm.rx, ' ');
      title = clean(title.replace(/(^|\s)(يوم|الساعة|الساعه|ان|إن|انه|إنه|الصبح|بالليل|بليل|مساء|مساءً|صباحا|صباحاً|العصر|المغرب|مراتي|زوجتي|جوزي|ابني|بنتي|عندها|عنده|عندي|عندنا)(?=\s|$)/g, ' '));
      const cat = /(تطعيم|فاكسين)/.test(c) ? 'vax' : /(فاتورة|فاتوره|تجديد|قسط|اشتراك)/.test(c) ? 'bill' : 'appt';
      actions.push({ type: 'appt', title: title || c, date: d ? d.date : null, time: tm ? tm.time : null, cat, who, note: null }); return;
    }
    shopBuf.push(c);
  });
  flushShop();
  return { actions };
}
