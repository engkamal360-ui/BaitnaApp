// بيتنا — Car, home maintenance, warranties, contacts (tab "البيت"), family health profile & measurements, monthly report.
// PRIVACY: nothing here is ever sent to AI.

const DAY = 86400000;
// Arabic counted nouns: 1 → one, 2 → two, 3–10 → few, 11+ → many
const arCount = (n, num, one, two, few, many) => n === 1 ? one : n === 2 ? two : num(n) + ' ' + (n >= 3 && n <= 10 ? few : many);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addMonths = (isoD, m) => { const d = new Date(isoD + 'T00:00'); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + m); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / DAY);
const toNum = (v) => { const x = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،]/g, '')); return isNaN(x) ? null : x; };

// Car maintenance presets: [key, ar, en, everyKm, everyMonths]
export const CAR_PRESETS = [
  ['oil', 'تغيير الزيت والفلتر', 'Oil & filter change', 5000, 6],
  ['air', 'فلتر الهواء', 'Air filter', 10000, 12],
  ['tires', 'ترصيص وضبط زوايا', 'Wheel balance & alignment', 10000, 12],
  ['brakes', 'فحص الفرامل', 'Brake check', 20000, 12],
  ['coolant', 'مياه الردياتير', 'Coolant', 40000, 24],
  ['battery', 'فحص البطارية', 'Battery check', null, 12]
];
export const HOME_PRESETS = [
  ['acf', 'تنظيف فلتر التكييف', 'Clean AC filter', 3],
  ['acs', 'صيانة التكييف الدورية', 'AC service', 12],
  ['water', 'تغيير شمعات فلتر المياه', 'Water filter cartridges', 6],
  ['heater', 'صيانة السخان', 'Water heater service', 12],
  ['tank', 'تنظيف خزان المياه', 'Clean water tank', 6],
  ['pest', 'رش الحشرات', 'Pest control', 6],
  ['gas', 'فحص وصلات الغاز', 'Gas line check', 12]
];
const ROLES = [['plumber', 'سباك', 'Plumber'], ['elec', 'كهربائي', 'Electrician'], ['ac', 'فني تكييف', 'AC technician'], ['appl', 'فني أجهزة', 'Appliance repair'], ['carp', 'نجار', 'Carpenter'],
  ['paint', 'نقاش', 'Painter'], ['door', 'البواب', 'Doorman'],
  ['mech', 'ميكانيكي', 'Mechanic'], ['carelec', 'كهربائي سيارات', 'Car electrician'], ['tires', 'كاوتش وبطاريات', 'Tyres & batteries'], ['wash', 'مغسلة سيارات', 'Car wash'], ['carins', 'تأمين ووكيل السيارة', 'Car insurance & dealer'],
  ['doc', 'دكتور', 'Doctor'], ['pharm', 'صيدلية', 'Pharmacy'], ['deliv', 'توصيل طلبات', 'Delivery'], ['other', 'أخرى', 'Other']];
export const FUEL_TYPES = [['b80', 'بنزين ٨٠', 'Petrol 80'], ['b92', 'بنزين ٩٢', 'Petrol 92'], ['b95', 'بنزين ٩٥', 'Petrol 95'], ['diesel', 'سولار', 'Diesel'], ['cng', 'غاز طبيعي', 'CNG'], ['hybrid', 'هايبرد', 'Hybrid'], ['ev', 'كهرباء', 'Electric']];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// Measurement types: [key, ar, en, unit]
const MT = [['bp', 'الضغط', 'Blood pressure', 'mmHg'], ['sugar', 'السكر', 'Blood sugar', 'mg/dL'], ['weight', 'الوزن', 'Weight', 'kg'], ['height', 'الطول', 'Height', 'cm'], ['temp', 'الحرارة', 'Temperature', '°C']];
// Egypt mandatory infant schedule (MoHP) as an editable starting template — always check the child's vaccination card.
export const VAX_TEMPLATE = [
  [0, 'الالتهاب الكبدي B (جرعة الولادة) + شلل الأطفال (الجرعة الصفرية)'], [1, 'الدرن (BCG)'],
  [2, 'شلل الأطفال + الخماسي/السداسي (الجرعة ١)'], [4, 'شلل الأطفال + الخماسي/السداسي (الجرعة ٢)'], [6, 'شلل الأطفال + الخماسي/السداسي (الجرعة ٣)'],
  [9, 'شلل الأطفال (جرعة ٤) + فيتامين أ'], [12, 'الحصبة والنكاف والحصبة الألمانية (MMR ١) + شلل الأطفال'], [18, 'MMR ٢ + الثلاثي المنشط + شلل الأطفال + فيتامين أ']
];

// ---------- monthly due logic ----------
// Fuel economy by the "full tank to full tank" method. Partial fills are added to the next full fill.
export function fuelAnalysis(fills) {
  const withKm = fills.filter((f) => f.km != null && f.liters).slice().sort((a, b) => a.km - b.km || (a.d || '').localeCompare(b.d || ''));
  const segs = []; let base = null, acc = 0, accCost = 0;
  withKm.forEach((f) => {
    const full = f.full !== false;
    if (base == null) { if (full) { base = f; acc = 0; accCost = 0; } return; }
    acc += Number(f.liters); accCost += Number(f.price || 0);
    if (!full) return;
    const dist = f.km - base.km;
    if (dist > 20 && acc > 0) segs.push({ d: f.d, from: base.km, to: f.km, dist, liters: acc, cost: accCost, kmpl: dist / acc, id: f.id });
    base = f; acc = 0; accCost = 0;
  });
  const last = segs[segs.length - 1] || null;
  const ref = segs.length >= 3 ? segs.slice(-7, -1) : segs;
  const sum = (a, k) => a.reduce((x, s) => x + s[k], 0);
  const avg = ref.length ? sum(ref, 'dist') / sum(ref, 'liters') : null;
  const all = segs.length ? sum(segs, 'dist') / sum(segs, 'liters') : null;
  const costKm = segs.length && sum(segs, 'cost') ? sum(segs, 'cost') / sum(segs, 'dist') : null;
  let flag = null;
  if (last && avg && segs.length >= 3) {
    const ch = (last.kmpl - avg) / avg;
    if (ch <= -0.15) flag = { kind: 'bad', pct: Math.round(-ch * 100), twice: segs.length >= 4 && segs[segs.length - 2].kmpl < avg * 0.9 };
    else if (ch >= 0.25) flag = { kind: 'odd', pct: Math.round(ch * 100) };
  }
  return { segs, last, avg, all, costKm, flag };
}
export function maintDueList(s) {
  const today = iso(new Date()), out = [];
  (s.maint || []).forEach((m) => {
    const car = m.carId ? (s.cars || []).find((c) => c.id === m.carId) : null;
    if (m.carId && !car) return;
    const st = maintStatus(m, car, today);
    if (!st.estDate) return;
    out.push({ m, car, d: st.estDate < today ? today : st.estDate, est: st.byKm, level: st.level, kmLeft: st.kmLeft });
  });
  return out;
}
function maintStatus(m, car, today) {
  // returns { nextDate, kmLeft, daysLeft, pct, level } level: ok | soon | due
  let nextDate = null, daysLeft = null, kmLeft = null, pct = 0;
  if (m.everyMonths && m.lastDate) { nextDate = addMonths(m.lastDate, m.everyMonths); daysLeft = daysBetween(today, nextDate); pct = Math.max(pct, 1 - daysLeft / (m.everyMonths * 30.4)); }
  if (m.everyKm && car && car.km != null && m.lastKm != null) { kmLeft = m.lastKm + m.everyKm - car.km; pct = Math.max(pct, 1 - kmLeft / m.everyKm); }
  // km limits can't be turned into dates (driving isn't regular) — when the km limit is already reached, it's due today
  const kmReached = kmLeft != null && kmLeft <= 0;
  const estDate = kmReached ? today : nextDate;
  const byKm = kmReached && (!nextDate || nextDate > today);
  const due = (daysLeft != null && daysLeft <= 0) || (kmLeft != null && kmLeft <= 0);
  const soon = !due && ((daysLeft != null && daysLeft <= 14) || (kmLeft != null && kmLeft <= Math.min(500, (m.everyKm || 0) * 0.1)));
  const never = !m.lastDate && m.lastKm == null;
  return { nextDate, daysLeft, kmLeft, estDate, byKm, pct: Math.min(1, Math.max(0, pct)), level: never ? 'new' : due ? 'due' : soon ? 'soon' : 'ok' };
}

// ---------- reminders (called from syncNotes) ----------
let h_extraFor = null;
export function setExtraFor(fn) { h_extraFor = fn; }
export function extraReminders(s, ar, isHid) {
  const hid = isHid || (() => false);
  const out = [], today = iso(new Date());
  const at10 = (d) => new Date(d + 'T10:00').getTime();
  (s.maint || []).forEach((m) => {
    if (hid(m.carId ? 'home.car' : 'home.maint')) return;
    const car = m.carId ? (s.cars || []).find((c) => c.id === m.carId) : null;
    const st = maintStatus(m, car, today);
    if (!st.estDate) return;
    const name = (car ? (car.name + ': ') : '') + m.name + (st.byKm ? (ar ? ' — وصلت للكيلومترات' : ' — mileage reached') : '');
    if (m.rem && m.rem.length && h_extraFor) out.push(...h_extraFor(m.rem, at10(st.estDate), name, ar));
    [3, 0].forEach((k) => { const t = at10(st.estDate) - k * DAY; if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: (k ? (ar ? 'بعد ٣ أيام: ' : 'In 3 days: ') : (ar ? 'موعد صيانة: ' : 'Maintenance due: ')) + name, body: ar ? 'افتح «البيت» وسجّلها عند الانتهاء' : 'Open “Home” and log it when done' }); });
  });
  (hid('home.car') ? [] : (s.cars || [])).forEach((car) => [['licenseEnd', ar ? 'رخصة ' : 'Licence: '], ['insuranceEnd', ar ? 'تأمين ' : 'Insurance: ']].forEach(([k, lbl]) => {
    if (!car[k]) return; [30, 7, 0].forEach((n) => { const t = at10(car[k]) - n * DAY; if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: lbl + car.name + (n ? (ar ? ' — تنتهي بعد ' + n + ' يوم' : ' — ends in ' + n + ' days') : (ar ? ' — تنتهي اليوم' : ' — ends today')), body: ar ? 'جدّدها في الموعد' : 'Renew on time' }); });
  }));
  (hid('home.car') ? [] : (s.cars || [])).forEach((car) => {
    if (!(s.maint || []).some((m) => m.carId === car.id && m.everyKm)) return;
    const base = car.kmAt ? new Date(car.kmAt + 'T19:00').getTime() + 30 * DAY : Date.now() + DAY;
    const t = Math.max(base, Date.now() + 3600000);
    out.push({ at: t, channel: 'reminders', title: (ar ? 'صوّر عداد ' : 'Snap the odometer: ') + car.name, body: ar ? 'افتح «البيت» ← تحديث العداد، عشان نتابع مواعيد الصيانة بالكيلومترات' : 'Open Home → update odometer to keep mileage-based service on track' });
  });
  (hid('home.warranty') ? [] : (s.warranty || [])).forEach((w) => {
    if (!w.end) return; if (w.rem && w.rem.length && h_extraFor) out.push(...h_extraFor(w.rem, at10(w.end), (ar ? 'ضمان ' : 'Warranty: ') + w.name, ar)); const t = at10(w.end) - 30 * DAY;
    if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: (ar ? 'الضمان ينتهي بعد شهر: ' : 'Warranty ends in a month: ') + w.name, body: ar ? 'لو فيه عطل، استخدم الضمان قبل انتهائه' : 'Use it before it ends if anything is wrong' });
  });
  (hid('sched.health') ? [] : (s.health || [])).forEach((h) => (h.vax || []).forEach((v) => {
    if (v.done || !v.due) return; [7, 0].forEach((k) => { const t = at10(v.due) - k * DAY; if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: (ar ? 'تطعيم: ' : 'Vaccine: ') + v.name, body: (k ? (ar ? 'بعد أسبوع' : 'In a week') : (ar ? 'اليوم' : 'Today')) }); });
  }));
  return out;
}

// ======================================================================
// update odometer
const withKm = (car, km, d) => ({ ...car, km, kmAt: d });
export function homeVals(c, h) {
  const { s, L, num, money, isAr, WHO, PIDS, myId, pCls, longDateS, readImage } = h;
  const today = iso(new Date());
  const set = (o) => c.setState(o);
  const hf = s.hf || {};
  const setHf = (o) => c.setState({ hf: { ...c.state.hf, ...o } });
  const openHf = (sheet, f) => set({ sheet, hf: f });
  const seg = s.homeSeg || 'chores';
  const nm = (v) => (typeof v === 'object' && v ? (isAr ? v.ar : v.en) : v) || '';
  const fmtKm = (k) => (k == null ? '—' : L(num(Math.round(k).toLocaleString('en-US')) + ' كم', Math.round(k).toLocaleString('en-US') + ' km'));
  const days = (n) => arCount(n, num, 'يوم واحد', 'يومين', 'أيام', 'يوماً'), months = (n) => arCount(n, num, 'شهر واحد', 'شهرين', 'أشهر', 'شهراً');
  const dLeftTxt = (d) => d == null ? '' : d < 0 ? L('متأخر ' + days(-d), (-d) + ' days late') : d === 0 ? L('اليوم', 'Today') : d < 31 ? L('بعد ' + days(d), 'in ' + d + ' days') : L('بعد ' + months(Math.round(d / 30.4)), 'in ' + Math.round(d / 30.4) + ' months');
  const expEntry = (text, price, ecat, extra) => {
    const me = c.myId();
    return { id: 'e' + Date.now() + Math.floor(Math.random() * 99), kind: 'exp', text, price, ecat, d: extra && extra.d ? extra.d : today, at: Date.now(), by: me, who: me, shared: true, ...(extra || {}) };
  };

  // ---------------- segments ----------------
  const homeSegs = [['chores', L('المهام', 'Tasks')], ['car', L('العربية', 'Car')], ['maint', L('صيانة البيت', 'Home')], ['warranty', L('الضمانات', 'Warranties')], ['contacts', L('أرقام مهمة', 'Contacts')]]
    .filter(([k]) => !h.isHid('home.' + k)).map(([k, n]) => ({ name: n, cls: seg === k ? 'tab tab-on' : 'tab', sel: () => set({ homeSeg: k }) }));

  // ---------------- maintenance rows ----------------
  const mkMaint = (m, car) => {
    const st = maintStatus(m, car, today);
    const parts = [];
    if (st.kmLeft != null) parts.push(st.kmLeft <= 0 ? L('تجاوز بـ ' + fmtKm(-st.kmLeft), 'over by ' + fmtKm(-st.kmLeft)) : L('باقي ', '') + fmtKm(st.kmLeft) + L('', ' left'));
    if (st.daysLeft != null) parts.push(dLeftTxt(st.daysLeft));
    const every = [m.everyKm ? L('كل ' + fmtKm(m.everyKm), 'every ' + fmtKm(m.everyKm)) : '', m.everyMonths ? L('كل ' + (m.everyMonths === 1 ? 'شهر' : months(m.everyMonths)), 'every ' + m.everyMonths + ' months') : ''].filter(Boolean).join(L(' أو ', ' or '));
    return {
      id: m.id, name: m.name, every,
      status: st.level === 'new' ? L('لم تُسجَّل بعد — سجّل آخر مرة', 'Not logged yet — log the last time') : parts.join(L(' · ', ' · ')),
      last: m.lastDate ? L('آخر مرة: ', 'Last: ') + longDateS(m.lastDate) + (m.lastKm != null ? ' · ' + fmtKm(m.lastKm) : '') : '',
      hasLast: !!m.lastDate, pct: Math.round(st.pct * 100), barCls: 'mbar mbar-' + st.level, stCls: 'mst mst-' + st.level,
      done: () => openHf('service', { mid: m.id, carId: m.carId || null, name: m.name, d: today, km: car && car.km != null ? String(car.km) : '', cost: '', note: '' }),
      edit: () => openHf('maintF', { id: m.id, carId: m.carId || null, name: m.name, everyKm: m.everyKm ? String(m.everyKm) : '', everyMonths: m.everyMonths ? String(m.everyMonths) : '', lastDate: m.lastDate || '', lastKm: m.lastKm != null ? String(m.lastKm) : '', rem: m.rem || [] })
    };
  };

  // ---------------- cars ----------------
  const fuelOf = (carId) => (s.log || []).filter((l) => l.kind === 'exp' && l.fuel && l.carId === carId).sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.km || 0) - (b.km || 0));
  const carDocs = (car) => (s.cards || []).filter((k) => /سيار|عربي|مركب|car|vehicle/i.test(k.type || '') || (car.plate && (k.num || '').replace(/\s/g, '') === car.plate.replace(/\s/g, '')));
  const cars = (s.cars || []).map((car) => {
    const fuel = fuelOf(car.id);
    // consumption: km per litre between full fills with km recorded
    const fa = fuelAnalysis(fuel); const kmPerL = fa.all;
    const kmpl = (v) => v == null ? '—' : L(num(v.toFixed(1)) + ' كم/لتر', v.toFixed(1) + ' km/L');
    const l100 = (v) => v ? L(num((100 / v).toFixed(1)) + ' لتر/١٠٠ كم', (100 / v).toFixed(1) + ' L/100km') : '';
    const lastSegs = fa.segs.slice(-8);
    const maxK = Math.max(1, ...lastSegs.map((x) => x.kmpl), fa.avg || 0);
    const bars = lastSegs.map((x, i) => { const hgt = Math.round(x.kmpl / maxK * 64); const bad = fa.avg && x.kmpl < fa.avg * 0.85;
      return { x: (i * (300 / Math.max(lastSegs.length, 1)) + 6).toFixed(1), w: (300 / Math.max(lastSegs.length, 1) - 12).toFixed(1), y: 70 - hgt, h: hgt, fill: bad ? 'var(--warn)' : 'var(--acc)', lbl: num(x.kmpl.toFixed(1)), lx: (i * (300 / Math.max(lastSegs.length, 1)) + 300 / Math.max(lastSegs.length, 1) / 2).toFixed(1), ly: Math.max(10, 66 - hgt) }; });
    const avgY = fa.avg ? (70 - Math.round(fa.avg / maxK * 64)) : null;
    const carMaint = (s.maint || []).filter((m) => m.carId === car.id);
    const stOf = (key) => { const m = carMaint.find((x) => x.preset === key); if (!m) return null; const st = maintStatus(m, car, today); return { m, st }; };
    const causes = fa.flag && fa.flag.kind === 'bad' ? [
      { t: L('ضغط الإطارات — قِسه عند أقرب بنزينة (الضغط المكتوب على باب السائق)', 'Tyre pressure — check it (value on the driver’s door)'), hot: false },
      (() => { const a = stOf('air'); return { t: L('فلتر الهواء', 'Air filter') + (a ? (a.st.level === 'due' ? L(' — متأخر عن موعده ⚠️', ' — overdue ⚠️') : a.st.level === 'new' ? L(' — لم يُسجَّل آخر تغيير', ' — never logged') : '') : ''), hot: !!a && a.st.level === 'due' }; })(),
      (() => { const o = stOf('oil'); return { t: L('الزيت', 'Engine oil') + (o && o.st.level === 'due' ? L(' — حان موعد تغييره ⚠️', ' — due ⚠️') : ''), hot: !!o && o.st.level === 'due' }; })(),
      { t: L('البواجي (شمعات الاحتراق) وحساس الأكسجين — لو الزيادة مستمرة', 'Spark plugs / O2 sensor — if it persists'), hot: !!fa.flag.twice },
      { t: L('زحمة أو تكييف أكثر أو مشاوير قصيرة — طبيعي يرفع الاستهلاك', 'Traffic, more A/C or short trips — normal causes'), hot: false }
    ] : [];
    const fuelHist = fuel.slice().reverse().slice(0, 6).map((f) => { const sg = fa.segs.find((x) => x.id === f.id);
      return { d: longDateS(f.d), sub: [f.liters ? L(num(f.liters) + ' لتر', f.liters + ' L') : '', f.km ? fmtKm(f.km) : '', f.liters && f.price ? L(num((f.price / f.liters).toFixed(2)) + ' ج/لتر', (f.price / f.liters).toFixed(2) + '/L') : '', f.full === false ? L('تفويلة جزئية', 'partial') : ''].filter(Boolean).join(' · '),
        amt: money(f.price), kmpl: sg ? kmpl(sg.kmpl) : '', hasK: !!sg, kCls: sg && fa.avg && sg.kmpl < fa.avg * 0.85 ? 'kchip kchip-bad' : 'kchip',
        del: () => { if (window.confirm(L('حذف هذه التفويلة؟', 'Delete this fill-up?'))) c.setState({ log: c.state.log.filter((x) => x.id !== f.id) }); } }; });
    const fuelA = {
      has: fa.segs.length > 0, need: fa.segs.length === 0,
      needTxt: fuel.filter((f) => f.km != null && f.liters).length ? L('سجّل تفويلة كاملة أخرى بالعداد واللترات ليظهر أول حساب للاستهلاك', 'One more full fill-up with km & litres to get the first result') : L('مع كل تفويلة: صوّر العداد واكتب اللترات، واملأ التانك للآخر لأدق نتيجة', 'Each fill-up: snap the odometer, enter litres and fill the tank for best accuracy'),
      last: fa.last ? kmpl(fa.last.kmpl) : '—', lastL100: fa.last ? l100(fa.last.kmpl) : '', avg: kmpl(fa.avg), segsN: num(fa.segs.length),
      lastDist: fa.last ? fmtKm(fa.last.dist) : '', costKm: fa.costKm ? L(num(fa.costKm.toFixed(2)) + ' ج.م/كم', fa.costKm.toFixed(2) + ' EGP/km') : '—',
      bars, hasAvgLine: avgY != null, avgY,
      flagBad: !!(fa.flag && fa.flag.kind === 'bad'), flagOdd: !!(fa.flag && fa.flag.kind === 'odd'), flagOk: !!(fa.segs.length >= 3 && !fa.flag),
      flagTxt: fa.flag ? (fa.flag.kind === 'bad' ? L('آخر تفويلة استهلكت أكثر من متوسطك بـ ' + num(fa.flag.pct) + '٪' + (fa.flag.twice ? ' — وللمرة الثانية على التوالي' : ''), 'Last tank used ' + fa.flag.pct + '% more than your average' + (fa.flag.twice ? ' — second time in a row' : '')) : L('الاستهلاك أفضل من المعتاد بـ ' + num(fa.flag.pct) + '٪ — غالباً التانك لم يمتلئ للآخر في التفويلة السابقة', 'Unusually good (+' + fa.flag.pct + '%) — the previous fill probably wasn’t full')) : '',
      okTxt: L('الاستهلاك مستقر وقريب من متوسطك 👍', 'Consumption is steady and close to your average 👍'),
      causes, hasCauses: causes.length > 0, hist: fuelHist, hasHist: fuelHist.length > 0
    };
    const ym = today.slice(0, 7);
    const fuelMonth = fuel.filter((f) => (f.d || '').slice(0, 7) === ym).reduce((x, f) => x + Number(f.price), 0);
    const servMonth = (s.log || []).filter((l) => l.kind === 'exp' && l.carId === car.id && !l.fuel && (l.d || '').slice(0, 7) === ym).reduce((x, f) => x + Number(f.price), 0);
    const items = (s.maint || []).filter((m) => m.carId === car.id).map((m) => mkMaint(m, car));
    const urgent = items.filter((i) => /due|soon/.test(i.stCls)).length;
    const history = (s.log || []).filter((l) => (l.kind === 'maint' && l.carId === car.id) || (l.kind === 'exp' && l.carId === car.id && !l.fuel)).filter((l) => l.kind === 'maint')
      .sort((a, b) => (b.d || '').localeCompare(a.d || '')).slice(0, 5)
      .map((l) => ({ text: l.text, sub: longDateS(l.d) + (l.km ? ' · ' + fmtKm(l.km) : '') + (l.cost ? ' · ' + money(l.cost) : '') }));
    const docs = carDocs(car).map((k) => ({ name: k.type, exp: k.exp ? h.expTxt(k.exp) : L('بلا تاريخ انتهاء', 'No expiry'), warn: !!k.exp && h.daysTo(h.expDay(k.exp)) <= 30 }));
    [['licenseEnd', L('رخصة العربية', 'Car licence')], ['insuranceEnd', L('تأمين العربية', 'Car insurance')]].forEach(([k, nm]) => {
      if (!car[k] || docs.some((d) => d.name.includes(nm.split(' ')[0]))) return; const d = daysBetween(today, car[k]);
      docs.push({ name: nm, exp: d < 0 ? L('منتهية منذ ' + days(-d), 'Expired') : L('تنتهي ', 'Ends ') + longDateS(car[k]) + ' (' + dLeftTxt(d) + ')', warn: d <= 30 }); });
    // ---- wider analysis (uses the optional car details) ----
    const allFuel = fuel, allServ = (s.log || []).filter((l) => l.kind === 'maint' && l.carId === car.id && l.cost);
    const sumF = (a, k) => a.reduce((x, r) => x + Number(r[k] || 0), 0);
    const yr = today.slice(0, 4);
    const fuelYear = sumF(allFuel.filter((f) => (f.d || '').slice(0, 4) === yr), 'price'), servYear = sumF(allServ.filter((f) => (f.d || '').slice(0, 4) === yr), 'cost');
    const firstKm = car.buyKm != null ? car.buyKm : (allFuel.find((f) => f.km != null) || {}).km;
    const firstD = car.buyDate || (allFuel[0] || {}).d;
    const drove = car.km != null && firstKm != null ? car.km - firstKm : null;
    const months = firstD ? Math.max(1, daysBetween(firstD, car.kmAt || today) / 30.44) : null;
    const perMonth = drove != null && months ? drove / months : null;
    const ins = [];
    if (car.year) ins.push({ k: L('عمر العربية', 'Age'), v: L(arCount(Math.max(0, Number(yr) - car.year), num, 'سنة واحدة', 'سنتين', 'سنوات', 'سنة'), (Number(yr) - car.year) + ' yrs') });
    if (perMonth != null && perMonth > 0) ins.push({ k: L('متوسط المشي شهرياً', 'Avg per month'), v: fmtKm(perMonth) });
    if (fa.all && car.ratedKmpl) { const d2 = Math.round((fa.all - car.ratedKmpl) / car.ratedKmpl * 100); ins.push({ k: L('مقارنة باستهلاك المصنع', 'vs. rated economy'), v: (d2 >= 0 ? L('أفضل بـ ', 'better by ') : L('أسوأ بـ ', 'worse by ')) + num(Math.abs(d2)) + '٪ (' + kmpl(car.ratedKmpl) + ')', warn: d2 <= -20 }); }
    const ppl = allFuel.filter((f) => f.liters && f.price).map((f) => ({ d: f.d, p: f.price / f.liters }));
    if (ppl.length >= 2) { const a = ppl[ppl.length - 2].p, b = ppl[ppl.length - 1].p; if (Math.abs(b - a) / a >= 0.03) ins.push({ k: L('سعر اللتر', 'Price per litre'), v: L((b > a ? 'ارتفع' : 'انخفض') + ' من ' + num(a.toFixed(2)) + ' إلى ' + num(b.toFixed(2)) + ' ج.م', (b > a ? 'rose' : 'fell') + ' ' + a.toFixed(2) + ' → ' + b.toFixed(2)) }); }
    if (car.tankL && fa.last) { const lastFill = allFuel.filter((f) => f.liters).slice(-1)[0]; if (lastFill) ins.push({ k: L('آخر تفويلة', 'Last fill'), v: num(Math.round(lastFill.liters / car.tankL * 100)) + L('٪ من التانك', '% of tank') + (fa.avg ? L(' · مدى التانك الكامل ≈ ', ' · full-tank range ≈ ') + fmtKm(car.tankL * fa.avg) : '') }); }
    if (fuelYear || servYear) ins.push({ k: L('تكلفة السنة (بنزين + صيانة)', 'This year (fuel + service)'), v: money(fuelYear + servYear) + (drove && (fuelYear + servYear) && perMonth ? '' : '') });
    if (fa.costKm && allServ.length && drove) { const tot = (sumF(allServ, 'cost') / drove) + fa.costKm; ins.push({ k: L('تكلفة الكيلو الكاملة', 'Full cost per km'), v: L(num(tot.toFixed(2)) + ' ج.م/كم', tot.toFixed(2) + ' EGP/km') }); }
    const missing = [!car.make && L('الماركة والموديل', 'make & model'), !car.year && L('سنة الصنع', 'year'), !car.tankL && L('سعة التانك', 'tank size'), !car.ratedKmpl && L('استهلاك المصنع', 'rated economy'), !car.buyDate && L('تاريخ وعداد الشراء', 'purchase date & km'), !car.licenseEnd && L('انتهاء الرخصة', 'licence expiry')].filter(Boolean);
    const carInfo = [car.make && car.model ? car.make + ' ' + car.model : '', car.year ? String(car.year) : '', car.engineCC ? L(num(car.engineCC) + ' سي سي', car.engineCC + ' cc') : '', car.trans === 'manual' ? L('مانيوال', 'Manual') : car.trans === 'auto' ? L('أوتوماتيك', 'Automatic') : '', (FUEL_TYPES.find((x) => x[0] === car.fuelType) || [])[isAr ? 1 : 2] || ''].filter(Boolean).join(' · ');
    return {
      id: car.id, name: car.name, plate: car.plate || '', hasPlate: !!car.plate, kmTxt: fmtKm(car.km), kmDate: car.kmAt ? L('آخر تحديث ', 'updated ') + longDateS(car.kmAt) : '',
      items, hasItems: items.length > 0, urgentTxt: urgent ? L(num(urgent) + ' تحتاج انتباهاً', urgent + ' need attention') : L('كل شيء في موعده', 'All on schedule'), urgentCls: urgent ? 'car-st car-st-warn' : 'car-st',
      kmplTxt: kmpl(kmPerL),
      fuelMonthTxt: money(fuelMonth), servMonthTxt: money(servMonth), lastFuel: fuel.length ? longDateS(fuel[fuel.length - 1].d) : '—',
      history, hasHistory: history.length > 0, docs, hasDocs: docs.length > 0, fuelA, ins, hasIns: ins.length > 0, carInfo, hasCarInfo: !!carInfo,
      missingTxt: missing.length ? L('أكمل: ', 'Add: ') + missing.slice(0, 3).join(L('، ', ', ')) + L(' — لتحليل أدق', ' for deeper analysis') : '', hasMissing: missing.length > 0,
      updKm: () => openHf('km', { carId: car.id, km: car.km != null ? String(car.km) : '' }),
      addFuel: () => openHf('fuel', { carId: car.id, d: today, cost: '', liters: '', km: '', full: true }),
      addService: () => openHf('service', { mid: null, carId: car.id, name: '', d: today, km: car.km != null ? String(car.km) : '', cost: '', note: '' }),
      addItem: () => openHf('maintF', { id: null, carId: car.id, name: '', everyKm: '', everyMonths: '', lastDate: '', lastKm: '' }),
      edit: () => { const f = { id: car.id, name: car.name, plate: car.plate || '', km: car.km != null ? String(car.km) : '' }; ['make','model','year','color','fuelType','tankL','engineCC','trans','ratedKmpl','buyDate','buyKm','buyPrice','licenseEnd','insuranceEnd'].forEach((k) => { f[k] = car[k] != null ? String(car[k]) : ''; }); openHf('car', f); }
    };
  });

  // ---------------- home maintenance ----------------
  const homeMaint = (s.maint || []).filter((m) => !m.carId).map((m) => mkMaint(m, null))
    .sort((a, b) => ({ due: 0, soon: 1, new: 2, ok: 3 }[a.stCls.slice(8)] - { due: 0, soon: 1, new: 2, ok: 3 }[b.stCls.slice(8)]));
  const usedHome = new Set((s.maint || []).filter((m) => !m.carId).map((m) => m.preset));
  const homePresetChips = HOME_PRESETS.filter((p) => !usedHome.has(p[0])).map(([k, ar, en, mo]) => ({
    name: isAr ? ar : en, add: () => { c.setState({ maint: [...(c.state.maint || []), { id: 'm' + Date.now(), preset: k, name: isAr ? ar : en, everyMonths: mo, shared: true }] }); c.flash(L('أُضيف — سجّل آخر مرة تمت فيها', 'Added — log when it was last done')); }
  }));

  // ---------------- warranties ----------------
  const warranties = (s.warranty || []).slice().sort((a, b) => (a.end || '9').localeCompare(b.end || '9')).map((w) => {
    const left = w.end ? daysBetween(today, w.end) : null;
    return {
      id: w.id, name: w.name, sub: [w.brand, w.store].filter(Boolean).join(' · '),
      bought: w.buyDate ? L('شراء ', 'Bought ') + longDateS(w.buyDate) : '', price: w.price ? money(w.price) : '',
      status: left == null ? L('بلا ضمان محدد', 'No warranty set') : left < 0 ? L('انتهى الضمان', 'Expired') : L('ساري — ينتهي ', 'Valid — ends ') + longDateS(w.end) + ' (' + dLeftTxt(left) + ')',
      stCls: left == null ? 'wst' : left < 0 ? 'wst wst-off' : left <= 30 ? 'wst wst-soon' : 'wst wst-ok',
      hasImg: !!w.img, hasPhone: !!w.phone, tel: 'tel:' + (w.phone || '').replace(/[^0-9+]/g, ''), phone: w.phone || '',
      view: () => set({ sheet: 'wView', wView: w.id }),
      edit: () => openHf('warrantyF', { ...w, price: w.price ? String(w.price) : '', months: w.months ? String(w.months) : '' })
    };
  });
  const wv = s.wView && (s.warranty || []).find((w) => w.id === s.wView);

  // ---------------- contacts ----------------
  // groups: the family's own list (synced); until edited, the default professions list
  const defGroups = ROLES.map(([id, ar, en], i) => ({ id, name: isAr ? ar : en, order: i, def: true }));
  const groups = (s.cgroups && s.cgroups.length ? s.cgroups.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : defGroups);
  const materialize = () => (c.state.cgroups && c.state.cgroups.length ? c.state.cgroups.slice() : defGroups.map((g) => ({ id: g.id, name: g.name, order: g.order, shared: true })));
  const gName = (r) => { const g = groups.find((y) => y.id === r); return g ? g.name : (isAr ? 'أخرى' : 'Other'); };
  const q = (s.ctSearch || '').trim().toLowerCase();
  const matchQ = (k) => !q || (k.name || '').toLowerCase().includes(q) || (k.phone || '').includes(q) || (k.note || '').toLowerCase().includes(q) || gName(k.role).toLowerCase().includes(q);
  const knownIds = new Set(groups.map((g) => g.id));
  const contactGroups = groups.concat(knownIds.has('other') ? [] : [{ id: 'other', name: isAr ? 'أخرى' : 'Other' }]).map((g) => ({ name: g.name, items: (s.contacts || []).filter((k) => ((knownIds.has(k.role) ? k.role : 'other') === g.id) && matchQ(k)).map((k) => {
    const pr = c.press(() => {}, () => { c.copyText(k.phone || ''); c.flash(L('تم نسخ الرقم ✓', 'Number copied ✓')); });
    const wa = (k.phone || '').replace(/[^0-9]/g, '').replace(/^0/, '20');
    return { name: k.name, note: k.note || '', hasNote: !!k.note, phone: k.phone || '', tel: 'tel:' + (k.phone || '').replace(/[^0-9+]/g, ''), wa: 'https://wa.me/' + wa,
      down: pr.down, up: pr.up, move: pr.move, menu: pr.menu,
      edit: () => openHf('contactF', { ...k }) };
  }) })).filter((g) => g.items.length);
  const gq = s.gDraft || '';
  const groupRows = groups.map((g, i) => ({ name: g.name, count: num((s.contacts || []).filter((k) => k.role === g.id).length),
    onName: (e) => { const v = e.target.value; c.setState({ cgroups: materialize().map((x) => x.id === g.id ? { ...x, name: v } : x) }); },
    up: () => { if (!i) return; const L2 = materialize().sort((a, b) => a.order - b.order); const a = L2[i - 1], b = L2[i]; c.setState({ cgroups: L2.map((x) => x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x) }); },
    down: () => { const L2 = materialize().sort((a, b) => a.order - b.order); if (i >= L2.length - 1) return; const a = L2[i], b = L2[i + 1]; c.setState({ cgroups: L2.map((x) => x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x) }); },
    del: () => { const n = (c.state.contacts || []).filter((k) => k.role === g.id).length;
      if (!window.confirm(L('حذف مجموعة «' + g.name + '»؟' + (n ? ' (' + num(n) + ' أرقام ستنتقل إلى «أخرى»)' : ''), 'Delete “' + g.name + '”?' + (n ? ' (' + n + ' contacts move to Other)' : '')))) return;
      c.bulkUntil = Date.now() + 2000;
      c.setState({ cgroups: materialize().filter((x) => x.id !== g.id), contacts: (c.state.contacts || []).map((k) => k.role === g.id ? { ...k, role: 'other' } : k) }); },
    canDel: g.id !== 'other' }));
  const addGroup = (thenSelect) => { const n = (c.state.gDraft || '').trim(); if (!n) { c.flash(L('اكتب اسم المجموعة', 'Enter a group name')); return; }
    const L2 = materialize(); const id = 'g' + Date.now(); const ord = Math.max(0, ...L2.map((x) => x.order || 0)) + 1;
    const st = { cgroups: [...L2.filter((x) => x.id !== 'other'), { id, name: n, order: ord, shared: true }, ...L2.filter((x) => x.id === 'other').map((x) => ({ ...x, order: ord + 1 }))], gDraft: '' };
    if (thenSelect) st.hf = { ...c.state.hf, role: id, addingGroup: false };
    c.setState(st); c.flash(L('أُضيفت مجموعة «' + n + '»', 'Group “' + n + '” added')); };

  // ---------------- forms ----------------
  const kmpl = (v) => v == null ? '—' : L(num(v.toFixed(1)) + ' كم/لتر', v.toFixed(1) + ' km/L');
  const kmAlert = (carId, km) => {
    const car = (c.state.cars || []).find((x) => x.id === carId);
    const near = (c.state.maint || []).filter((m) => m.carId === carId && m.everyKm && m.lastKm != null).map((m) => ({ m, left: m.lastKm + m.everyKm - km })).filter((x) => x.left <= 500).sort((a, b) => a.left - b.left);
    if (!near.length) { c.flash(L('تم تحديث العداد', 'Odometer updated')); return; }
    const x = near[0];
    const msg = x.left <= 0 ? L('حان موعد «' + x.m.name + '»', '“' + x.m.name + '” is due') : L('«' + x.m.name + '» بعد ' + fmtKm(x.left), '“' + x.m.name + '” in ' + fmtKm(x.left));
    c.flash(msg + (near.length > 1 ? L(' و' + num(near.length - 1) + ' غيرها', ' and ' + (near.length - 1) + ' more') : ''), 3500);
    try { h.localAlert && h.localAlert((car ? car.name + ': ' : '') + msg, L('افتح «البيت» لتسجيلها عند الانتهاء', 'Open Home to log it when done')); } catch (e) {}
  };
  const save = {
    car: () => {
      const extra = {};
      ['make','model','year','color','fuelType','tankL','engineCC','trans','ratedKmpl','buyDate','buyKm','buyPrice','licenseEnd','insuranceEnd'].forEach((k) => { const v = hf[k]; if (v == null || v === '') { extra[k] = null; return; } extra[k] = ['year', 'tankL', 'engineCC', 'ratedKmpl', 'buyKm', 'buyPrice'].includes(k) ? toNum(v) : String(v).trim(); });
      const auto = [extra.make, extra.model, extra.year ? String(extra.year) : ''].filter(Boolean).join(' ');
      const n = (hf.name || '').trim() || auto; if (!n) { c.flash(L('اكتب الماركة والموديل أو اسماً للعربية', 'Enter make & model or a name')); return; }
      const km = toNum(hf.km);
      if (hf.id) { c.setState({ cars: c.state.cars.map((x) => x.id === hf.id ? { ...x, ...extra, name: n, plate: (hf.plate || '').trim(), ...(km != null && km !== x.km ? { km, kmAt: today } : {}) } : x), sheet: null }); c.flash(L('حُفظت بيانات العربية', 'Car saved')); return; }
      const id = 'car' + Date.now();
      const items = CAR_PRESETS.map(([k, ar, en, ekm, emo], i) => ({ id: 'm' + Date.now() + i, carId: id, preset: k, name: isAr ? ar : en, everyKm: ekm, everyMonths: emo, shared: true }));
      c.setState({ cars: [...(c.state.cars || []), { id, ...extra, name: n, plate: (hf.plate || '').trim(), km, kmAt: km != null ? today : null, shared: true }], maint: [...(c.state.maint || []), ...items], sheet: null, homeSeg: 'car' });
      c.flash(L('أُضيفت العربية مع جدول صيانة مقترح — سجّل آخر مرة لكل بند', 'Car added with a suggested schedule — log the last time for each'));
    },
    km: () => { const km = toNum(hf.km); if (km == null) return; c.setState({ cars: c.state.cars.map((x) => x.id === hf.carId ? withKm(x, km, today) : x), sheet: null }); kmAlert(hf.carId, km); },
    fuel: () => {
      const cost = toNum(hf.cost); if (!cost) { c.flash(L('اكتب المبلغ', 'Enter the amount')); return; }
      const km = toNum(hf.km), liters = toNum(hf.liters), car = c.state.cars.find((x) => x.id === hf.carId);
      if (km != null && car && car.km != null && km < car.km && !hf.okLower) { setHf({ okLower: true, kmWarn: L('العداد أقل من آخر قراءة (' + num(car.km) + ') — اضغط حفظ مرة أخرى للتأكيد', 'Lower than the last reading — tap save again to confirm') }); return; }
      if (liters != null && liters > (car && car.tankL ? car.tankL * 1.08 : 90)) { c.flash(L('عدد اللترات أكبر من سعة التانك — تأكد منه', 'More litres than the tank holds — check it'), 3000); return; }
      const st = { sheet: null, log: [...(c.state.log || []), expEntry(L('بنزين — ', 'Fuel — ') + (car ? car.name : ''), cost, 'car', { fuel: true, carId: hf.carId, km, liters, full: hf.full !== false, d: hf.d || today })] };
      if (km != null && car && (car.km == null || km >= car.km)) st.cars = c.state.cars.map((x) => x.id === hf.carId ? withKm(x, km, hf.d || today) : x);
      c.setState(st);
      setTimeout(() => {
        const fa2 = fuelAnalysis((c.state.log || []).filter((l) => l.kind === 'exp' && l.fuel && l.carId === hf.carId));
        if (fa2.last && fa2.last.id && liters && km != null && fa2.last.to === km) {
          const msg = L('هذا التانك: ', 'This tank: ') + kmpl(fa2.last.kmpl) + (fa2.flag && fa2.flag.kind === 'bad' ? L(' — أعلى من المعتاد ⚠️ شوف التحليل', ' — higher than usual ⚠️') : '');
          c.flash(msg, 3500);
        }
        if (km != null) setTimeout(() => kmAlert(hf.carId, km), 3700);
      }, 300); c.flash(L('سُجّل التموين — ', 'Fuel logged — ') + money(cost));
    },
    service: () => {
      const name = (hf.name || '').trim(); if (!name) { c.flash(L('اختر أو اكتب نوع الصيانة', 'Pick or type the service')); return; }
      const km = toNum(hf.km), cost = toNum(hf.cost), d = hf.d || today;
      let maint = c.state.maint || [];
      if (hf.mid) maint = maint.map((m) => m.id === hf.mid ? { ...m, lastDate: d, ...(km != null ? { lastKm: km } : {}) } : m);
      const entry = { id: 'mt' + Date.now(), kind: 'maint', text: name, carId: hf.carId || null, mid: hf.mid || null, d, km, cost, note: (hf.note || '').trim(), at: Date.now(), by: c.myId(), shared: true };
      const st = { maint, sheet: null, log: [...(c.state.log || []), entry, ...(cost ? [expEntry(name, cost, hf.carId ? 'car' : 'maint', { d, carId: hf.carId || undefined, maint: true })] : [])] };
      if (hf.carId && km != null) st.cars = c.state.cars.map((x) => x.id === hf.carId && (x.km == null || km >= x.km) ? withKm(x, km, d) : x);
      c.setState(st);
      c.flash(L('تم تسجيل الصيانة', 'Service logged') + (cost ? ' — ' + money(cost) : ''));
    },
    maintF: () => {
      const n = (hf.name || '').trim(); if (!n) { c.flash(L('اكتب اسم البند', 'Enter a name')); return; }
      const rec = { name: n, everyKm: toNum(hf.everyKm), everyMonths: toNum(hf.everyMonths), lastDate: hf.lastDate || null, lastKm: toNum(hf.lastKm), rem: hf.rem || [] };
      if (!rec.everyKm && !rec.everyMonths) { c.flash(L('حدد كل كام شهر أو كل كام كيلو', 'Set every N months or N km'), 2600); return; }
      if (hf.id) c.setState({ maint: c.state.maint.map((m) => m.id === hf.id ? { ...m, ...rec } : m), sheet: null });
      else c.setState({ maint: [...(c.state.maint || []), { id: 'm' + Date.now(), carId: hf.carId || null, shared: true, ...rec }], sheet: null });
    },
    warrantyF: () => {
      const n = (hf.name || '').trim(); if (!n) { c.flash(L('اكتب اسم الجهاز', 'Enter the device')); return; }
      const months = toNum(hf.months), buy = hf.buyDate || today;
      const rec = { rem: hf.rem || [], name: n, brand: (hf.brand || '').trim(), store: (hf.store || '').trim(), buyDate: buy, months, end: months ? addMonths(buy, months) : null, price: toNum(hf.price), phone: (hf.phone || '').trim(), img: hf.img || '', shared: true };
      if (hf.id) c.setState({ warranty: c.state.warranty.map((w) => w.id === hf.id ? { ...w, ...rec } : w), sheet: null });
      else c.setState({ warranty: [...(c.state.warranty || []), { id: 'w' + Date.now(), ...rec }], sheet: null, homeSeg: 'warranty' });
      c.flash(L('تم الحفظ', 'Saved'));
    },
    contactF: () => {
      const n = (hf.name || '').trim(), p = (hf.phone || '').trim(); if (!n || !p) { c.flash(L('اكتب الاسم والرقم', 'Enter name and number')); return; }
      if (hf.addingGroup && (c.state.gDraft || '').trim()) { addGroup(true); setTimeout(() => save.contactF(), 50); return; }
      const rec = { name: n, phone: p, role: hf.role || 'other', note: (hf.note || '').trim(), shared: true };
      if (hf.id) c.setState({ contacts: c.state.contacts.map((k) => k.id === hf.id ? { ...k, ...rec } : k), sheet: null });
      else c.setState({ contacts: [...(c.state.contacts || []), { id: 'ct' + Date.now(), ...rec }], sheet: null, homeSeg: 'contacts' });
    }
  };
  const del = {
    car: () => { if (!window.confirm(L('حذف العربية وجدول صيانتها؟ (المصروفات المسجلة تبقى)', 'Delete the car and its schedule? (expenses stay)'))) return; c.bulkUntil = Date.now() + 2000; c.setState({ cars: c.state.cars.filter((x) => x.id !== hf.id), maint: c.state.maint.filter((m) => m.carId !== hf.id), sheet: null }); },
    maintF: () => { if (!window.confirm(L('حذف هذا البند؟', 'Delete this item?'))) return; c.setState({ maint: c.state.maint.filter((m) => m.id !== hf.id), sheet: null }); },
    warrantyF: () => { if (!window.confirm(L('حذف هذا الضمان؟', 'Delete this warranty?'))) return; c.setState({ warranty: c.state.warranty.filter((w) => w.id !== hf.id), sheet: null }); },
    contactF: () => { if (!window.confirm(L('حذف هذا الرقم؟', 'Delete this contact?'))) return; c.setState({ contacts: c.state.contacts.filter((k) => k.id !== hf.id), sheet: null }); }
  };
  const isHf = ['car', 'km', 'fuel', 'service', 'maintF', 'warrantyF', 'contactF'].includes(s.sheet);
  const carForService = hf.carId && (s.cars || []).find((x) => x.id === hf.carId);
  const serviceChips = (s.sheet === 'service' && !hf.mid) ? (s.maint || []).filter((m) => (m.carId || null) === (hf.carId || null)).map((m) => ({ name: m.name, cls: hf.name === m.name ? 'chip-on' : 'chip', sel: () => setHf({ name: m.name, mid: m.id }) })) : [];

  return {
    isHome: s.tab === 'home', homeSegs, isSegChores: seg === 'chores', isSegCar: seg === 'car', isSegMaint: seg === 'maint', isSegWarranty: seg === 'warranty', isSegContacts: seg === 'contacts',
    cars, hasCars: cars.length > 0, noCars: cars.length === 0, addCar: () => openHf('car', { id: null, name: '', plate: '', km: '', fuelType: 'b92', trans: 'auto' }),
    homeMaint, hasHomeMaint: homeMaint.length > 0, homePresetChips, hasHomePresets: homePresetChips.length > 0,
    addHomeMaint: () => openHf('maintF', { id: null, carId: null, name: '', everyKm: '', everyMonths: '', lastDate: '', lastKm: '' }),
    warranties, hasWarranties: warranties.length > 0, addWarranty: () => openHf('warrantyF', { id: null, name: '', brand: '', store: '', buyDate: today, months: '24', price: '', phone: '', img: '' }),
    isWView: s.sheet === 'wView' && !!wv, wvImg: wv ? wv.img || '' : '', wvHasImg: !!(wv && wv.img), wvName: wv ? wv.name : '',
    wvEdit: () => { if (wv) openHf('warrantyF', { ...wv, price: wv.price ? String(wv.price) : '', months: wv.months ? String(wv.months) : '' }); },
    contactGroups, hasContacts: contactGroups.length > 0, addContact: () => openHf('contactF', { id: null, name: '', phone: '', role: (groups[0] || {}).id || 'other', note: '' }),
    // forms
    isHfCar: s.sheet === 'car', isHfKm: s.sheet === 'km', isHfFuel: s.sheet === 'fuel', isHfService: s.sheet === 'service', isHfMaint: s.sheet === 'maintF', isHfWarranty: s.sheet === 'warrantyF', isHfContact: s.sheet === 'contactF',
    hf: { ...hf, isNew: !hf.id, fullCls: hf.full !== false ? 'vis vis-on' : 'vis vis-off', isFull: hf.full !== false, ppl: (toNum(hf.cost) && toNum(hf.liters)) ? L('سعر اللتر: ' + num((toNum(hf.cost) / toNum(hf.liters)).toFixed(2)) + ' ج.م', 'Price per litre: ' + (toNum(hf.cost) / toNum(hf.liters)).toFixed(2)) : '', hasPpl: !!(toNum(hf.cost) && toNum(hf.liters)), toggleFull: () => setHf({ full: c.state.hf.full === false }), isEdit: !!hf.id, isCar: !!hf.carId, reading: !!hf.reading, snapTxt: hf.reading ? L('جارٍ قراءة العداد…', 'Reading…') : L('📷 صوّر العداد', '📷 Snap the odometer'), kmWarn: hf.kmWarn || '', hasKmWarn: !!hf.kmWarn, serviceChips, hasServiceChips: serviceChips.length > 0, carName: carForService ? carForService.name : '',
      img: hf.img || '', hasImg: !!hf.img },
    hfIn: (k) => (e) => setHf({ [k]: e.target.value }),
    hfSet: {}, // placeholder
    snapKm: (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (!h.AI || !h.AI.aiAvailable) { c.flash(L('قراءة صورة العداد تعمل في التطبيق على الهاتف — اكتب الرقم الآن', 'Reading the photo works in the phone app — type the number for now'), 3000); return; }
      setHf({ reading: true });
      readImage(f, 1400).then((img) => h.AI.readOdometer(img)).then((r) => {
        const km = r && r.km != null ? Math.round(Number(r.km)) : null;
        if (km == null || isNaN(km)) { setHf({ reading: false }); c.flash(L('لم أستطع قراءة العداد — قرّب الصورة أو اكتب الرقم', 'Couldn’t read it — get closer or type it'), 3000); return; }
        const car = (c.state.cars || []).find((x) => x.id === c.state.hf.carId);
        setHf({ km: String(km), reading: false, kmWarn: car && car.km != null && km < car.km ? L('الرقم أقل من آخر قراءة (' + num(car.km) + ') — تأكد منه', 'Lower than the last reading — check it') : '' });
        c.flash(L('قرأت العداد: ', 'Odometer: ') + num(km.toLocaleString('en-US')) + L(' كم — راجع الرقم ثم احفظ', ' km — check and save'), 3000);
      }).catch(() => { setHf({ reading: false }); c.flash(L('تعذّرت القراءة — اكتب الرقم', 'Couldn’t read — type it'), 2600); });
    },
    on: {
      name: (e) => setHf({ name: e.target.value }), plate: (e) => setHf({ plate: e.target.value }), km: (e) => setHf({ km: e.target.value, kmWarn: '' }), d: (e) => setHf({ d: e.target.value }),
      cost: (e) => setHf({ cost: e.target.value }), liters: (e) => setHf({ liters: e.target.value }), note: (e) => setHf({ note: e.target.value }),
      everyKm: (e) => setHf({ everyKm: e.target.value }), everyMonths: (e) => setHf({ everyMonths: e.target.value }), lastDate: (e) => setHf({ lastDate: e.target.value }), lastKm: (e) => setHf({ lastKm: e.target.value }),
      brand: (e) => setHf({ brand: e.target.value }), store: (e) => setHf({ store: e.target.value }), buyDate: (e) => setHf({ buyDate: e.target.value }), months: (e) => setHf({ months: e.target.value }),
      price: (e) => setHf({ price: e.target.value }), phone: (e) => setHf({ phone: e.target.value }),
      img: (e) => { const f = e.target.files && e.target.files[0]; readImage(f, 1400).then((d) => { if (d) setHf({ img: d }); }); },
      make: (e) => setHf({ make: e.target.value }),
      model: (e) => setHf({ model: e.target.value }),
      year: (e) => setHf({ year: e.target.value }),
      color: (e) => setHf({ color: e.target.value }),
      tankL: (e) => setHf({ tankL: e.target.value }),
      engineCC: (e) => setHf({ engineCC: e.target.value }),
      ratedKmpl: (e) => setHf({ ratedKmpl: e.target.value }),
      buyKm: (e) => setHf({ buyKm: e.target.value }),
      buyPrice: (e) => setHf({ buyPrice: e.target.value }),
      licenseEnd: (e) => setHf({ licenseEnd: e.target.value }),
      insuranceEnd: (e) => setHf({ insuranceEnd: e.target.value })
    },
    wMonths: [6, 12, 24, 36, 60].map((m) => ({ name: m < 12 ? L(num(m) + ' شهور', m + ' months') : L(num(m / 12) + (m === 12 ? ' سنة' : m === 24 ? ' سنتان' : ' سنوات'), (m / 12) + ' yr'), cls: String(hf.months) === String(m) ? 'chip-on' : 'chip', sel: () => setHf({ months: String(m) }) })),
    roleChips: groups.map((g) => ({ name: g.name, cls: (hf.role || 'other') === g.id ? 'chip-on' : 'chip', sel: () => setHf({ role: g.id, addingGroup: false }) })),
    pickFromPhone: () => {
      if (!h.pickPhone) return;
      h.pickPhone().then((r) => { if (!r.phone) { c.flash(L('هذه الجهة بلا رقم', 'No number on that contact')); return; } setHf({ phone: r.phone.replace(/[^0-9+]/g, ''), name: c.state.hf.name || r.name }); c.flash(L('تم — لا يحتفظ التطبيق بأي صلاحية على جهات الاتصال', 'Done — the app keeps no access to your contacts'), 2600); })
        .catch((e) => { const m = String((e && e.message) || e); if (/cancel/.test(m)) return; c.flash(m === 'web' ? L('الاختيار من جهات الاتصال يعمل في التطبيق على الهاتف', 'Works in the phone app') : L('تعذّر فتح جهات الاتصال', 'Couldn’t open contacts'), 2600); });
    },
    addingGroup: !!hf.addingGroup, startAddGroup: () => setHf({ addingGroup: true }), gDraft: gq, onGDraft: (e) => c.setState({ gDraft: e.target.value }),
    addGroupInForm: () => addGroup(true), addGroupInSheet: () => addGroup(false),
    groupRows, openGroups: () => c.setState({ sheet: 'cgroups' }), isGroups: s.sheet === 'cgroups',
    ctSearch: s.ctSearch || '', onCtSearch: (e) => c.setState({ ctSearch: e.target.value }), hasCtSearch: (s.contacts || []).length > 5,
    noCtMatch: !!q && contactGroups.length === 0,
    carFuelChips: FUEL_TYPES.map(([k, ar, en]) => ({ name: isAr ? ar : en, cls: hf.fuelType === k ? 'chip-on' : 'chip', sel: () => setHf({ fuelType: k }) })),
    carTransChips: [['auto', L('أوتوماتيك', 'Automatic')], ['manual', L('مانيوال', 'Manual')]].map(([k, n]) => ({ name: n, cls: hf.trans === k ? 'chip-on' : 'chip', sel: () => setHf({ trans: k }) })),
    carMoreOpen: !!hf.more || !!hf.id, toggleCarMore: () => setHf({ more: !c.state.hf.more }),
    carIn: (k) => (e) => setHf({ [k]: e.target.value }),
    saveCar: save.car, saveKm: save.km, saveFuel: save.fuel, saveService: save.service, saveMaint: save.maintF, saveWarranty: save.warrantyF, saveContact: save.contactF,
    delCar: del.car, delMaint: del.maintF, delWarranty: del.warrantyF, delContact: del.contactF,
    homeSheetTitles: { car: hf.id ? L('تعديل العربية', 'Edit car') : L('إضافة عربية', 'Add a car'), km: L('تحديث العداد', 'Update odometer'), fuel: L('تموين بنزين', 'Fuel up'),
      service: L('تسجيل صيانة', 'Log a service'), maintF: hf.id ? L('تعديل بند الصيانة', 'Edit item') : L('بند صيانة جديد', 'New maintenance item'), warrantyF: hf.id ? L('تعديل الضمان', 'Edit warranty') : L('جهاز وضمان', 'Device & warranty'),
      contactF: hf.id ? L('تعديل الرقم', 'Edit contact') : L('رقم جديد', 'New contact'), cgroups: L('تنظيم المجموعات', 'Organise groups'), wView: wv ? wv.name : '' },
    homeDue: (() => { // for Today panel
      const out = [];
      (s.maint || []).forEach((m) => { if (h.isHid(m.carId ? 'home.car' : 'home.maint')) return; const car = m.carId ? (s.cars || []).find((x) => x.id === m.carId) : null; const st = maintStatus(m, car, today);
        if (st.level === 'due' || st.level === 'soon') out.push({ name: (car ? car.name + ' — ' : '') + m.name, sub: st.level === 'due' ? L('حان موعدها', 'Due now') : (st.daysLeft != null && st.daysLeft <= 14 ? dLeftTxt(st.daysLeft) : L('باقي ', '') + fmtKm(st.kmLeft)), cls: st.level === 'due' ? 'due-w due-hot' : 'due-w', go: () => set({ tab: 'home', homeSeg: car ? 'car' : 'maint' }) }); });
      (h.isHid('home.car') ? [] : (s.cars || [])).forEach((car) => [['licenseEnd', L('رخصة ', 'Licence: ')], ['insuranceEnd', L('تأمين ', 'Insurance: ')]].forEach(([k, lbl]) => { if (!car[k]) return; const d = daysBetween(today, car[k]); if (d <= 30) out.push({ name: lbl + car.name, sub: d < 0 ? L('انتهت', 'Expired') : L('تنتهي ', 'ends ') + dLeftTxt(d), cls: d <= 7 ? 'due-w due-hot' : 'due-w', go: () => set({ tab: 'home', homeSeg: 'car' }) }); }));
      (h.isHid('home.warranty') ? [] : (s.warranty || [])).forEach((w) => { if (!w.end) return; const d = daysBetween(today, w.end); if (d >= 0 && d <= 30) out.push({ name: L('ضمان ', 'Warranty: ') + w.name, sub: L('ينتهي ', 'ends ') + dLeftTxt(d), cls: 'due-w', go: () => set({ tab: 'home', homeSeg: 'warranty' }) }); });
      return out;
    })()
  };
}

// ======================================================================
export function healthVals(c, h) {
  const { s, L, num, isAr, WHO, PIDS, PEOPLE, myId, pCls, longDateS, tx } = h;
  const today = iso(new Date());
  const who = s.recWho !== 'all' && PIDS.includes(s.recWho) ? s.recWho : null;
  const prof = (id) => (s.health || []).find((x) => x.id === id) || { id };
  const saveProf = (id, patch) => { const ex = (c.state.health || []).some((x) => x.id === id); c.setState({ health: ex ? c.state.health.map((x) => x.id === id ? { ...x, ...patch } : x) : [...(c.state.health || []), { id, shared: true, ...patch }] }); };
  const ageTxt = (b) => { if (!b) return ''; const m = Math.floor(daysBetween(b, today) / 30.44); if (m < 1) return L('حديث الولادة', 'Newborn'); if (m < 24) return L(arCount(m, num, 'شهر واحد', 'شهرين', 'أشهر', 'شهراً'), m + ' months'); const y = Math.floor(m / 12); return L(arCount(y, num, 'سنة واحدة', 'سنتين', 'سنوات', 'سنة'), y + ' yrs'); };
  const p = who ? prof(who) : null;
  const meas = (id, t) => (s.measures || []).filter((m) => m.who === id && m.type === t).sort((a, b) => (a.d + (a.tm || '')).localeCompare(b.d + (b.tm || '')));
  const lastTxt = (id, t) => { const l = meas(id, t).slice(-1)[0]; if (!l) return '—'; return t === 'bp' ? num(l.v1) + '/' + num(l.v2) : num(l.v1); };
  const activeMeds = (id) => (s.meds || []).filter((m) => m.active && m.who === id).map((m) => tx(m.name) + (m.dose ? ' (' + tx(m.dose) + ')' : ''));
  const healthCard = (id) => (s.cards || []).find((k) => (k.kind === 'health') && k.who === id);

  // classify a reading
  const judge = (t, v1, v2, ctx) => {
    if (t === 'bp') { if (v1 >= 140 || v2 >= 90) return ['high', L('مرتفع', 'High')]; if (v1 >= 130 || v2 >= 80) return ['warn', L('أعلى من الطبيعي قليلاً', 'Slightly high')]; if (v1 < 90 || v2 < 60) return ['warn', L('منخفض', 'Low')]; return ['ok', L('طبيعي', 'Normal')]; }
    if (t === 'sugar') { const fasting = ctx === 'fasting'; if (v1 < 70) return ['high', L('منخفض', 'Low')]; if (fasting ? v1 >= 126 : v1 >= 200) return ['high', L('مرتفع', 'High')]; if (fasting ? v1 >= 100 : v1 >= 140) return ['warn', L('أعلى من الطبيعي', 'Above normal')]; return ['ok', L('طبيعي', 'Normal')]; }
    if (t === 'temp') { if (v1 >= 38) return ['high', L('حرارة', 'Fever')]; if (v1 >= 37.5) return ['warn', L('مرتفعة قليلاً', 'Slightly high')]; return ['ok', L('طبيعية', 'Normal')]; }
    return ['', ''];
  };
  const mt = s.mType || 'bp';
  const mWho = s.mWho || who || myId;
  const series = meas(mWho, mt);
  // SVG line chart
  const chart = (() => {
    const pts = series.slice(-20); if (pts.length < 2) return { has: false, path: '', path2: '', dots: [], labels: [] };
    const vals = pts.flatMap((p) => mt === 'bp' ? [p.v1, p.v2] : [p.v1]).map(Number);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.15 || 5; lo -= pad; hi += pad;
    const W = 300, H = 120, x = (i) => 10 + i * (W - 20) / (pts.length - 1), y = (v) => H - 10 - (v - lo) / (hi - lo) * (H - 20);
    const line = (k) => pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(Number(p[k])).toFixed(1)).join(' ');
    return { has: true, path: line('v1'), path2: mt === 'bp' ? line('v2') : '', has2: mt === 'bp',
      dots: pts.map((p, i) => ({ cx: x(i).toFixed(1), cy: y(Number(p.v1)).toFixed(1) })),
      hi: num(Math.round(hi)), lo: num(Math.round(lo)), from: longDateS(pts[0].d), to: longDateS(pts[pts.length - 1].d) };
  })();
  const unit = (MT.find((x) => x[0] === mt) || MT[0])[3];
  const mRows = series.slice().reverse().slice(0, 12).map((r) => { const [lvl, lbl] = judge(mt, Number(r.v1), Number(r.v2), r.ctx);
    return { val: (mt === 'bp' ? num(r.v1) + '/' + num(r.v2) : num(r.v1)) + ' ' + unit, when: longDateS(r.d) + (r.tm ? ' · ' + num(r.tm) : '') + (r.ctx === 'fasting' ? L(' · صائم', ' · fasting') : r.ctx === 'after' ? L(' · بعد الأكل', ' · after meal') : ''),
      lbl, lCls: 'jg jg-' + (lvl || 'none'), hasLbl: !!lbl,
      del: () => { if (window.confirm(L('حذف هذه القراءة؟', 'Delete this reading?'))) c.setState({ measures: c.state.measures.filter((x) => x.id !== r.id) }); } }; });
  const mf = s.mForm || {};
  const setMf = (o) => c.setState({ mForm: { ...c.state.mForm, ...o } });

  // vaccinations for selected person
  const vaxRows = p ? (p.vax || []).slice().sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map((v) => {
    const left = v.due ? daysBetween(today, v.due) : null;
    return { name: v.name, due: v.due ? longDateS(v.due) : '', done: !!v.done, doneTxt: v.done ? L('تم ', 'Done ') + longDateS(v.done) : left == null ? '' : left < 0 ? L('فات موعده — علّم عليه لو تم', 'Past due — tick if done') : left === 0 ? L('اليوم', 'Today') : L('بعد ' + arCount(left, num, 'يوم واحد', 'يومين', 'أيام', 'يوماً'), 'in ' + left + ' days'),
      ckCls: v.done ? 'ck-on' : 'ck', sCls: v.done ? 't2' : left != null && left < 0 ? 't2 due-hot' : 't2',
      toggle: () => saveProf(p.id, { vax: (prof(p.id).vax || []).map((x) => x.k === v.k ? { ...x, done: x.done ? null : today } : x) }),
      toAppt: () => { if (!v.due) return; c.setState({ appts: [{ id: 'x' + Date.now(), title: v.name, who: p.id, d: v.due, when: { ar: v.due, en: v.due }, cat: 'vax', shared: true }, ...c.state.appts] }); c.flash(L('أُضيف للمواعيد مع تذكير', 'Added to appointments with a reminder')); },
      canAppt: !v.done && !!v.due && v.due >= today && !(s.appts || []).some((a) => a.cat === 'vax' && a.who === p.id && a.d === v.due) };
  }) : [];

  const hp = s.hpForm || {};
  const setHp = (o) => c.setState({ hpForm: { ...c.state.hpForm, ...o } });
  const em = s.emerg ? (() => { const id = s.emerg, pr = prof(id), hc = healthCard(id);
    return { name: WHO[id] || '', blood: pr.blood || '—', allergies: pr.allergies || L('لا توجد معروفة', 'None known'), hasAllergy: !!pr.allergies, chronic: pr.chronic || L('لا يوجد', 'None'),
      meds: activeMeds(id).join('، ') || L('لا يوجد', 'None'), age: ageTxt(pr.birth), hasAge: !!pr.birth, notes: pr.notes || '', hasNotes: !!pr.notes,
      ice: pr.ice || '', hasIce: !!pr.ice, iceTel: 'tel:' + (pr.ice || '').replace(/[^0-9+]/g, ''),
      ins: hc ? hc.type + (hc.num ? ' — ' + hc.num : '') : '', hasIns: !!hc, weight: lastTxt(id, 'weight') };
  })() : null;

  return {
    hasHealthWho: !!p,
    hpv: p ? (() => { const pr = prof(p.id); return {
      name: WHO[p.id] || '', blood: pr.blood || L('غير مسجلة', 'Not set'), allergies: pr.allergies || L('لا توجد', 'None'), allergyCls: pr.allergies ? 'hp-v hp-alert' : 'hp-v', chronic: pr.chronic || L('لا يوجد', 'None'),
      age: ageTxt(pr.birth), hasAge: !!pr.birth, bp: lastTxt(p.id, 'bp'), sugar: lastTxt(p.id, 'sugar'), weight: lastTxt(p.id, 'weight'), height: lastTxt(p.id, 'height'),
      isChild: !!pr.birth && daysBetween(pr.birth, today) < 365 * 13, hasVax: (pr.vax || []).length > 0, vaxRows,
      nextVax: (() => { const n = vaxRows.find((v) => !v.done); return n ? n.name + ' — ' + n.due : ''; })(),
      edit: () => c.setState({ sheet: 'hp', hpForm: { id: p.id, blood: pr.blood || '', allergies: pr.allergies || '', chronic: pr.chronic || '', birth: pr.birth || '', ice: pr.ice || '', notes: pr.notes || '' } }),
      emergency: () => c.setState({ emerg: p.id }),
      dossier: () => c.setState({ sheet: 'dossier', dosWho: p.id, dosCat: 'all' }), dosCount: num((s.dossier || []).filter((e) => e.who === p.id).length + (s.records || []).filter((r) => r.img && r.who === p.id).length),
      measures: () => c.setState({ sheet: 'measures', mWho: p.id, mType: 'bp' }),
      addVaxTemplate: () => { const pr2 = prof(p.id); if (!pr2.birth) { c.flash(L('سجّل تاريخ الميلاد أولاً من «تعديل الملف»', 'Set the birth date first'), 2600); return; }
        saveProf(p.id, { vax: VAX_TEMPLATE.map(([m, n], i) => ({ k: 'v' + i, name: n, ageM: m, due: addMonths(pr2.birth, m), done: null })) });
        c.flash(L('أُضيف الجدول — علّم على ما تم أخذه، وراجعه مع كارت التطعيم', 'Schedule added — tick what was given and check the vaccination card'), 3500); }
    }; })() : {},
    healthGrid: !p ? PIDS.map((id) => { const pr = prof(id); return { name: WHO[id], init: (WHO[id] || '?').charAt(0), avCls: 'av ' + pCls(id), blood: pr.blood || '—', allergy: pr.allergies ? L('حساسية: ', 'Allergy: ') + pr.allergies : '', hasAllergy: !!pr.allergies,
      open: () => c.setState({ recWho: id }), emergency: () => c.setState({ emerg: id }) }; }) : [],
    showHealthGrid: !p,
    // health profile form
    isHp: s.sheet === 'hp', hpf: hp,
    hpBlood: BLOOD.map((b) => ({ name: b, cls: hp.blood === b ? 'chip-on' : 'chip', sel: () => setHp({ blood: hp.blood === b ? '' : b }) })),
    hpOn: { allergies: (e) => setHp({ allergies: e.target.value }), chronic: (e) => setHp({ chronic: e.target.value }), birth: (e) => setHp({ birth: e.target.value }), ice: (e) => setHp({ ice: e.target.value }), notes: (e) => setHp({ notes: e.target.value }) },
    saveHp: () => { const f = c.state.hpForm; saveProf(f.id, { blood: f.blood || '', allergies: (f.allergies || '').trim(), chronic: (f.chronic || '').trim(), birth: f.birth || '', ice: (f.ice || '').trim(), notes: (f.notes || '').trim() }); c.setState({ sheet: null }); c.flash(L('حُفظ الملف الصحي', 'Health profile saved')); },
    // measurements
    isMeasures: s.sheet === 'measures',
    mTypes: MT.map(([k, ar, en]) => ({ name: isAr ? ar : en, cls: mt === k ? 'tab tab-on' : 'tab', sel: () => c.setState({ mType: k }) })),
    mWhoChips: PIDS.map((id) => ({ name: WHO[id], cls: mWho === id ? 'chip-on' : 'chip', sel: () => c.setState({ mWho: id }) })),
    chart, hasChart: chart.has, noChart: !chart.has, mRows, hasMRows: mRows.length > 0, mUnit: unit,
    mNormal: mt === 'bp' ? L('الطبيعي أقل من ١٢٠/٨٠', 'Normal: below 120/80') : mt === 'sugar' ? L('الطبيعي صائماً ٧٠–٩٩، وبعد الأكل بساعتين أقل من ١٤٠', 'Normal fasting 70–99; 2h after meal under 140') : mt === 'temp' ? L('الطبيعي حوالي ٣٦٫٥–٣٧٫٤', 'Normal around 36.5–37.4') : '',
    hasMNormal: ['bp', 'sugar', 'temp'].includes(mt),
    mfv: { v1: mf.v1 || '', v2: mf.v2 || '', isBp: mt === 'bp', isSugar: mt === 'sugar', ctxFast: mf.ctx === 'fasting' ? 'chip-on' : 'chip', ctxAfter: mf.ctx === 'after' ? 'chip-on' : 'chip', ctxRand: !mf.ctx ? 'chip-on' : 'chip',
      v1Ph: mt === 'bp' ? L('الانقباضي (الكبير)', 'Systolic') : (MT.find((x) => x[0] === mt) || MT[0])[3], v2Ph: L('الانبساطي (الصغير)', 'Diastolic') },
    mOn: { v1: (e) => setMf({ v1: e.target.value }), v2: (e) => setMf({ v2: e.target.value }), fast: () => setMf({ ctx: 'fasting' }), after: () => setMf({ ctx: 'after' }), rand: () => setMf({ ctx: null }) },
    addMeasure: () => {
      const f = c.state.mForm || {}; const v1 = toNum(f.v1), v2 = toNum(f.v2);
      if (v1 == null || (mt === 'bp' && v2 == null)) { c.flash(L('اكتب القراءة', 'Enter the reading')); return; }
      const now = new Date();
      const r = { id: 'ms' + Date.now(), who: mWho, type: mt, v1, v2: mt === 'bp' ? v2 : null, ctx: mt === 'sugar' ? (f.ctx || null) : null, d: today, tm: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), shared: true };
      c.setState({ measures: [...(c.state.measures || []), r], mForm: { ctx: f.ctx } });
      const [lvl, lbl] = judge(mt, v1, v2, r.ctx); c.flash(L('سُجّلت القراءة', 'Reading saved') + (lbl ? ' — ' + lbl : ''), lvl === 'high' ? 3500 : 1800);
    },
    shareMeasures: () => {
      const lines = series.slice(-30).map((r) => r.d + (r.tm ? ' ' + r.tm : '') + ' — ' + (mt === 'bp' ? r.v1 + '/' + r.v2 : r.v1) + ' ' + unit + (r.ctx === 'fasting' ? L(' (صائم)', ' (fasting)') : r.ctx === 'after' ? L(' (بعد الأكل)', ' (after meal)') : ''));
      h.shareText(L('قراءات ', 'Readings: ') + (MT.find((x) => x[0] === mt) || MT[0])[isAr ? 1 : 2] + ' — ' + (WHO[mWho] || ''), lines.join('\n')).then((r) => { if (r === 'copied') c.flash(L('نُسخت القراءات', 'Readings copied')); });
    },
    // emergency
    isEmerg: !!em, em: em || {}, closeEmerg: () => c.setState({ emerg: null })
  };
}

// ======================================================================
export function reportVals(c, h) {
  const { s, L, num, money, isAr, WHO, SC, EC, scName, ecName, longDateS } = h;
  const now = new Date();
  const off = s.repOff || 0; // 0 = this month, 1 = last month...
  const md = new Date(now.getFullYear(), now.getMonth() - off, 1), pd = new Date(now.getFullYear(), now.getMonth() - off - 1, 1);
  const ymOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const ym = ymOf(md), pym = ymOf(pd);
  const rows = (k) => (s.log || []).filter((l) => (l.kind === 'shop' || l.kind === 'exp') && !l.fuel && l.price && (l.d || '').slice(0, 7) === k);
  const cur = rows(ym), prev = rows(pym);
  const sum = (a) => a.reduce((x, r) => x + Number(r.price), 0);
  const total = sum(cur), ptotal = sum(prev);
  const catKey = (r) => r.kind === 'exp' ? 'e-' + (r.ecat || 'other') : 's-' + (r.cat || 'super');
  const catName = (k) => k.startsWith('e-') ? (ecName[k.slice(2)] || k) : (scName[k.slice(2)] || k);
  const byCat = {}; cur.forEach((r) => { byCat[catKey(r)] = (byCat[catKey(r)] || 0) + Number(r.price); });
  const pByCat = {}; prev.forEach((r) => { pByCat[catKey(r)] = (pByCat[catKey(r)] || 0) + Number(r.price); });
  const maxC = Math.max(1, ...Object.values(byCat));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v], i) => {
    const pv = pByCat[k] || 0, ch = pv ? Math.round((v - pv) / pv * 100) : null;
    return { name: catName(k), amt: money(v), pct: Math.round(v / maxC * 100), share: num(Math.round(v / (total || 1) * 100)) + '٪', barCls: 'rb rb-' + (i % 6),
      chTxt: ch == null ? L('جديد', 'new') : (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + num(Math.abs(ch)) + '٪', chCls: ch == null ? 'rch' : ch > 5 ? 'rch rch-up' : ch < -5 ? 'rch rch-down' : 'rch' };
  });
  // daily bars
  const days = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => sum(cur.filter((r) => Number((r.d || '').slice(8)) === i + 1)));
  const maxD = Math.max(1, ...daily);
  const dayBars = daily.map((v, i) => ({ x: (i * (300 / days)).toFixed(1), w: Math.max(2, 300 / days - 2).toFixed(1), h: Math.round(v / maxD * 70), y: 72 - Math.round(v / maxD * 70), on: v > 0 }));
  // top items
  const items = {}; cur.forEach((r) => { const k = (r.text || '').trim(); items[k] = (items[k] || 0) + Number(r.price); });
  const top = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => ({ name: n, amt: money(v) }));
  // price changes: same shop item bought in both months
  const avg = (arr, name) => { const xs = arr.filter((r) => r.kind === 'shop' && (r.text || '').trim() === name); return xs.length ? sum(xs) / xs.length : null; };
  const priceCh = Object.keys(items).map((n) => { const a = avg(cur, n), b = avg(prev, n); return a && b ? { name: n, ch: Math.round((a - b) / b * 100), a, b } : null; }).filter((x) => x && Math.abs(x.ch) >= 5)
    .sort((x, y) => y.ch - x.ch).slice(0, 5).map((x) => ({ name: x.name, txt: money(x.b) + ' ← ' + money(x.a), chTxt: (x.ch > 0 ? '▲ ' : '▼ ') + num(Math.abs(x.ch)) + '٪', chCls: x.ch > 0 ? 'rch rch-up' : 'rch rch-down' }));
  const byWho = {}; cur.forEach((r) => { const w = r.who || r.by; byWho[w] = (byWho[w] || 0) + Number(r.price); });
  const whoRows = Object.entries(byWho).sort((a, b) => b[1] - a[1]).map(([w, v]) => ({ name: WHO[w] || L('غير محدد', 'Unknown'), amt: money(v) }));
  const fixed = sum(cur.filter((r) => r.recurId)), shop = sum(cur.filter((r) => r.kind === 'shop'));
  const diff = ptotal ? Math.round((total - ptotal) / ptotal * 100) : null;
  const monthName = (d) => d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  const budget = h.budget || 0;
  const insight = (() => {
    if (!cur.length) return L('لا توجد مصروفات مسجلة في هذا الشهر', 'No expenses recorded this month');
    const up = cats.find((x) => x.chCls === 'rch rch-up');
    const parts = [];
    if (diff != null) parts.push(diff > 0 ? L('صرفتم ' + num(diff) + '٪ أكثر من ' + monthName(pd), 'You spent ' + diff + '% more than ' + monthName(pd)) : diff < 0 ? L('صرفتم ' + num(-diff) + '٪ أقل من ' + monthName(pd) + ' 👏', 'You spent ' + (-diff) + '% less than ' + monthName(pd)) : L('نفس مصروف الشهر السابق تقريباً', 'About the same as last month'));
    if (up) parts.push(L('أكبر زيادة في «' + up.name + '»', 'Biggest rise: ' + up.name));
    if (budget && total > budget) parts.push(L('تجاوزتم الميزانية بـ ' + money(total - budget), 'Over budget by ' + money(total - budget)));
    return parts.join(L('، و', '; '));
  })();
  return {
    isReport: s.sheet === 'report', openReport: () => c.setState({ sheet: 'report', repOff: 0 }),
    rep: { month: monthName(md), total: money(total), prevTotal: money(ptotal), diffTxt: diff == null ? '' : (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '') + num(Math.abs(diff)) + '٪ ' + L('عن الشهر السابق', 'vs last month'), diffCls: diff == null ? 'rch' : diff > 0 ? 'rch rch-up' : 'rch rch-down', hasDiff: diff != null,
      cats, hasCats: cats.length > 0, dayBars, top, hasTop: top.length > 0, priceCh, hasPriceCh: priceCh.length > 0, whoRows, hasWho: whoRows.length > 1,
      fixed: money(fixed), shop: money(shop), other: money(total - fixed - shop), insight, empty: !cur.length, hasData: cur.length > 0,
      budgetPct: budget ? Math.min(100, Math.round(total / budget * 100)) : 0, budgetTxt: budget ? L('من الميزانية: ', 'Of budget: ') + num(Math.round(total / budget * 100)) + '٪' : '', hasBudget: !!budget,
      prev: () => c.setState({ repOff: (c.state.repOff || 0) + 1 }), next: () => c.setState({ repOff: Math.max(0, (c.state.repOff || 0) - 1) }), canNext: off > 0, days: num(days),
      share: () => {
        const t = [L('تقرير مصروفات ', 'Expense report — ') + monthName(md), L('الإجمالي: ', 'Total: ') + money(total) + (diff != null ? ' (' + (diff > 0 ? '+' : '') + diff + '%)' : ''), '', ...cats.map((x) => x.name + ': ' + x.amt + ' (' + x.share + ')')].join('\n');
        h.shareText(L('تقرير الشهر', 'Monthly report'), t).then((r) => { if (r === 'copied') c.flash(L('نُسخ التقرير', 'Report copied')); });
      } }
  };
}

// ======================================================================
// Shopping analysis: rhythm of repeat items, price changes, stores, monthly trend.
export function shopAnalysisVals(c, h) {
  const { s, L, num, money, isAr, WHO, SC, scName, longDateS } = h;
  const today = iso(new Date());
  const per = s.saPeriod || 3;
  const from = (() => { const d = new Date(); d.setMonth(d.getMonth() - per); return iso(d); })();
  const all = (s.log || []).filter((l) => l.kind === 'shop' && l.price);
  const rows = all.filter((l) => (l.d || '') >= from);
  const baseOf = (l) => (l.base || (l.text || '').split(' – ').pop() || '').trim();
  const norm = (v) => v.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  const sum = (a) => a.reduce((x, r) => x + Number(r.price), 0);
  const total = sum(rows);
  const weeks = Math.max(1, daysBetween(from, today) / 7);
  // per item
  const by = {}; rows.forEach((r) => { const k = norm(baseOf(r)); if (!k) return; (by[k] = by[k] || { name: baseOf(r), list: [] }).list.push(r); });
  const items = Object.values(by).map((x) => ({ ...x, spend: sum(x.list), n: x.list.length }));
  const topSpend = items.slice().sort((a, b) => b.spend - a.spend).slice(0, 6);
  const maxS = Math.max(1, ...topSpend.map((x) => x.spend));
  const topCount = items.slice().sort((a, b) => b.n - a.n).filter((x) => x.n >= 2).slice(0, 6);
  // rhythm (uses full history)
  const byAll = {}; all.forEach((r) => { const k = norm(baseOf(r)); if (!k) return; (byAll[k] = byAll[k] || { name: baseOf(r), cat: r.cat, ds: new Set() }).ds.add(r.d); });
  const openNames = new Set((s.shop || []).filter((x) => !x.done).map((x) => norm((x.name && typeof x.name === 'string' ? x.name : '') || '')));
  const openText = (s.shop || []).filter((x) => !x.done).map((x) => JSON.stringify(x)).join(' ');
  const rhythm = Object.entries(byAll).map(([k, x]) => {
    const ds = [...x.ds].sort(); if (ds.length < 3) return null;
    const gaps = ds.slice(1).map((d, i) => daysBetween(ds[i], d)).filter((g) => g > 0);
    if (gaps.length < 2) return null;
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const next = iso(new Date(new Date(ds[ds.length - 1] + 'T00:00').getTime() + Math.round(avg) * DAY));
    const dueIn = daysBetween(today, next);
    const onList = openNames.has(k) || openText.includes(x.name);
    return { name: x.name, cat: x.cat, every: Math.round(avg), dueIn, onList };
  }).filter(Boolean).sort((a, b) => a.dueIn - b.dueIn);
  const dueSoon = rhythm.filter((r) => r.dueIn <= 3 && !r.onList).slice(0, 6).map((r) => ({
    name: r.name, sub: L('تشتريه كل ' + arCount(r.every, num, 'يوم', 'يومين', 'أيام', 'يوماً') + ' تقريباً', 'every ~' + r.every + ' days') + ' · ' + (r.dueIn < 0 ? L('تأخر عن عادته', 'overdue') : r.dueIn === 0 ? L('عادةً اليوم', 'usually today') : L('خلال ' + arCount(r.dueIn, num, 'يوم', 'يومين', 'أيام', 'يوماً'), 'in ' + r.dueIn + ' days')),
    add: () => { c.setState({ shop: [{ id: Date.now(), name: r.name, desc: '', cat: r.cat || 'super', by: c.myId(), done: false }, ...c.state.shop] }); c.flash(L('أُضيف «' + r.name + '» للقائمة', 'Added “' + r.name + '”')); }
  }));
  const rhythmRows = rhythm.slice(0, 8).map((r) => ({ name: r.name, every: L('كل ' + arCount(r.every, num, 'يوم', 'يومين', 'أيام', 'يوماً'), 'every ' + r.every + ' d') }));
  // price changes (unit price if qty known, else price per purchase)
  const priceCh = Object.values(byAll).map((x) => {
    const k = norm(x.name);
    const list = all.filter((r) => norm(baseOf(r)) === k).sort((a, b) => (a.d || '').localeCompare(b.d || ''));
    const pts = list.map((r) => ({ d: r.d, p: r.qty ? r.price / r.qty : r.price, unit: r.qty ? r.unit : null })).filter((p) => p.p > 0);
    if (pts.length < 2) return null;
    const half = Math.max(1, Math.floor(pts.length / 2));
    const a = pts.slice(0, half).reduce((x2, p) => x2 + p.p, 0) / half, bList = pts.slice(-half), b = bList.reduce((x2, p) => x2 + p.p, 0) / bList.length;
    const ch = Math.round((b - a) / a * 100); if (Math.abs(ch) < 5) return null;
    return { name: x.name, ch, a, b, unit: pts[pts.length - 1].unit };
  }).filter(Boolean).sort((x, y) => y.ch - x.ch).slice(0, 6).map((x) => ({ name: x.name, txt: money(x.a) + ' ← ' + money(x.b) + (x.unit ? L(' للوحدة', '/unit') : ''), chTxt: (x.ch > 0 ? '▲ ' : '▼ ') + num(Math.abs(x.ch)) + '٪', chCls: x.ch > 0 ? 'rch rch-up' : 'rch rch-down' }));
  // stores
  const byCat = {}; rows.forEach((r) => { byCat[r.cat || 'super'] = (byCat[r.cat || 'super'] || 0) + Number(r.price); });
  const maxC = Math.max(1, ...Object.values(byCat));
  const stores = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ name: scName[k] || k, amt: money(v), pct: Math.round(v / maxC * 100), share: num(Math.round(v / (total || 1) * 100)) + '٪', barCls: 'rb rb-' + (i % 6) }));
  // months (last 6)
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return { ym, lbl: d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short' }), v: sum(all.filter((r) => (r.d || '').slice(0, 7) === ym)) }; });
  const maxM = Math.max(1, ...months.map((m) => m.v));
  const mBars = months.map((m, i) => ({ x: (i * 50 + 8).toFixed(1), w: 34, h: Math.round(m.v / maxM * 60), y: 64 - Math.round(m.v / maxM * 60), lbl: m.lbl, val: m.v ? num(Math.round(m.v / 100) / 10) + L('ك', 'k') : '' }));
  const byWho = {}; rows.forEach((r) => { const w = r.who || r.by; byWho[w] = (byWho[w] || 0) + Number(r.price); });
  const whoRows = Object.entries(byWho).sort((a, b) => b[1] - a[1]).map(([w, v]) => ({ name: WHO[w] || L('غير محدد', 'Unknown'), amt: money(v) }));
  const visits = new Set(rows.map((r) => r.d)).size;
  const insights = [];
  if (topSpend[0]) insights.push(L('«' + topSpend[0].name + '» أكثر صنف صرفتم عليه (' + money(topSpend[0].spend) + ')', '“' + topSpend[0].name + '” is your top item (' + money(topSpend[0].spend) + ')'));
  if (priceCh[0] && priceCh[0].chCls.includes('up')) insights.push(L('أكبر زيادة سعر: «' + priceCh[0].name + '» ' + priceCh[0].chTxt, 'Biggest price rise: ' + priceCh[0].name + ' ' + priceCh[0].chTxt));
  if (dueSoon.length) insights.push(L(num(dueSoon.length) + ' أصناف قرب موعد شرائها المعتاد', dueSoon.length + ' items are due by habit'));
  const pts = [3, 6, 12].map((m) => ({ name: L(m === 12 ? 'سنة' : num(m) + ' أشهر', m === 12 ? '1 year' : m + ' months'), cls: per === m ? 'chip-on' : 'chip', sel: () => c.setState({ saPeriod: m }) }));
  return {
    isShopAn: s.sheet === 'shopAn', openShopAn: () => c.setState({ sheet: 'shopAn' }),
    sa: { periods: pts, total: money(total), weekly: money(total / weeks), visits: num(visits), items: num(items.length), empty: rows.length === 0, has: rows.length > 0,
      topSpend: topSpend.map((x) => ({ name: x.name, amt: money(x.spend), n: L(arCount(x.n, num, 'مرة', 'مرتين', 'مرات', 'مرة'), x.n + '×'), pct: Math.round(x.spend / maxS * 100) })), topCount: topCount.map((x) => ({ name: x.name, n: L(arCount(x.n, num, 'مرة', 'مرتين', 'مرات', 'مرة'), x.n + ' times') })), hasTopCount: topCount.length > 0,
      dueSoon, hasDue: dueSoon.length > 0, rhythmRows, hasRhythm: rhythmRows.length > 0, priceCh, hasPriceCh: priceCh.length > 0,
      stores, mBars, whoRows, hasWho: whoRows.length > 1, insights: insights.map((t) => ({ t })), hasInsights: insights.length > 0,
      note: L('التحليل من المشتريات المسجلة بأسعارها. كلما سجّلتم الأسعار والكميات صار أدق.', 'Based on purchases recorded with prices — more prices & quantities make it sharper.') }
  };
}

// ======================================================================
// Medical dossier: per-person folder of results (lab, imaging, reports, prescriptions…) with multi-page photos.
// Each page is its own synced document (keeps every document small).
const DOS_CATS = [['lab', 'تحاليل', 'Lab tests'], ['img', 'أشعة', 'Imaging'], ['visit', 'كشوفات وتقارير', 'Visits & reports'], ['rx', 'روشتات', 'Prescriptions'], ['vax', 'تطعيمات', 'Vaccination'], ['other', 'أخرى', 'Other']];
export function dossierVals(c, h) {
  const { s, L, num, isAr, WHO, PIDS, myId, longDateS, readImage } = h;
  const today = iso(new Date());
  const who = s.dosWho && (PIDS.includes(s.dosWho) || s.dosWho === 'home') ? s.dosWho : null;
  const catName = (k) => { const x = DOS_CATS.find((y) => y[0] === k); return x ? (isAr ? x[1] : x[2]) : k; };
  const pagesOf = (eid) => (s.files || []).filter((f) => f.eid === eid).sort((a, b) => (a.n || 0) - (b.n || 0));
  // entries = dossier items + older medical records that have a photo
  const recMap = { lab: 'lab', img: 'img', visit: 'visit' };
  const fromRecs = (s.records || []).filter((r) => r.img && r.who === who).map((r) => ({ id: 'rec:' + r.id, who: r.who, cat: recMap[r.type] || 'other', title: typeof r.title === 'object' ? (isAr ? r.title.ar : r.title.en) : r.title, d: r.d, note: typeof r.result === 'object' ? (isAr ? r.result.ar : r.result.en) : (r.result || ''), legacy: r }));
  const entries = who ? (s.dossier || []).filter((e) => e.who === who).concat(fromRecs).sort((a, b) => (b.d || '').localeCompare(a.d || '')) : [];
  const cat = s.dosCat || 'all';
  const shown = entries.filter((e) => cat === 'all' || e.cat === cat);
  const pagesFor = (e) => e.legacy ? [{ id: 'leg', img: e.legacy.img }] : pagesOf(e.id);
  const cnt = (k) => entries.filter((e) => k === 'all' || e.cat === k).length;
  const cats = [['all', L('الكل', 'All')]].concat(DOS_CATS.map(([k, ar, en]) => [k, isAr ? ar : en])).filter(([k]) => k === 'all' || cnt(k) > 0)
    .map(([k, n]) => ({ name: n + ' (' + num(cnt(k)) + ')', cls: cat === k ? 'chip-on' : 'chip', sel: () => c.setState({ dosCat: k }) }));
  const rows = shown.map((e) => { const pg = pagesFor(e);
    return { title: e.title || catName(e.cat), sub: (e.d ? longDateS(e.d) : '') + ' · ' + catName(e.cat) + (pg.length > 1 ? L(' · ' + num(pg.length) + ' صفحات', ' · ' + pg.length + ' pages') : ''),
      thumb: pg[0] ? pg[0].img : '', hasThumb: !!pg[0], noThumb: !pg[0], open: () => c.setState({ sheet: 'dosView', dosView: e.id, dosPage: 0 }) }; });
  // viewer
  const ev = s.dosView ? entries.find((e) => e.id === s.dosView) || (s.dossier || []).find((e) => e.id === s.dosView) : null;
  const evPages = ev ? pagesFor(ev) : [];
  const pi = Math.min(s.dosPage || 0, Math.max(0, evPages.length - 1));
  // add form
  const df = s.dosForm || {};
  const setDf = (o) => c.setState({ dosForm: { ...c.state.dosForm, ...o } });
  const addPages = (e, intoEntry) => {
    const files = Array.from((e.target && e.target.files) || []); if (!files.length) return;
    c.flash(L('جارٍ تجهيز الصور…', 'Preparing photos…'), 1200);
    Promise.all(files.map((f) => readImage(f, 1600))).then((imgs) => {
      const ok = imgs.filter(Boolean); if (!ok.length) return;
      if (intoEntry) {
        const start = pagesOf(intoEntry).length;
        c.setState({ files: [...(c.state.files || []), ...ok.map((img, i) => ({ id: 'f' + Date.now() + i, eid: intoEntry, who: (c.state.dossier.find((x) => x.id === intoEntry) || {}).who, n: start + i, img, shared: true }))] });
        c.flash(L('أُضيفت ' + num(ok.length) + ' صفحة', ok.length + ' page(s) added'));
      } else setDf({ pages: [...((c.state.dosForm || {}).pages || []), ...ok] });
    });
  };
  return {
    isDossier: s.sheet === 'dossier', isDosAdd: s.sheet === 'dosAdd', isDosView: s.sheet === 'dosView' && !!ev,
    openDossier: (id) => c.setState({ sheet: 'dossier', dosWho: id, dosCat: 'all' }),
    dos: { name: who ? (WHO[who] || '') : '', cats, rows, has: rows.length > 0, empty: entries.length === 0, count: entries.length,
      add: () => c.setState({ sheet: 'dosAdd', dosForm: { cat: 'lab', title: '', d: today, note: '', pages: [], shared: true } }) },
    dosf: { title: df.title || '', d: df.d || '', note: df.note || '', pages: (df.pages || []).map((img, i) => ({ img, del: () => setDf({ pages: c.state.dosForm.pages.filter((x, j) => j !== i) }) })), hasPages: (df.pages || []).length > 0,
      cats: DOS_CATS.map(([k, ar, en]) => ({ name: isAr ? ar : en, cls: df.cat === k ? 'chip-on' : 'chip', sel: () => setDf({ cat: k }) })),
      visCls: df.shared !== false ? 'vis vis-on' : 'vis vis-off', visTxt: df.shared !== false ? L('ظاهر لكل الأسرة', 'Visible to the family') : L('مخفي — تراه أنت فقط', 'Hidden — only you'), toggleVis: () => setDf({ shared: c.state.dosForm.shared === false }),
      onTitle: (e) => setDf({ title: e.target.value }), onD: (e) => setDf({ d: e.target.value }), onNote: (e) => setDf({ note: e.target.value }), onPages: (e) => addPages(e, null) },
    saveDos: () => {
      const f = c.state.dosForm || {}; if (!(f.pages || []).length && !(f.title || '').trim()) { c.flash(L('أضف صورة أو عنواناً', 'Add a photo or a title')); return; }
      const id = 'dz' + Date.now(), w = c.state.dosWho;
      const entry = { id, who: w, cat: f.cat || 'other', title: (f.title || '').trim() || catName(f.cat), d: f.d || today, note: (f.note || '').trim(), shared: f.shared !== false };
      c.setState({ dossier: [...(c.state.dossier || []), entry], files: [...(c.state.files || []), ...(f.pages || []).map((img, i) => ({ id: 'f' + Date.now() + i, eid: id, who: w, n: i, img, shared: entry.shared }))], sheet: 'dossier', dosForm: null });
      c.flash(L('حُفظ في الملف الطبي', 'Saved to the dossier'));
    },
    dv: ev ? { title: ev.title || catName(ev.cat), sub: (ev.d ? longDateS(ev.d) : '') + ' · ' + catName(ev.cat), note: ev.note || '', hasNote: !!ev.note,
      img: evPages[pi] ? evPages[pi].img : '', hasImg: !!evPages[pi], pageTxt: evPages.length > 1 ? num(pi + 1) + ' / ' + num(evPages.length) : '', multi: evPages.length > 1,
      prev: () => c.setState({ dosPage: Math.max(0, pi - 1) }), next: () => c.setState({ dosPage: Math.min(evPages.length - 1, pi + 1) }),
      share: () => { const p = evPages[pi]; if (!p) return; h.shareImage('baitna-' + (ev.title || 'page').replace(/[^\w؀-ۿ]+/g, '-') + '-' + (pi + 1) + '.jpg', p.img, ev.title).then((ok) => { if (!ok) c.flash(L('المشاركة تعمل في التطبيق على الهاتف', 'Sharing works in the phone app')); }); },
      canEdit: !ev.legacy, addPage: (e) => addPages(e, ev.id),
      delPage: () => { const p = evPages[pi]; if (!p || ev.legacy || !window.confirm(L('حذف هذه الصفحة؟', 'Delete this page?'))) return; c.setState({ files: c.state.files.filter((x) => x.id !== p.id), dosPage: Math.max(0, pi - 1) }); },
      delAll: () => { if (ev.legacy || !window.confirm(L('حذف «' + (ev.title || '') + '» وكل صفحاته؟', 'Delete this item and all its pages?'))) return; c.bulkUntil = Date.now() + 3000;
        c.setState({ dossier: c.state.dossier.filter((x) => x.id !== ev.id), files: c.state.files.filter((x) => x.eid !== ev.id), sheet: 'dossier' }); },
      back: () => c.setState({ sheet: 'dossier' }) } : {},
    dosTitles: { dossier: L('الملف الطبي', 'Medical file') + (who ? ' — ' + (WHO[who] || '') : ''), dosAdd: L('إضافة للملف الطبي', 'Add to dossier'), dosView: ev ? (ev.title || '') : '' },
    dossierCount: (id) => (s.dossier || []).filter((e) => e.who === id).length
  };
}

// ======================================================================
// Daily to-dos: quick personal tasks for the day (private by default, can be handed to a family member).
// ---- priority (urgent / normal / not urgent) + manual order (rk) shared by to-dos and chores ----
const PRI_V = { h: 0, n: 1, l: 2 };
const priOf = (x) => (x.pri === 'h' || x.pri === 'l' ? x.pri : 'n');
const priCmp = (a, b) => PRI_V[priOf(a)] - PRI_V[priOf(b)] || ((typeof a.rk === 'number') && (typeof b.rk === 'number') ? a.rk - b.rk : (typeof a.rk === 'number') ? -1 : (typeof b.rk === 'number') ? 1 : 0);
const PRI_PATH = { h: 'M12 19V5M6 11l6-6 6 6', l: 'M12 5v14M6 13l6 6 6-6', n: 'M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4' };
function priUI(c, x, key, L) {
  const p = priOf(x), open = c.state.priOpen === x.id;
  const setP = (v) => c.setState({ priOpen: null, [key]: c.state[key].map((y) => y.id === x.id ? { ...y, pri: v === 'n' ? null : v } : y) });
  return { id: x.id, priCls: 'pri pri-' + p + (open ? ' pri-open' : ''), priPath: PRI_PATH[p], priOpen: open, rowWrap: 'pw' + (p === 'h' ? ' pw-h' : p === 'l' ? ' pw-l' : ''),
    priLbl: p === 'h' ? L('عاجل', 'Urgent') : p === 'l' ? L('غير مستعجل', 'Not urgent') : L('الأولوية', 'Priority'),
    togglePri: () => c.setState({ priOpen: open ? null : x.id }),
    priOpts: [['h', L('⬆ عاجل', '⬆ Urgent')], ['n', L('عادي', 'Normal')], ['l', L('⬇ غير مستعجل', '⬇ Not urgent')]].map(([v, n]) => ({ name: n, cls: (p === v ? 'chip-on' : 'chip') + ' pri-c pri-c-' + v, sel: () => setP(v) })) };
}
// drop handler: `full` = the list in its current sorted order, `ids` = the visible ids after the drop
function priDrop(c, key, full, ids, moved) {
  const i = ids.indexOf(moved); const byId = new Map(full.map((x) => [x.id, x]));
  const m = byId.get(moved); if (!m) return;
  const A = byId.get(ids[i - 1]), B = byId.get(ids[i + 1]);
  const oldIdx = full.indexOf(m);
  let pri = priOf(m); const pa = A && priOf(A), pb = B && priOf(B);
  if (pri !== pa && pri !== pb) { const up = A ? full.indexOf(A) < oldIdx : true; pri = (up ? (pb || pa) : (pa || pb)) || pri; }
  const rest = full.filter((x) => x.id !== moved);
  const at = A ? rest.indexOf(A) + 1 : B ? rest.indexOf(B) : rest.length;
  rest.splice(at, 0, m);
  const rk = new Map(rest.map((x, j) => [x.id, j]));
  c.setState({ priOpen: null, [key]: c.state[key].map((x) => !rk.has(x.id) ? x : x.id === moved ? { ...x, pri: pri === 'n' ? null : pri, rk: rk.get(x.id) } : x.rk === rk.get(x.id) ? x : { ...x, rk: rk.get(x.id) }) });
}
const PRI_SHEET = (L, cur, set) => [['h', L('⬆ عاجل', '⬆ Urgent')], ['n', L('عادي', 'Normal')], ['l', L('⬇ غير مستعجل', '⬇ Not urgent')]].map(([v, n]) => ({ name: n, cls: ((cur || 'n') === v ? 'chip-on' : 'chip'), sel: () => set({ pri: v }) }));

export function todoVals(c, h) {
  const { s, L, num, isAr, WHO, PIDS, PEOPLE, myId, longDateS } = h;
  const today = iso(new Date()), tomorrow = iso(new Date(Date.now() + DAY));
  const appUser = (id) => id === myId || (PEOPLE || []).some((p) => p.id === id && p.email);
  // mine = assigned to me, or something I wrote for a family member without the app (a child) — I manage it
  const mine = (x) => x.who === myId || (!x.who && x.owner === myId) || ((x.by === myId || x.owner === myId) && x.who && !appUser(x.who));
  const all = (s.todos || []);
  const vis = all.filter((x) => mine(x) && (x.d || today) <= today && (!x.done || x.done === today))
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || priCmp(a, b) || (a.tm || '99').localeCompare(b.tm || '99') || (a.at || 0) - (b.at || 0));
  c._dragH = c._dragH || {}; c._dragH.todo = (ids, moved) => priDrop(c, 'todos', vis.filter((x) => !x.done), ids, moved);
  const later = all.filter((x) => mine(x) && (x.d || today) > today && !x.done).length;
  const upd = (id, o) => c.setState({ todos: c.state.todos.map((x) => x.id === id ? { ...x, ...o } : x) });
  const rows = vis.map((x) => {
    const late = !x.done && (x.d || today) < today;
    const from = x.by && x.by !== myId ? (WHO[x.by] || '') : '';
    return { ...priUI(c, x, 'todos', L), dk: x.done ? '' : x.id, text: x.text, done: !!x.done, ckCls: x.done ? 'ck-on' : 'ck', txtCls: x.done ? 'td-t td-done' : 'td-t',
      tags: [x.who && x.who !== myId ? L('لـ ', 'for ') + (WHO[x.who] || '') : '', x.tm ? '⏰ ' + num(x.tm) : '', late ? L('مؤجلة من ', 'from ') + longDateS(x.d).split('،')[0] : '', from ? L('من ', 'from ') + from : '', x.shared && !from ? '👥' : ''].filter(Boolean).join(' · '),
      hasTags: !!(x.tm || late || from || x.shared || (x.who && x.who !== myId)), lateCls: late ? 'td late' : 'td',
      toggle: () => upd(x.id, { done: x.done ? null : today }),
      edit: () => c.setState({ sheet: 'todo', tdf: { id: x.id, pri: priOf(x), text: x.text, d: x.d || today, tm: x.tm || '', who: x.who || myId } }),
      del: () => c.setState({ todos: c.state.todos.filter((y) => y.id !== x.id) }) };
  });
  const tdf = s.tdf || {};
  const setT = (o) => c.setState({ tdf: { ...c.state.tdf, ...o } });
  const add = () => {
    const txt = (c.state.tdDraft || '').trim(); if (!txt) return;
    c.setState({ todos: [...(c.state.todos || []), { id: 'td' + Date.now(), text: txt, d: today, who: myId, by: myId, done: null, at: Date.now(), shared: false }], tdDraft: '' });
  };
  const doneN = vis.filter((x) => x.done).length;
  return {
    td: { rows, has: rows.length > 0, draft: s.tdDraft || '', onDraft: (e) => c.setState({ tdDraft: e.target.value }), add,
      onKey: (e) => { if (e.key === 'Enter') add(); },
      progress: rows.length ? L(num(doneN) + ' من ' + num(rows.length), doneN + '/' + rows.length) : '', allDone: rows.length > 0 && doneN === rows.length,
      laterTxt: later ? L('+ ' + num(later) + ' لأيام قادمة', '+' + later + ' later') : '', hasLater: later > 0,
      clearDone: () => { c.bulkUntil = Date.now() + 2000; c.setState({ todos: c.state.todos.filter((x) => !(mine(x) && x.done)) }); } },
    isTodo: s.sheet === 'todo',
    tdfv: { text: tdf.text || '', d: tdf.d || today, tm: tdf.tm || '',
      onText: (e) => setT({ text: e.target.value }), onD: (e) => setT({ d: e.target.value }), onTm: (e) => setT({ tm: e.target.value }),
      when: [[today, L('اليوم', 'Today')], [tomorrow, L('غداً', 'Tomorrow')]].map(([d, n]) => ({ name: n, cls: tdf.d === d ? 'chip-on' : 'chip', sel: () => setT({ d }) })),
      who: PIDS.map((id) => ({ name: id === myId ? L('أنا', 'Me') : WHO[id], cls: (tdf.who || myId) === id ? 'chip-on' : 'chip', sel: () => setT({ who: id }) })),
      pri: PRI_SHEET(L, tdf.pri, setT) },
    saveTodo: () => {
      const f = c.state.tdf; const txt = (f.text || '').trim(); if (!txt) return;
      const other = f.who && f.who !== myId;
      c.setState({ todos: c.state.todos.map((x) => x.id === f.id ? { ...x, pri: f.pri && f.pri !== 'n' ? f.pri : null, text: txt, d: f.d || today, tm: f.tm || null, who: f.who || myId, shared: other ? true : !!x.shared } : x), sheet: null });
      if (other && appUser(f.who)) c.flash(L('أُرسلت المهمة إلى ', 'Sent to ') + (WHO[f.who] || ''));
    },
    todoTitle: L('مهمة', 'Task')
  };
}
export function todoReminders(s, myId, ar) {
  const out = [];
  (s.todos || []).forEach((x) => { if (x.done || !x.tm || (x.who && x.who !== myId)) return; const t = new Date((x.d || iso(new Date())) + 'T' + x.tm).getTime(); if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: (ar ? 'مهمة: ' : 'To-do: ') + x.text, body: ar ? 'من مهامك اليوم' : 'From your list today' }); });
  return out;
}

// ======================================================================
// Household chores: one shared list for the whole family. Anyone can add, take ("I'll do it"), and finish.
const DEF_CC = [['clean', '🧹', 'تنظيف', 'Cleaning'], ['fix', '🔧', 'تصليحات', 'Repairs'], ['errand', '🛒', 'مشاوير', 'Errands'], ['laundry', '🧺', 'غسيل وترتيب', 'Laundry & tidying'], ['kids', '🧸', 'الأولاد', 'Kids'], ['other', '📌', 'أخرى', 'Other']];
export function choreVals(c, h) {
  const { s, L, num, isAr, WHO, PIDS, myId, longDateS } = h;
  const today = iso(new Date());
  // categories: the family's own list (synced); until edited, the defaults
  const defCats = DEF_CC.map(([id, em, ar, en], i) => ({ id, emoji: em, name: isAr ? ar : en, order: i }));
  const cats = (s.chcats && s.chcats.length ? s.chcats.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : defCats);
  const catIds = new Set(cats.map((x) => x.id));
  const catOf = (x) => (catIds.has(x.cat) ? x.cat : (catIds.has('other') ? 'other' : (cats[0] || {}).id));
  const catById = (id) => cats.find((x) => x.id === id) || { emoji: '📌', name: L('أخرى', 'Other') };
  const matCats = () => (c.state.chcats && c.state.chcats.length ? c.state.chcats.slice() : defCats.map((x) => ({ ...x, shared: true })));
  const pf = c.myPrefs(); const off = new Set(pf.todayCatsOff || []);
  const all = s.chores || [];
  const upd = (id, o) => c.setState({ chores: c.state.chores.map((x) => x.id === id ? { ...x, ...o } : x) });
  const nm = (id) => id === myId ? L('أنا', 'Me') : (WHO[id] || '');
  const REP = [['none', L('مرة واحدة', 'Once')], ['week', L('كل أسبوع', 'Weekly')], ['month', L('كل شهر', 'Monthly')]];
  const nextDate = (d, r) => { const x = new Date((d || today) + 'T00:00'); if (r === 'week') x.setDate(x.getDate() + 7); else x.setMonth(x.getMonth() + 1); return iso(x); };
  const finish = (x) => {
    const st = { chores: c.state.chores.map((y) => y.id === x.id ? { ...y, done: today, doneBy: myId } : y) };
    if (x.rep && x.rep !== 'none') st.chores.push({ ...x, id: 'ch' + Date.now(), done: null, doneBy: null, claimedBy: null, d: nextDate(x.d || today, x.rep), at: Date.now() });
    c.setState(st);
    if (x.by && x.by !== myId) c.nudge(L('تمّت: ', 'Done: ') + x.text, L('مهام البيت', 'Household tasks'), true);
    c.flash(L('أحسنت! ✓', 'Nice! ✓'));
  };
  const open = all.filter((x) => !x.done && (!x.d || x.d <= iso(new Date(Date.now() + 7 * DAY))))
    .sort((a, b) => priCmp(a, b) || ((a.who === myId || a.claimedBy === myId) ? 0 : 1) - ((b.who === myId || b.claimedBy === myId) ? 0 : 1) || (a.d || '9').localeCompare(b.d || '9') || (a.at || 0) - (b.at || 0));
  const future = all.filter((x) => !x.done && x.d && x.d > iso(new Date(Date.now() + 7 * DAY))).length;
  const mk = (x) => {
    const owner = x.claimedBy || x.who;
    const late = x.d && x.d < today;
    const cc = catById(catOf(x));
    return { ...priUI(c, x, 'chores', L), dk: x.id, emoji: cc.emoji, text: x.text, mineCls: (owner === myId ? 'ch ch-me' : 'ch') + (late ? ' ch-late' : ''),
      ownerTxt: owner ? nm(owner) : L('أي حد', 'Anyone'), ownerCls: owner ? 'pp ' + h.pCls(owner) : 'pp pp-any',
      sub: [x.d ? (late ? L('متأخرة · ', 'late · ') : '') + longDateS(x.d) : '', x.rep && x.rep !== 'none' ? (x.rep === 'week' ? L('🔁 أسبوعياً', '🔁 weekly') : L('🔁 شهرياً', '🔁 monthly')) : '', x.by ? (x.by === myId ? L('أضفتها', 'added by you') : L('أضافها ', 'by ') + nm(x.by)) : ''].filter(Boolean).join(' · '),
      canTake: !owner, take: () => { upd(x.id, { claimedBy: myId }); c.flash(L('هي عليك 💪', 'It’s yours 💪')); },
      done: () => finish(x),
      edit: () => c.setState({ sheet: 'chore', chf: { id: x.id, pri: priOf(x), cat: catOf(x), text: x.text, who: x.who || '', d: x.d || '', rep: x.rep || 'none' } }),
      del: () => { if (window.confirm(L('حذف هذه المهمة؟', 'Delete this task?'))) c.setState({ chores: c.state.chores.filter((y) => y.id !== x.id) }); } };
  };
  const fcat = s.chFilter && (s.chFilter === 'all' || catIds.has(s.chFilter)) ? s.chFilter : 'all';
  const rows = open.filter((x) => fcat === 'all' || catOf(x) === fcat).map(mk);
  const todayRows = open.filter((x) => !off.has(catOf(x))).map(mk);
  const catChips = [{ id: 'all', emoji: '', name: L('الكل', 'All') }].concat(cats).map((g) => { const n = g.id === 'all' ? open.length : open.filter((x) => catOf(x) === g.id).length;
    return { name: (g.emoji ? g.emoji + ' ' : '') + g.name + (n ? ' ' + num(n) : ''), cls: fcat === g.id ? 'chip-on' : 'chip', sel: () => c.setState({ chFilter: g.id }), show: g.id === 'all' || n > 0 }; }).filter((x) => x.show);
  const newCat = s.chNewCat && catIds.has(s.chNewCat) ? s.chNewCat : (fcat !== 'all' ? fcat : (cats.find((x) => x.id === 'other') || cats[0] || {}).id);
  const newCatChips = cats.map((g) => ({ name: g.emoji, title: g.name, cls: newCat === g.id ? 'emc emc-on' : 'emc', sel: () => c.setState({ chNewCat: g.id }) }));
  c._dragH = c._dragH || {};
  c._dragH.chore = (ids, moved) => priDrop(c, 'chores', open, ids, moved);
  c._dragH.chcats = (ids) => { const a = matCats(); c.setState({ chcats: a.map((x) => ({ ...x, order: ids.indexOf(x.id) < 0 ? 99 : ids.indexOf(x.id) })) }); };
  const catRows = cats.map((g, i) => ({ id: g.id, emoji: g.emoji, name: g.name, count: num(all.filter((x) => !x.done && catOf(x) === g.id).length),
    inToday: !off.has(g.id), todayCls: off.has(g.id) ? 'sw' : 'sw sw-on',
    toggleToday: () => { const o = new Set(c.myPrefs().todayCatsOff || []); o.has(g.id) ? o.delete(g.id) : o.add(g.id); c.setPref({ todayCatsOff: [...o] }); },
    onName: (e) => { const v = e.target.value; c.setState({ chcats: matCats().map((x) => x.id === g.id ? { ...x, name: v } : x) }); },
    onEmoji: (e) => { const v = (e.target.value || '').trim(); if (!v) return; c.setState({ chcats: matCats().map((x) => x.id === g.id ? { ...x, emoji: Array.from(v).slice(-2).join('') } : x) }); },
    up: () => { if (!i) return; const a = matCats().sort((p, q) => p.order - q.order); const A = a[i - 1], B = a[i]; c.setState({ chcats: a.map((x) => x.id === A.id ? { ...x, order: B.order } : x.id === B.id ? { ...x, order: A.order } : x) }); },
    down: () => { const a = matCats().sort((p, q) => p.order - q.order); if (i >= a.length - 1) return; const A = a[i], B = a[i + 1]; c.setState({ chcats: a.map((x) => x.id === A.id ? { ...x, order: B.order } : x.id === B.id ? { ...x, order: A.order } : x) }); },
    canDel: g.id !== 'other', delCls: g.id !== 'other' ? 'icb-s' : 'icb-s icb-hid',
    del: () => { if (!window.confirm(L('حذف قسم «' + g.name + '»؟ مهامه تنتقل إلى «أخرى»', 'Delete “' + g.name + '”? Its tasks move to Other'))) return; c.bulkUntil = Date.now() + 2000;
      c.setState({ chcats: matCats().filter((x) => x.id !== g.id), chores: (c.state.chores || []).map((x) => x.cat === g.id ? { ...x, cat: 'other' } : x) }); } }));
  const addCat = () => { const n = (c.state.ccDraft || '').trim(); if (!n) return; const em = (c.state.ccEmoji || '').trim() || '📁';
    const a = matCats(); const ord = Math.max(0, ...a.map((x) => x.order || 0)) + 1;
    c.setState({ chcats: [...a, { id: 'cc' + Date.now(), name: n, emoji: Array.from(em).slice(-2).join(''), order: ord, shared: true }], ccDraft: '', ccEmoji: '' }); c.flash(L('أُضيف قسم «' + n + '»', 'Added “' + n + '”')); };
  const recentDone = all.filter((x) => x.done).sort((a, b) => (b.done || '').localeCompare(a.done || '')).slice(0, 5)
    .map((x) => ({ text: x.text, sub: '✓ ' + nm(x.doneBy) + ' · ' + longDateS(x.done), undo: () => upd(x.id, { done: null, doneBy: null }) }));
  // who did most this month (light, friendly)
  const ym = today.slice(0, 7); const score = {};
  all.filter((x) => x.done && x.done.slice(0, 7) === ym && x.doneBy).forEach((x) => { score[x.doneBy] = (score[x.doneBy] || 0) + 1; });
  const board = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([id, n], i) => ({ name: nm(id), n: num(n), medal: ['🥇', '🥈', '🥉'][i] || '' }));
  const add = () => {
    const t = (c.state.chDraft || '').trim(); if (!t) return;
    c.setState({ chores: [...(c.state.chores || []), { id: 'ch' + Date.now(), cat: newCat, text: t, by: myId, who: null, claimedBy: null, done: null, d: null, rep: 'none', at: Date.now(), shared: true }], chDraft: '' });
  };
  const f = s.chf || {};
  const setF = (o) => c.setState({ chf: { ...c.state.chf, ...o } });
  const mineOpen = open.filter((x) => (x.claimedBy || x.who) === myId).length;
  return {
    ch: { rows, has: rows.length > 0, top: todayRows.slice(0, 4), more: todayRows.length > 4, moreTxt: L('+ ' + num(todayRows.length - 4) + ' مهام أخرى', '+' + (todayRows.length - 4) + ' more'),
      catChips, hasCats: catChips.length > 2, newCatChips, catRows, openCats: () => c.setState({ sheet: 'chcats' }),
      ccDraft: s.ccDraft || '', ccEmoji: s.ccEmoji || '', onCcDraft: (e) => c.setState({ ccDraft: e.target.value }), onCcEmoji: (e) => c.setState({ ccEmoji: e.target.value }), addCat,
      hiddenCatsTxt: off.size ? L('أقسام مخفية من «اليوم»: ', 'Hidden from Today: ') + cats.filter((g) => off.has(g.id)).map((g) => g.emoji + ' ' + g.name).join('، ') : '', hasHiddenCats: off.size > 0,
      count: rows.length ? L(num(rows.length) + ' مفتوحة' + (mineOpen ? ' · ' + num(mineOpen) + ' عليك' : ''), rows.length + ' open' + (mineOpen ? ' · ' + mineOpen + ' yours' : '')) : L('لا توجد مهام مفتوحة 👌', 'Nothing open 👌'),
      draft: s.chDraft || '', onDraft: (e) => c.setState({ chDraft: e.target.value }), onKey: (e) => { if (e.key === 'Enter') add(); }, add,
      recentDone, hasDone: recentDone.length > 0, board, hasBoard: board.length > 1,
      futureTxt: future ? L(num(future) + ' مهام مجدولة لاحقاً', future + ' scheduled later') : '', hasFuture: future > 0,
      goAll: () => c.setState({ tab: 'home', homeSeg: 'chores' }) },
    isChore: s.sheet === 'chore', isChCats: s.sheet === 'chcats',
    chfv: { text: f.text || '', d: f.d || '', onText: (e) => setF({ text: e.target.value }), onD: (e) => setF({ d: e.target.value }),
      who: [['', L('أي حد', 'Anyone')]].concat(PIDS.map((id) => [id, nm(id)])).map(([id, n]) => ({ name: n, cls: (f.who || '') === id ? 'chip-on' : 'chip', sel: () => setF({ who: id }) })),
      rep: REP.map(([k, n]) => ({ name: n, cls: (f.rep || 'none') === k ? 'chip-on' : 'chip', sel: () => setF({ rep: k }) })),
      cats: cats.map((g) => ({ name: g.emoji + ' ' + g.name, cls: f.cat === g.id ? 'chip-on' : 'chip', sel: () => setF({ cat: g.id }) })),
      pri: PRI_SHEET(L, f.pri, setF) },
    saveChore: () => {
      const v = c.state.chf; const t = (v.text || '').trim(); if (!t) return;
      const old = c.state.chores.find((x) => x.id === v.id) || {};
      c.setState({ chores: c.state.chores.map((x) => x.id === v.id ? { ...x, pri: v.pri && v.pri !== 'n' ? v.pri : null, cat: v.cat || x.cat, text: t, who: v.who || null, claimedBy: v.who ? null : x.claimedBy, d: v.d || null, rep: v.rep || 'none' } : x), sheet: null });
      if (v.who && v.who !== myId && v.who !== old.who) c.nudge(L('مهمة لك: ', 'Task for you: ') + t, L('مهام البيت', 'Household tasks'), true);
    },
    choreTitle: L('مهمة للبيت', 'Household task'), chcatsTitle: L('أقسام مهام البيت', 'Task categories')
  };
}
export function choreReminders(s, myId, ar) {
  const out = [];
  (s.chores || []).forEach((x) => { if (x.done || !x.d) return; const owner = x.claimedBy || x.who; if (owner && owner !== myId) return;
    const t = new Date(x.d + 'T10:00').getTime(); if (t > Date.now()) out.push({ at: t, channel: 'reminders', title: (ar ? 'مهمة البيت اليوم: ' : 'Household task today: ') + x.text, body: owner ? (ar ? 'عليك' : 'Yours') : (ar ? 'لم يأخذها أحد بعد' : 'Nobody took it yet') }); });
  return out;
}
