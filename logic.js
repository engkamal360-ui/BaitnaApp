import { DCLogic } from './runtime.js';
import * as S from './sync.js';
import { speak as nSpeak, scheduleTimer, cancelTimer, syncReminders, biometricUnlock, readImage, setupNative } from './native.js';

const STORE = 'baitna.v1';
const PERSIST = ['lang', 'theme', 'userName', 'timers', 'presets', 'appts', 'taken', 'shop', 'history', 'histMonth', 'budget', 'shopView',
  'freq', 'lastQty', 'meds', 'records', 'cards', 'medWho', 'dependents'];
const stable = (o) => JSON.stringify(o, Object.keys(o).sort());
const sjson = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, kk) => { a[kk] = v[kk]; return a; }, {}) : v);
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const monthKey = () => todayISO().slice(0, 7);

export default class Component extends DCLogic {
  constructor(props) {
    super(props);
    const B = (ar, en) => ({ ar, en });
    this.state = {
      lang: null, theme: null, tab: 'today', now: Date.now(), timers: [],
      sheet: null, pick: null, opt: 0, lvl: 0,
      presets: [
        { id: 'egg', name: B('سلق البيض', 'Boiled eggs'), icon: 'egg',
          opts: [{ q: B('بيضة', '1 egg'), n: 1, m: 6 }, { q: B('بيضتان', '2 eggs'), n: 2, m: 6 }, { q: B('٤ بيضات', '4 eggs'), n: 4, m: 7 }, { q: B('٦ بيضات', '6 eggs'), n: 6, m: 8 }],
          levels: [{ name: B('رخو', 'Soft'), add: 0 }, { name: B('متوسط', 'Medium'), add: 2 }, { name: B('ناضج تماماً', 'Hard'), add: 4 }] },
        { id: 'milk', name: B('غلي الحليب', 'Boil milk'), icon: 'bag',
          opts: [{ q: B('كيس · ١ كجم', '1 bag · 1 kg'), n: 1, m: 9 }, { q: B('كيسان · ٢ كجم', '2 bags · 2 kg'), n: 2, m: 14 }, { q: B('٣ أكياس', '3 bags · 3 kg'), n: 3, m: 18 }] },
        { id: 'rice', name: B('أرز', 'Rice'), icon: 'cup',
          opts: [{ q: B('كوب', '1 cup'), n: 1, m: 18 }, { q: B('كوبان', '2 cups'), n: 2, m: 22 }, { q: B('٣ أكواب', '3 cups'), n: 3, m: 25 }] },
        { id: 'pasta', name: B('معكرونة', 'Pasta'), icon: 'pack',
          opts: [{ q: B('كيس', '1 pack'), n: 1, m: 10 }, { q: B('كيسان', '2 packs'), n: 2, m: 12 }] },
        { id: 'tea', name: B('شاي على الموقد', 'Stovetop tea'), icon: 'cup',
          opts: [{ q: B('كوب', '1 cup'), n: 1, m: 3 }, { q: B('كوبان', '2 cups'), n: 2, m: 4 }, { q: B('٤ أكواب', '4 cups'), n: 4, m: 5 }] },
        { id: 'oven', name: B('تسخين الفرن', 'Preheat oven'), icon: 'oven',
          opts: [{ q: B('١٨٠°', '180°'), n: 1, m: 12 }, { q: B('٢٢٠°', '220°'), n: 1, m: 15 }] }
      ],
      appts: [],
      form: { name: '', icon: 'pot', n: 1, m: 10, title: '', cat: 'appt', who: 'me', when: '', shared: true },
      cat: 'all', scope: 'all', taken: {},
      locked: true, openCard: null, face: 'front',
      shop: [],
      history: {}, histMonth: monthKey(), userName: '', cards: [], cardForm: null, dependents: [],
      auth: null, authReady: !S.enabled, family: null, famReady: false, online: navigator.onLine,
      af: { email: '', pw: '', name: '', mode: 'in' }, afErr: '', afBusy: false, famName: '', inviteDraft: '', depDraft: '',
      budget: 8000, showBreak: false, spendOpen: false, shopFilter: 'all',
      freq: { milk: 12, bread: 10, tomato: 9, eggs: 8, chicken: 6, potato: 5, mince: 4, onion: 4, cucumber: 3, rice: 3, cheese: 3, oil: 2, lemon: 2, beef: 2, tea: 2, fish: 1, carrot: 1, cumin: 1, detergent: 1, panadol: 1 },
      lastQty: {}, qSel: null, qQty: 1,
      schedSeg: 'appts', medWho: 'me', recWho: 'all', recType: 'all', medInfo: null,
      meds: [],
      records: [],
      mf: { name: '', dose: '', times: ['09:00'], note: '', who: 'me', shared: false },
      rf: { type: 'lab', title: '', date: '', result: '', who: 'me', shared: false },
      shopView: 'list', editId: null, edit: { name: '', desc: '', cat: 'super', price: '' },
      draft: '', draftDesc: '', draftCat: null, draftPrice: '', priceFor: null, priceDraft: '', toast: ''
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved) PERSIST.forEach((k) => { if (saved[k] !== undefined && !(S.enabled && S.KINDS.includes(k))) this.state[k] = saved[k]; });
    } catch (e) {}
    if (this.state.histMonth !== monthKey()) { this.state.history = {}; this.state.histMonth = monthKey(); }
    this.synced = {}; this.ready = {}; this.unsubs = []; this.fid = null;
  }
  persist() {
    try { const o = {}; PERSIST.forEach((k) => { if (!(S.enabled && S.KINDS.includes(k))) o[k] = this.state[k]; }); localStorage.setItem(STORE, JSON.stringify(o)); }
    catch (e) { this.flash(this.lang() === 'ar' ? 'المساحة ممتلئة: احذف بعض صور البطاقات' : 'Storage full: remove some card photos'); }
  }
  componentDidUpdate() {
    this.pushSync();
    clearTimeout(this.pt); this.pt = setTimeout(() => { this.persist(); this.syncNotes(); }, 300);
  }
  myId() { return (S.enabled && this.state.auth) ? this.state.auth.uid : 'me'; }
  myName() { const f = this.state.family, a = this.state.auth; const p = f && a && (f.people || []).find((x) => x.id === a.uid); return (p && p.name) || (a && a.name) || this.state.userName; }
  startSync() {
    if (!S.enabled) return;
    window.addEventListener('online', () => this.setState({ online: true }));
    window.addEventListener('offline', () => this.setState({ online: false }));
    S.watchAuth((user) => {
      if (this.famUnsub) { this.famUnsub(); this.famUnsub = null; }
      this.stopKinds();
      if (!user) { this.authUser = null; this.setState({ auth: null, authReady: true, family: null, famReady: false }); return; }
      this.authUser = { uid: user.uid, email: (user.email || '').toLowerCase(), name: user.displayName || '' };
      this.setState({ auth: this.authUser, authReady: true, famReady: false });
      this.famUnsub = S.watchFamily(user.email, (fam) => this.onFamily(fam));
    });
  }
  stopKinds() { this.unsubs.forEach((u) => u()); this.unsubs = []; this.fid = null; this.synced = {}; this.ready = {}; }
  onFamily(fam) {
    this.setState({ family: fam, famReady: true });
    if (!fam) { this.stopKinds(); return; }
    const a = this.authUser;
    if (!a) return;
    if (!(fam.people || []).some((p) => p.id === a.uid)) {
      S.updateFamily(fam.id, { people: [...(fam.people || []), { id: a.uid, name: a.name || this.state.userName || a.email.split('@')[0], email: a.email }] }).catch(() => {});
    }
    if (this.fid === fam.id) return;
    this.stopKinds(); this.fid = fam.id;
    S.KINDS.forEach((kind) => {
      this.unsubs.push(S.watchKind(fam.id, a.uid, kind, (items) => {
        this.synced[kind] = new Map(items.map((i) => [String(i.id), sjson(i)]));
        this.ready[kind] = true;
        this.setState({ [kind]: items });
      }));
    });
    this.unsubs.push(S.watchSpend(fam.id, monthKey(), (h) => this.setState({ history: h, histMonth: monthKey() })));
  }
  pushSync() {
    if (!this.fid || !this.authUser) return;
    const uid = this.authUser.uid;
    S.KINDS.forEach((kind) => {
      if (!this.ready[kind]) return;
      const syn = this.synced[kind], seen = new Set();
      (this.state[kind] || []).forEach((it) => {
        const item = { ...it, owner: it.owner || uid, shared: kind === 'shop' ? true : !!it.shared };
        const key = String(item.id), j = sjson(item);
        seen.add(key);
        if (syn.get(key) !== j) { syn.set(key, j); S.putItem(this.fid, kind, item).catch((e) => console.warn('put', e)); }
      });
      [...syn.keys()].forEach((key) => { if (!seen.has(key)) { syn.delete(key); S.delItem(this.fid, kind, key).catch((e) => console.warn('del', e)); } });
    });
  }
  syncNotes() {
    const s = this.state, ar = this.lang() === 'ar', tx = (v) => this.tx(v), list = [];
    s.meds.filter((m) => m.active).forEach((m) => m.times.forEach((tm) => {
      const [h, mi] = tm.split(':').map(Number);
      list.push({ repeatDaily: true, hour: h, minute: mi, channel: 'meds', title: (ar ? 'موعد الدواء: ' : 'Medicine time: ') + tx(m.name), body: tx(m.dose) + (tx(m.note) ? ' — ' + tx(m.note) : '') });
    }));
    s.appts.forEach((a) => {
      if (!a.d) return;
      const at = new Date(a.d + 'T09:00').getTime();
      list.push({ at: at - 86400000, channel: 'reminders', title: (ar ? 'غداً: ' : 'Tomorrow: ') + tx(a.title), body: ar ? 'تذكير بموعد الغد' : 'Reminder for tomorrow' });
      list.push({ at, channel: 'reminders', title: (ar ? 'اليوم: ' : 'Today: ') + tx(a.title), body: ar ? 'تذكير بموعد اليوم' : 'Reminder for today' });
    });
    s.cards.forEach((c) => {
      if (!c.exp) return;
      const at = new Date(c.exp + 'T09:00').getTime() - 30 * 86400000;
      list.push({ at, channel: 'reminders', title: (ar ? 'تنتهي بعد شهر: ' : 'Expires in a month: ') + c.type, body: ar ? 'حان وقت التجديد' : 'Time to renew' });
    });
    syncReminders(list);
  }
  componentDidMount() {
    this.iv = setInterval(() => this.tick(), 500);
    setupNative().then(() => this.syncNotes());
    this.startSync();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setState({ locked: true, openCard: null }); else this.tick(); });
  }
  componentWillUnmount() { clearInterval(this.iv); clearTimeout(this.tt); }
  lang() { return this.state.lang || this.props.lang || 'ar'; }
  tx(v) { return (v && typeof v === 'object') ? (v[this.lang()] || v.ar) : (v || ''); }
  unit() { return 60000; }
  speak(txt) { nSpeak(txt, this.lang()); }
  tick() {
    const now = Date.now(), unit = this.unit(), ar = this.lang() === 'ar';
    let changed = false;
    const timers = this.state.timers.map((t) => {
      const rem = t.endAt - now, n = { ...t }, nm = this.tx(t.name);
      if (rem <= unit && rem > 0 && !t.warned) { n.warned = true; changed = true; this.speak(ar ? 'بقيت دقيقة على ' + nm : 'One minute left on ' + nm); }
      if (rem <= 0 && !t.spoken) { n.spoken = true; changed = true; this.speak(ar ? nm + ' انتهى! ' + nm + ' انتهى!' : nm + ' is done! ' + nm + ' is done!'); }
      return n;
    });
    if (changed) this.setState({ now, timers });
    else if (timers.length || Math.floor(now / 60000) !== Math.floor(this.state.now / 60000)) this.setState({ now });
  }
  icons(kind, n, size) {
    const D = {
      egg: ['M12 2.5c-3.6 0-6.6 5.8-6.6 10.6a6.6 6.6 0 0 0 13.2 0C18.6 8.3 15.6 2.5 12 2.5z', 'M9.3 9c.4-1.3 1-2.4 1.7-3', '#F7E8CC', '#A9783C'],
      bag: ['M7 3h10l1.6 4.5V19a2 2 0 0 1-2 2H7.4a2 2 0 0 1-2-2V7.5z', 'M5.6 7.5h12.8M9 13h6M9 16h4', '#E6F0FA', '#3E6E9E'],
      cup: ['M4.5 8h15l-1.7 10.3a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z', 'M6.2 11.5h11.6', '#F2ECE0', '#7D6A47'],
      pack: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 9l8 8M8 13l4 4M12 8l4 4', '#FBE9D9', '#B4572A'],
      pot: ['M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z', 'M2 10h20M10 7h4', '#E1EEEB', '#0F766E'],
      oven: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M6 9h12v8H6zM8 6h.01M12 6h.01', '#EEEBF6', '#4B3F7A'],
      tomato: ['M12 7c4.4 0 8 2.9 8 6.8S16.4 21 12 21s-8-3.3-8-7.2S7.6 7 12 7z', 'M12 7V4M9 6.5l3 .5 3-.5', '#F26B5B', '#A3271B'],
      potato: ['M6 9c1-4 6-6 10-4s5 7 3 10-7 5-10 3-4-5-3-9z', 'M9 11h.01M14 9h.01M15 14h.01M10 15h.01', '#E8C98E', '#8C5F24'],
      onion: ['M12 4c1 2 6 4 6 9a6 6 0 0 1-12 0c0-5 5-7 6-9z', 'M12 4V2.5M12 9c-1.5 2-1.5 7 0 10M12 9c1.5 2 1.5 7 0 10', '#E9C7D9', '#7E3560'],
      cucumber: ['M5 17c-2-2 0-5 3-8s6-5 8-3c2 2 0 5-3 8s-6 5-8 3z', 'M9 12h.01M12 10h.01M11 14h.01', '#8BC77A', '#2F6B1F'],
      lemon: ['M4 12c0-4 4-7 8-7s8 3 8 7-4 7-8 7-8-3-8-7z', 'M2.5 12H4M20 12h1.5', '#F7DE5E', '#8C720C'],
      carrot: ['M15 6l3 3-10 12c-2 1-3 0-2-2z', 'M15 6l1-3M18 9l3-1M10 13l2 2M8 16l1.5 1.5', '#F39A4B', '#A34A1C'],
      beef: ['M4 13c0-5 5-9 10-8s7 5 6 9-6 6-10 6-6-3-6-7z', 'M9 12c2-1 4-1 6 1M14 9.5h.01', '#E57373', '#8E2525'],
      chicken: ['M15.5 3.5a5 5 0 0 1 5 5c0 4-4 6-7 6l-4 4a2 2 0 1 1-3-1 2 2 0 1 1-1-3l4-4c0-3 2-7 6-7z', 'M13 7c1-1 3-1 4 0', '#F2C27B', '#94591F'],
      mince: ['M5 12c0-3 3-5 7-5s7 2 7 5z', 'M3 12h18l-1.5 5h-15zM8 10h.01M12 9h.01M15 10h.01', '#D9665B', '#7E241C'],
      fish: ['M2 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z', 'M7 11h.01M11 9c1 2 1 4 0 6', '#9CC9E3', '#1B5E78'],
      bread: ['M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8H4z', 'M8 11v4M12 11v4M16 11v4', '#E7B776', '#7E4F1B'],
      rice: ['M7 6l-1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2L17 6zM7 6l2-3h6l2 3', 'M10 13h.01M13 15h.01M12 11h.01', '#F5F1E6', '#6E5D3C'],
      oil: ['M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z', 'M8 12h8', '#F4D96B', '#86690B'],
      cheese: ['M3 10l14-6 4 6v9H3z', 'M3 10h18M8 14h.01M14 16h.01M17 13h.01', '#F7D26A', '#8C6A0C'],
      jar: ['M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z', 'M7 3h10v4H7zM9 13h6', '#E7B98A', '#94491A'],
      pills: ['M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M3 5h18v3H3zM12 11v6M9 14h6', '#E3DBF5', '#5B3590'],
      spray: ['M9 8h6l1 3v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9z', 'M10 8V5h4l3-2M14 5h3', '#CFE0FB', '#2449B0']
    };
    const d = D[kind] || D.pot;
    const cnt = Math.max(1, Math.min(8, n || 1));
    return Array.from({ length: cnt }, (_, i) => ({ k: i, s: size, d1: d[0], d2: d[1], f: d[2], c: d[3] }));
  }
  start(p, o, lvl) {
    const unit = this.unit(), ar = this.lang() === 'ar';
    const level = p.levels ? p.levels[lvl || 0] : null;
    const mins = o.m + (level ? level.add : 0);
    const t = { id: Date.now() + Math.random(), name: p.name, q: o.q, level: level ? level.name : null, icon: p.icon, n: o.n, total: mins * unit, endAt: Date.now() + mins * unit };
    this.setState({ timers: [...this.state.timers, t], sheet: null, pick: null, tab: 'kitchen' });
    this.notifyTimer(t);
    this.flash(ar ? ('بدأ مؤقت ' + this.tx(p.name) + ' — ' + String(mins).replace(/[0-9]/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]) + ' د') : ('Started ' + this.tx(p.name) + ' — ' + mins + ' min'));
  }
  notifyTimer(t) {
    const ar = this.lang() === 'ar', nm = this.tx(t.name);
    scheduleTimer(t, {
      warnTitle: ar ? 'بقيت دقيقة' : 'One minute left', warnBody: ar ? 'بقيت دقيقة على ' + nm : 'One minute left on ' + nm,
      doneTitle: ar ? nm + ' انتهى!' : nm + ' is done!', doneBody: ar ? 'اذهب إلى المطبخ الآن' : 'Go to the kitchen now'
    });
  }
  flash(msg) {
    clearTimeout(this.tt);
    this.setState({ toast: msg });
    this.tt = setTimeout(() => this.setState({ toast: '' }), 1800);
  }
  fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  setForm(patch) { this.setState({ form: { ...this.state.form, ...patch } }); }
  renderVals() {
    const s = this.state, unit = this.unit(), fast = false;
    const lang = this.lang(), isAr = lang === 'ar';
    const L = (a, e) => (isAr ? a : e);
    const tx = (v) => this.tx(v);
    const num = (n) => isAr ? String(n).replace(/[0-9]/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]) : String(n);
    const money = (v) => {
      const r = Math.round(v);
      try { return isAr ? r.toLocaleString('ar-EG') + ' ج.م' : 'EGP ' + r.toLocaleString('en-US'); } catch (e) { return isAr ? r + ' ج.م' : 'EGP ' + r; }
    };
    const theme = s.theme || this.props.theme || 'mint';
    const fam = (S.enabled && s.family) ? s.family : null, myId = this.myId();
    const PEOPLE = fam ? [...(fam.people || []), ...(fam.dependents || [])] : [{ id: 'me', name: s.userName || L('أنا', 'Me') }, ...(s.dependents || [])];
    if (!PEOPLE.some((p) => p.id === myId)) PEOPLE.unshift({ id: myId, name: s.userName || L('أنا', 'Me') });
    const PIDS = PEOPLE.map((p) => p.id);
    const WHO = { home: L('المنزل', 'Home') };
    PEOPLE.forEach((p) => { WHO[p.id] = p.id === myId ? L('أنا', 'Me') : p.name; });
    const budget = fam ? (fam.budget || 8000) : s.budget;

    const T = {
      hello: this.myName() ? L('مرحباً يا ', 'Hi ') + this.myName() : L('مرحباً', 'Hello'), brand: L('بيتنا', 'Baitna'), sync: fam ? (s.online ? L('عائلة ', 'Family: ') + fam.name + L(' · متزامن', ' · synced') : L('غير متصل — ستتم المزامنة لاحقاً', 'Offline — will sync later')) : L('محفوظ على هاتفك', 'Saved on your phone'),
      langBtn: L('EN', 'ع'), langAria: L('Switch to English', 'التحويل إلى العربية'), themeAria: L('تغيير المظهر', 'Change theme'),
      family: L('أفراد المنزل: أنا والزوجة', 'Household: me and my wife'), av1: L('ك', 'K'), av2: L('ز', 'W'),
      date: (() => { try { return new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; } })(),
      statFire: L('على الموقد', 'Cooking'), statMeds: L('أدوية اليوم', 'Meds today'), statWeek: L('مواعيد الأسبوع', 'This week'),
      quick: L('مؤقت سريع', 'Quick timer'), medsTitle: L('أدوية اليوم', "Today's meds"), taken: L('اتاخد', 'Taken'),
      alertLicense: L('تنتهي رخصة قيادتك بعد ٢٥ يوماً', 'Your driving license expires in 25 days'),
      upcoming: L('قريباً', 'Coming up'), all: L('الكل', 'All'), shopPrev: L('نواقص المنزل', 'Running low'), list: L('القائمة', 'List'),
      spentSoFar: L('مصروفات الشهر حتى الآن', 'Spending this month so far'),
      fastNote: L('وضع التجربة: الدقيقة = ٥ ثوانٍ', 'Demo mode: 1 minute = 5 seconds'),
      runningNow: L('يعمل الآن', 'Running now'), stopDone: L('حسناً، أوقِف', 'OK, stop'), addMin: L('+١ د', '+1 min'), cancel: L('إلغاء', 'Cancel'),
      tasks: L('المهام', 'Tasks'), newTask: L('مهمة جديدة', 'New task'), empty: L('لا يوجد شيء هنا. اضغط + للإضافة.', 'Nothing here. Tap + to add.'),
      unlockAria: L('افتح بالبصمة', 'Unlock with fingerprint'), locked: L('البطاقات مقفلة', 'Cards are locked'), lockHint: L('اضغط على البصمة للفتح', 'Tap the fingerprint to unlock'),
      remind30: L('سنذكّرك قبل انتهائها بشهر', "We'll remind you a month before it expires"),
      copy: L('نسخ', 'Copy'), front: L('الوجه', 'Front'), back: L('الظهر', 'Back'),
      monthSpend: L('مصروفات الشهر', 'This month'), byPlace: L('المصروفات حسب المتجر', 'Spending by store'),
      newItem: L('صنف جديد', 'New item'), descPh: L('وصف (اختياري): العلامة التجارية، الحجم، أي ملاحظة', 'Description (optional): brand, size, any note'),
      viewAria: L('طريقة العرض', 'View'), viewGrid: L('عمودان', 'Two columns'), viewList: L('قائمة', 'List'),
      itemName: L('الاسم', 'Name'), descLbl: L('الوصف', 'Description'), descHint: L('مثلاً: علامة تجارية معينة، الحجم، أو اسم المتجر', 'e.g. a brand, the size, which shop'),
      place: L('المتجر', 'Store'), del: L('حذف', 'Delete'),
      segAppts: L('مواعيد', 'Appointments'), segMeds: L('أدوية', 'Medicines'), segRec: L('السجل الطبي', 'Medical record'),
      noMeds: L('لا توجد أدوية هنا', 'No medicines here'), addMed: L('+ دواء جديد', '+ New medicine'), stoppedLink: L('الأدوية المتوقفة ←', 'Stopped medicines →'),
      addRec: L('+ تحليل / أشعة / كشف', '+ Test / scan / visit'),
      mRec: L('تحليل / أشعة / كشف', 'Test / scan / visit'), mRecSub: L('يُحفظ في السجل الطبي', 'Saved to the medical record'),
      medName: L('اسم الدواء', 'Medicine name'), medNamePh: L('مثلاً: كونكور ٥', 'e.g. Concor 5'), dose: L('الجرعة', 'Dose'), dosePh: L('مثلاً: ١ قرص', 'e.g. 1 tablet'),
      times: L('المواعيد اليومية', 'Daily times'), addTime: L('+ موعد آخر', '+ Another time'), medNote: L('ملاحظة', 'Note'), medNotePh: L('مثلاً: بعد الأكل', 'e.g. after food'),
      stopMed: L('أوقفتُ هذا الدواء', 'I stopped this medicine'), stopHint: L('سيختفي من الجدول ويبقى في السجل الطبي', 'It leaves the schedule but stays in the medical record'),
      recDate: L('التاريخ', 'Date'), result: L('النتيجة / ملاحظات', 'Result / notes'), resultPh: L('مثلاً: النتائج طبيعية', 'e.g. all normal'),
      attach: L('إرفاق صورة أو PDF', 'Attach a photo or PDF'),
      addCard: L('+ إضافة بطاقة', '+ Add a card'), noCards: L('لم تُضف أي بطاقة بعد', 'No cards yet'), cardType: L('نوع البطاقة', 'Card type'),
      cardTypePh: L('أو اكتب نوعاً آخر', 'or type another'), cardNum: L('الرقم', 'Number'), cardExp: L('تاريخ الانتهاء (اختياري)', 'Expiry date (optional)'),
      frontPhoto: L('صورة الوجه', 'Front photo'), backPhoto: L('صورة الظهر', 'Back photo'), photoAdded: L('✓ أُضيفت', '✓ added'),
      editCard: L('تعديل', 'Edit'), yourName: L('اسمك', 'Your name'), noDosesToday: L('لا توجد أدوية مسجلة. أضفها من قسم المواعيد ← أدوية.', 'No medicines yet. Add them from Schedule → Medicines.'),
      noUpcoming: L('لا توجد مواعيد قادمة', 'No upcoming appointments'),
      loginTitle: L('تسجيل الدخول', 'Sign in'), signupTitle: L('حساب جديد', 'Create account'), email: L('البريد الإلكتروني', 'Email'),
      password: L('كلمة المرور', 'Password'), yourNameReq: L('اسمك (يظهر لأفراد أسرتك)', 'Your name (shown to your family)'),
      loginBtn: L('دخول', 'Sign in'), signupBtn: L('إنشاء الحساب', 'Create account'), toSignup: L('ليس لديك حساب؟ أنشئ حساباً', 'No account? Create one'),
      toLogin: L('لديك حساب؟ سجّل الدخول', 'Have an account? Sign in'), forgot: L('نسيت كلمة المرور؟', 'Forgot password?'),
      loginHint: L('سجّل ببريدك الإلكتروني ليُشارَك التطبيق بينك وبين أفراد أسرتك', 'Sign in with your email to share the app with your family'),
      famTitle: L('أسرتك', 'Your family'), famCreateHint: L('أنشئ مجموعة لأسرتك، ثم أضف بريد كل فرد من الإعدادات', 'Create your family group, then add each member’s email from Settings'),
      famName: L('اسم الأسرة', 'Family name'), famNamePh: L('مثلاً: أسرة كمال', 'e.g. The Kamal family'), famCreate: L('إنشاء الأسرة', 'Create family'),
      famJoinHint: L('أو اطلب من أحد أفراد أسرتك إضافة بريدك من الإعدادات، وسينضم حسابك تلقائياً:', 'Or ask a family member to add your email in Settings — you will join automatically:'),
      logout: L('تسجيل الخروج', 'Sign out'), loading: L('جارٍ التحميل…', 'Loading…'),
      members: L('أفراد الأسرة', 'Family members'), invitePh: L('بريد فرد جديد', 'New member’s email'), invite: L('إضافة', 'Add'),
      pendingTag: L('بانتظار التسجيل', 'Not joined yet'), depPh: L('فرد بلا حساب (مثلاً: الابن)', 'Member without account (e.g. son)'),
      depHint: L('الأطفال ومن لا يملك هاتفاً: أضفهم بالاسم ليظهروا في خيارات «لمن»', 'Children or anyone without a phone: add them by name for the “For” options'),
      localNote: L('المشاركة غير مفعّلة في هذه النسخة: البيانات محفوظة على هذا الهاتف فقط', 'Sharing is not enabled in this build: data stays on this phone'),
      budgetLbl: L('ميزانية الشهر (ج.م)', 'Monthly budget (EGP)'),
      quickPick: L('اختيار سريع', 'Quick pick'), quickHint: L('الأكثر شراءً أولاً', 'Most bought first'), addPh: L('أضف صنفاً… مثلاً: ١ كجم كفتة', 'Add an item… e.g. 1 kg kofta'), add: L('إضافة', 'Add'),
      willGo: L('سيُضاف إلى:', 'Goes to:'), change: L('— يمكنك تغييره', '— tap to change'),
      pricePh: L('السعر المتوقع (اختياري)', 'Expected price (optional)'), bought: L('تم الشراء', 'Bought'), byLbl: L('أضافه:', 'Added by:'),
      clearDone: L('إزالة ما تم شراؤه من القائمة (يبقى محسوباً في المصروفات)', 'Clear bought items (they stay in spending)'),
      navAria: L('الأقسام', 'Sections'), navToday: L('اليوم', 'Today'), navKitchen: L('المطبخ', 'Kitchen'), navSched: L('المواعيد', 'Schedule'), navCards: L('البطاقات', 'Cards'), navShop: L('المشتريات', 'Shopping'),
      close: L('إغلاق', 'Close'), amount: L('المبلغ بالجنيه', 'Amount in EGP'),
      priceSave: L('حفظ وتأشير', 'Save & check off'), priceSkip: L('تأشير دون سعر', 'Check off without a price'),
      themeIntro: L('اختر المظهر المريح لك، ويمكن لكل فرد في المنزل اختيار مظهر مختلف على هاتفه.', 'Pick the look you like. Everyone at home can choose their own on their phone.'),
      mTask: L('مهمة مطبخ جديدة', 'New kitchen task'), mTaskSub: L('مؤقت بمدة وكمية تحددهما بنفسك', 'A timer with your own time and quantity'),
      mAppt: L('موعد / تطعيم / فاتورة', 'Appointment / vaccine / bill'), mApptSub: L('تذكير بتاريخ محدد، مشترك أو شخصي', 'Dated reminder, shared or personal'),
      mMed: L('دواء', 'Medicine'), mMedSub: L('مواعيد يومية — شخصي افتراضياً', 'Daily times — personal by default'),
      mShop: L('صنف مشتريات', 'Shopping item'), mShopSub: L('يظهر لجميع أفراد المنزل', 'Visible to everyone'),
      qty: L('الكمية', 'Quantity'), addQty: L('+ كمية', '+ Qty'), level: L('درجة النضج', 'Doneness'),
      duration: L('المدة', 'Duration'), durSaved: L('يُحفظ تعديلك للمرة القادمة', 'Your change is saved for next time'), minUnit: L('د', 'min'),
      lessMin: L('إنقاص دقيقة', 'One minute less'), moreMin: L('زيادة دقيقة', 'One minute more'),
      start: L('ابدأ المؤقت', 'Start timer'), alertNote: L('تنبيه صوتي قبل الانتهاء بدقيقة، ومرة أخرى عند الانتهاء', 'Voice alert 1 minute before the end, and again when done'),
      taskName: L('اسم المهمة', 'Task name'), taskPh: L('مثلاً: فول، بطاطس، حساء', 'e.g. beans, potatoes, soup'), shape: L('الأيقونة', 'Icon'),
      lessQty: L('إنقاص الكمية', 'Less'), moreQty: L('زيادة الكمية', 'More'), save: L('حفظ', 'Save'), saveStart: L('حفظ وبدء', 'Save & start'),
      title: L('العنوان', 'Title'), type: L('النوع', 'Type'), forWho: L('لمن', 'For'), visibility: L('من يمكنه رؤيته', 'Who can see it'),
      sharedWife: L('مشترك مع الأسرة', 'Shared with family'), privateMe: L('شخصي لي فقط', 'Just me')
    };

    const tabs = ['today', 'kitchen', 'sched', 'cards', 'shop'];
    const nav = {}, go = {};
    tabs.forEach((k) => { nav[k] = s.tab === k ? 'nb-on' : 'nb'; go[k] = () => this.setState({ tab: k }); });

    const themeList = [
      ['mint', L('نعناع', 'Mint'), L('فاتح وهادئ', 'Light and calm')], ['night', L('ليل', 'Night'), L('داكن ومريح للعين', 'Dark, easy on the eyes')],
      ['sand', L('رملي', 'Sand'), L('دافئ بدرجات البني', 'Warm browns')], ['ocean', L('بحري', 'Ocean'), L('أزرق ونظيف', 'Clean blue')]
    ];
    const themes = themeList.map(([id, name, desc]) => ({
      name, desc, miniCls: 'mini th-' + id, cardCls: theme === id ? 'thc-on' : 'thc',
      sel: () => { this.setState({ theme: id }); this.flash(L('تم تغيير المظهر إلى ', 'Theme: ') + name); }
    }));

    const timers = s.timers.map((t) => {
      const rem = Math.max(0, t.endAt - s.now), done = rem <= 0, warn = !done && rem <= unit;
      const frac = Math.min(1, Math.max(0, 1 - rem / t.total));
      return {
        label: tx(t.name) + ' · ' + tx(t.q) + (t.level ? ' · ' + tx(t.level) : ''),
        icons: this.icons(t.icon, t.n, 18), iconsS: this.icons(t.icon, Math.min(t.n, 3), 16),
        clock: done ? '0:00' : this.fmt(rem / unit * 60),
        off: (194.8 * (1 - frac)).toFixed(1),
        ringCls: warn || done ? 'ring-warn' : 'ring-ok',
        done, running: !done,
        cls: done ? 'tm-d' : (warn ? 'tm-w' : 'tm'),
        status: done ? L('انتهى! اذهب إلى المطبخ', 'Done! Go to the kitchen') : (warn ? L('بقي أقل من دقيقة', 'Less than a minute left') : L('يعمل', 'Running')),
        stop: () => { cancelTimer(t.id); this.setState({ timers: this.state.timers.filter((x) => x.id !== t.id) }); },
        addMin: () => {
          const nt = this.state.timers.map((x) => x.id === t.id ? { ...x, endAt: Math.max(x.endAt, Date.now()) + unit, total: x.total + unit, warned: false, spoken: false } : x);
          this.setState({ timers: nt }); cancelTimer(t.id).then(() => this.notifyTimer(nt.find((x) => x.id === t.id)));
        }
      };
    });
    const doneCount = timers.filter((t) => t.done).length;
    const heroLine = timers.length === 0 ? L('لا شيء على الموقد', 'Nothing on the stove')
      : (doneCount > 0 ? L('انتهى أحد المؤقتات! اذهب إلى المطبخ', "Something's done! Go to the kitchen")
        : (isAr ? num(timers.length) + ' على الموقد الآن' : timers.length + (timers.length === 1 ? ' thing cooking now' : ' things cooking now')));

    const presetsFind = (id) => this.state.presets.find((x) => x.id === id);
    const quick = [
      { name: L('بيضتان رخوتان', '2 soft-boiled eggs'), sub: L('٦ دقائق', '6 minutes'), icons: this.icons('egg', 2, 26), go: () => { const p = presetsFind('egg'); this.start(p, p.opts[1], 0); } },
      { name: L('حليب، كيس (١ كجم)', 'Milk, 1 bag (1 kg)'), sub: L('٩ دقائق', '9 minutes'), icons: this.icons('bag', 1, 26), go: () => { const p = presetsFind('milk'); this.start(p, p.opts[0], 0); } }
    ];

    const presets = s.presets.map((p) => {
      const ms = p.opts.map((o) => o.m), lo = Math.min(...ms), hi = Math.max(...ms);
      return {
        name: tx(p.name), icons: this.icons(p.icon, 1, 26), tileCls: 'tile k-' + p.icon,
        range: (lo === hi ? num(lo) : num(lo) + '–' + num(hi)) + ' ' + L((hi > 2 && hi <= 10) ? 'دقائق' : 'دقيقة', 'min'),
        pick: () => this.setState({ pick: p.id, opt: Math.min(1, p.opts.length - 1), lvl: 0, sheet: 'pick' })
      };
    });
    const pp = s.presets.find((p) => p.id === s.pick);
    const curOpt = pp ? pp.opts[Math.min(s.opt, pp.opts.length - 1)] : null;
    const pick = pp ? {
      bigIcons: this.icons(pp.icon, curOpt.n, curOpt.n > 4 ? 32 : 40),
      min: num(curOpt.m + (pp.levels ? pp.levels[s.lvl].add : 0)),
      opts: pp.opts.map((o, i) => ({ q: tx(o.q), icons: this.icons(pp.icon, o.n, o.n > 3 ? 13 : 17), cls: i === s.opt ? 'qty-on' : 'qty', sel: () => this.setState({ opt: i }) })),
      hasLevels: !!pp.levels,
      levels: (pp.levels || []).map((l, i) => ({ name: tx(l.name), cls: i === s.lvl ? 'chip-on' : 'chip', sel: () => this.setState({ lvl: i }) }))
    } : { bigIcons: [], min: '', opts: [], hasLevels: false, levels: [] };
    const editPreset = (fn) => this.setState({ presets: this.state.presets.map((p) => p.id !== this.state.pick ? p : fn(p)) });
    const adjust = (d) => editPreset((p) => ({ ...p, opts: p.opts.map((o, i) => i === this.state.opt ? { ...o, m: Math.max(1, o.m + d) } : o) }));
    const qtyLabel = (n) => ({ ar: 'الكمية ' + String(n).replace(/[0-9]/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]), en: 'Qty ' + n });

    const catIcon = {
      vax: 'M18 2l4 4M20 4l-9.5 9.5M15 5l4 4M8 12l4 4M5.5 14.5l4 4L7 21H3v-4z',
      med: 'M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7zM7 10l7 7',
      bill: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
      appt: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4'
    };
    const decorate = (x) => ({
      id: x.id, title: tx(x.title), who: WHO[x.who] || x.who, cat: x.cat,
      when: x.d ? (() => { try { return new Date(x.d + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return x.d; } })() : tx(x.when),
      bCls: x.shared ? 'b-s' : 'b-p', bTxt: x.shared ? L('مشترك', 'Shared') : L('شخصي', 'Personal'),
      tileCls: 'tile cat-' + x.cat, icon: catIcon[x.cat], isMed: x.cat === 'med'
    });
    const takeFn = (id) => () => this.setState({ taken: { ...this.state.taken, [id]: !this.state.taken[id] } });
    const items = s.appts.slice().sort((a, b) => (a.d || '9').localeCompare(b.d || '9'))
      .filter((x) => s.cat === 'all' || x.cat === s.cat)
      .filter((x) => s.scope === 'all' || (s.scope === 'shared') === x.shared)
      .map((x) => {
        const tk = !!s.taken[x.id];
        return { ...decorate(x), tCls: tk ? 't1 strike' : 't1', takeCls: tk ? 'btn-g' : 'btn', takeTxt: tk ? L('تم ✓ — تراجع', 'Taken ✓ — undo') : L('تم تناوله', 'Mark as taken'), take: takeFn(x.id),
          del: () => { if (!window.confirm(L('حذف هذا الموعد؟', 'Delete this appointment?'))) return; this.setState({ appts: this.state.appts.filter((y) => y.id !== x.id) }); } };
      });
    // ---- الأدوية والسجل الطبي ----
    const INIT = { home: L('م', 'H') };
    PEOPLE.forEach((p) => { INIT[p.id] = (p.name || '?').trim().charAt(0).toUpperCase(); });
    const byCls = (w) => 'by by-' + (w === myId ? 'me' : (PEOPLE.find((p) => p.id === w) || {}).email ? 'wife' : 'son');
    const TD = todayISO();
    const isTaken = (m, tm) => !!(m.takenOn && m.takenOn[TD] && m.takenOn[TD][tm]);
    const fmtTime = (hm) => {
      const [h, m] = hm.split(':').map(Number), h12 = ((h + 11) % 12) + 1;
      const mm = (m < 10 ? '0' : '') + m;
      return isAr ? num(h12) + ':' + num(mm) + ' ' + (h < 12 ? 'ص' : 'م') : h12 + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM');
    };
    const fmtDate = (iso) => { try { return new Date(iso + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; } };
    const nowD = new Date(), nowHM = (nowD.getHours() < 10 ? '0' : '') + nowD.getHours() + ':' + (nowD.getMinutes() < 10 ? '0' : '') + nowD.getMinutes();
    const allDoses = s.meds.filter((m) => m.active).flatMap((m) => m.times.map((tm) => ({ m, tm }))).sort((a, b) => a.tm.localeCompare(b.tm));
    const nextKey = (() => { const n = allDoses.find((x) => x.tm >= nowHM && !isTaken(x.m, x.tm)); return n ? n.m.id + '@' + n.tm : null; })();
    const doseRow = ({ m, tm }) => {
      const key = m.id + '@' + tm, tk = isTaken(m, tm), nx = key === nextKey;
      return {
        tk, ckCls: tk ? 'ck-on' : 'ck', name: tx(m.dose) + ' – ' + tx(m.name), nameCls: tk ? 'it-name-done' : 'it-name',
        note: tx(m.note), hasNote: !!tx(m.note), time: fmtTime(tm), timeCls: nx ? 'tchip-next' : 'tchip',
        boxCls: tk ? 'it-done' : (nx ? 'it-next' : 'it'), byInit: INIT[m.who], byCls: byCls(m.who), whoName: WHO[m.who],
        take: () => this.setState({ meds: this.state.meds.map((mm) => mm.id === m.id ? { ...mm, takenOn: { [TD]: { ...((mm.takenOn || {})[TD] || {}), [tm]: !tk } } } : mm) }),
        open: () => this.setState({ sheet: 'medInfo', medInfo: m.id })
      };
    };
    const todayDoses = allDoses.map(doseRow);
    const meds = todayDoses;
    const medWho = (s.medWho === 'me' || !(s.medWho === 'all' || PIDS.includes(s.medWho))) ? myId : s.medWho;
    const medDoses = allDoses.filter((x) => medWho === 'all' || x.m.who === medWho);
    const periods = [['m', L('الصباح', 'Morning'), (h) => h < 12], ['a', L('الظهر والعصر', 'Afternoon'), (h) => h >= 12 && h < 17], ['n', L('المساء', 'Evening'), (h) => h >= 17]];
    const medGroups = periods.map(([k, name, fn]) => {
      const ds = medDoses.filter((x) => fn(Number(x.tm.split(':')[0])));
      const done = ds.filter((x) => isTaken(x.m, x.tm)).length;
      return { name, doses: ds.map(doseRow), prog: L('تم ' + num(done) + '/' + num(ds.length), done + '/' + ds.length + ' taken'), n: ds.length };
    }).filter((g) => g.n > 0);
    const whoChips = (cur, key, withAll) => (withAll ? [['all', L('الكل', 'All')]] : []).concat(PEOPLE.map((p) => [p.id, WHO[p.id]]))
      .map(([k, n]) => ({ name: n, cls: cur === k ? 'chip-on' : 'chip', sel: () => this.setState({ [key]: k }) }));
    const RT = {
      lab: [L('تحليل', 'Lab test'), 'M9 3h6M10 3v7l-5 9a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5-9V3M7.5 15h9', 'cat-vax'],
      img: [L('أشعة', 'Imaging'), 'M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M8 12h8M12 8v8', 'cat-appt'],
      visit: [L('كشف', 'Doctor visit'), 'M6 3v6a4 4 0 0 0 8 0V3M10 13v3a4 4 0 0 0 8 0v-2M18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'cat-bill'],
      med: [L('دواء', 'Medicine'), 'M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7zM7 10l7 7', 'cat-med']
    };
    const recAll = s.records.map((r) => ({ id: r.id, img: r.img || '', type: r.type, who: r.who, d: r.d, title: tx(r.title), desc: tx(r.result) }))
      .concat(s.meds.map((m) => ({
        id: 'med:' + m.id, img: '', type: 'med', who: m.who, d: m.sd, title: tx(m.name) + ' (' + tx(m.dose) + ')',
        desc: m.active ? L('مستمر من ' + fmtDate(m.sd), 'Ongoing since ' + fmtDate(m.sd)) : L('من ' + fmtDate(m.sd) + ' إلى ' + fmtDate(m.ed), fmtDate(m.sd) + ' – ' + fmtDate(m.ed)) + (tx(m.note) ? ' — ' + tx(m.note) : '')
      })));
    const recList = recAll.filter((r) => (s.recWho === 'all' || r.who === s.recWho) && (s.recType === 'all' || r.type === s.recType))
      .sort((a, b) => b.d.localeCompare(a.d))
      .map((r) => ({ ...r, open: () => this.setState({ sheet: 'recView', recView: r.id }), date: fmtDate(r.d) + (r.img ? L(' · صورة', ' · photo') : ''), icon: RT[r.type][1], tileCls: 'tile-xs ' + RT[r.type][2], byInit: INIT[r.who], byCls: byCls(r.who), whoName: WHO[r.who] }));
    const rvR = recAll.find((r) => r.id === s.recView);
    const rv = rvR ? {
      title: rvR.title, desc: rvR.desc, meta: RT[rvR.type][0] + ' · ' + (WHO[rvR.who] || '') + ' · ' + fmtDate(rvR.d),
      img: rvR.img, hasImg: !!rvR.img, canDel: rvR.type !== 'med',
      del: () => { if (!window.confirm(L('حذف هذا السجل؟', 'Delete this record?'))) return; this.setState({ records: this.state.records.filter((x) => x.id !== rvR.id), sheet: null }); }
    } : { title: '', desc: '', meta: '', img: '', hasImg: false, canDel: false };
    const recTypeChips = [['all', L('الكل', 'All')]].concat(Object.keys(RT).map((k) => [k, RT[k][0]]))
      .map(([k, n]) => ({ name: n, cls: s.recType === k ? 'chip-on' : 'chip', sel: () => this.setState({ recType: k }) }));
    const segs = [['appts', T.segAppts], ['meds', T.segMeds], ['rec', T.segRec]].map(([k, n]) => ({ name: n, cls: s.schedSeg === k ? 'sg-on' : 'sg', sel: () => this.setState({ schedSeg: k }) }));
    const mf = s.mf, rf = s.rf;
    const mfTimes = mf.times.map((v, i) => ({ v, canDel: mf.times.length > 1,
      set: (e) => this.setState({ mf: { ...this.state.mf, times: this.state.mf.times.map((x, j) => j === i ? e.target.value : x) } }),
      del: () => this.setState({ mf: { ...this.state.mf, times: this.state.mf.times.filter((x, j) => j !== i) } }) }));
    const setMf = (o) => this.setState({ mf: { ...this.state.mf, ...o } });
    const setRf = (o) => this.setState({ rf: { ...this.state.rf, ...o } });
    const mInfo = s.meds.find((m) => m.id === s.medInfo);
    const mi = mInfo ? {
      title: tx(mInfo.dose) + ' – ' + tx(mInfo.name),
      line1: L('المواعيد: ', 'Times: ') + mInfo.times.map(fmtTime).join(L('، ', ', ')),
      line2: (WHO[mInfo.who]) + ' · ' + (mInfo.shared ? L('مشترك', 'Shared') : L('شخصي', 'Personal')) + (tx(mInfo.note) ? ' · ' + tx(mInfo.note) : ''),
      line3: L('بدأ من ', 'Started ') + fmtDate(mInfo.sd)
    } : { title: '', line1: '', line2: '', line3: '' };
    const catList = [['all', L('الكل', 'All')], ['vax', L('تطعيمات', 'Vaccines')], ['bill', L('فواتير وتجديدات', 'Bills & renewals')], ['appt', L('مواعيد', 'Appointments')]];
    const cats = catList.map(([k, n]) => ({ name: n, cls: s.cat === k ? 'chip-on' : 'chip', sel: () => this.setState({ cat: k }) }));
    const scList = [['all', L('الكل', 'All')], ['shared', L('المشترك', 'Shared')], ['private', L('الشخصي', 'Personal')]];
    const scopes = scList.map(([k, n]) => ({ name: n, cls: s.scope === k ? 'chip-on' : 'chip', sel: () => this.setState({ scope: k }) }));
    const upcoming = s.appts.filter((x) => x.d && x.d >= todayISO()).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3).map(decorate);
    const busy = new Set(s.appts.filter((x) => x.d).map((x) => x.d));
    const dn = isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      return { name: dn[d.getDay()], num: num(d.getDate()), cls: i === 0 ? 'day-on' : 'day', dot: busy.has(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) ? 'dd' : 'dd-no' };
    });

    const daysTo = (iso) => Math.round((new Date(iso + 'T00:00') - new Date(todayISO() + 'T00:00')) / 86400000);
    const expTxt = (iso) => {
      if (!iso) return L('بلا تاريخ انتهاء', 'No expiry');
      const n = daysTo(iso);
      if (n < 0) return L('منتهية منذ ' + num(-n) + ' يوماً', 'Expired ' + (-n) + ' days ago');
      if (n <= 60) return L('تنتهي بعد ' + num(n) + ' يوماً', 'Expires in ' + n + ' days');
      try { return L('تنتهي ', 'Expires ') + new Date(iso + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' }); } catch (e) { return iso; }
    };
    const cards = s.cards.map((k) => {
      const img = s.face === 'front' ? k.front : k.back;
      return {
        id: k.id, type: k.type, num: k.num || '—', who: WHO[k.who] || k.who, expiry: expTxt(k.exp), alert: !!k.exp && daysTo(k.exp) <= 30,
        bCls: k.shared ? 'b-s' : 'b-p', bTxt: k.shared ? L('مشترك', 'Shared') : L('شخصي', 'Personal'), isOpen: s.openCard === k.id,
        img: img || '', hasImg: !!img, noImg: !img,
        open: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ openCard: this.state.openCard === k.id ? null : k.id, face: 'front' }); },
        copy: () => { try { navigator.clipboard.writeText(k.num || ''); } catch (e) {} this.flash(L('تم نسخ الرقم', 'Number copied')); },
        edit: () => this.setState({ sheet: 'card', cardForm: { ...k } }),
        del: () => { if (!window.confirm(L('حذف هذه البطاقة؟', 'Delete this card?'))) return; this.setState({ cards: this.state.cards.filter((x) => x.id !== k.id), openCard: null }); }
      };
    });
    const cardAlerts = s.cards.filter((k) => k.exp && daysTo(k.exp) <= 30).map((k) => ({
      text: (daysTo(k.exp) < 0 ? L('انتهت صلاحية ', 'Expired: ') : L('قريباً تنتهي: ', 'Expiring soon: ')) + k.type + ' (' + (WHO[k.who] || '') + ') — ' + expTxt(k.exp)
    }));
    const cf = s.cardForm || { type: '', who: myId, num: '', exp: '', front: '', back: '', shared: false };
    const setCf = (o) => this.setState({ cardForm: { ...(this.state.cardForm || cf), ...o } });
    const pickImg = (side) => (e) => { const f = e.target.files && e.target.files[0]; readImage(f).then((d) => { if (d) setCf({ [side]: d }); }); };

    // ---- المشتريات + المصروف ----
    const SC = [
      ['super', L('سوبرماركت', 'Supermarket'), 'M3 4h2l2.4 11h11L21 8H6.2M9 20h.01M18 20h.01'],
      ['veg', L('خضروات وفواكه', 'Fruit & veg'), 'M7 21c-2-2-2-6 1-9l6-6 4 4-6 6c-3 3-7 3-9 1zM14 6l2-3M18 10l3-2'],
      ['meat', L('لحوم ودواجن', 'Butcher & poultry'), 'M15.5 3.5a5 5 0 0 1 5 5c0 4-4 6-7 6l-4 4a2 2 0 1 1-3-1 2 2 0 1 1-1-3l4-4c0-3 2-7 6-7z'],
      ['fish', L('أسماك', 'Fish'), 'M2 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3zM7 11h.01'],
      ['spice', L('عطارة', 'Spice shop'), 'M8 3h8v3H8zM6 6h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9 12h6'],
      ['pharm', L('صيدلية', 'Pharmacy'), 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
      ['clean', L('منظفات', 'Cleaning'), 'M9 8h6l1 3v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9zM10 8V5h4l3-2M14 5h3']
    ];
    const scName = {}; SC.forEach(([id, n]) => { scName[id] = n; });
    const guessCat = (raw) => {
      const txt = (raw || '').toLowerCase();
      const rules = [
        ['meat', ['دجاج', 'لحم بقري', 'لحم', 'كفت', 'فراخ', 'فرخ', 'كبد', 'سجق', 'بانيه', 'وراك', 'مفروم', 'meat', 'beef', 'chicken', 'kofta', 'mince', 'liver', 'sausage']],
        ['fish', ['سمك', 'جمبري', 'بلطي', 'بوري', 'تونة', 'سبيط', 'fish', 'shrimp', 'tuna', 'salmon', 'squid']],
        ['veg', ['خضروات', 'فواكه', 'ثوم', 'طماطم', 'خيار', 'بطاطس', 'بصل', 'توم', 'جزر', 'فاكهة', 'موز', 'تفاح', 'برتقال', 'فلفل رومي', 'خس', 'ليمون', 'كوسة', 'باذنجان', 'خضار', 'tomato', 'cucumber', 'potato', 'onion', 'garlic', 'carrot', 'fruit', 'banana', 'apple', 'orange', 'lemon', 'lettuce', 'veg']],
        ['spice', ['توابل', 'بهارات', 'كمون', 'بهار', 'فلفل أسود', 'كركم', 'شطة', 'قرفة', 'ينسون', 'كزبرة', 'عطار', 'حبهان', 'cumin', 'spice', 'pepper', 'turmeric', 'cinnamon', 'cardamom', 'coriander', 'nuts']],
        ['pharm', ['دواء', 'أقراص', 'دوا', 'بنادول', 'شراب', 'فيتامين', 'كريم', 'مرهم', 'برشام', 'حفاض', 'بامبرز', 'صيدل', 'medicine', 'panadol', 'syrup', 'vitamin', 'cream', 'diaper', 'pills']],
        ['clean', ['صابون', 'كلور', 'مسحوق', 'منظف', 'ديتول', 'فيري', 'مناديل', 'سفنج', 'شامبو', 'soap', 'bleach', 'detergent', 'dettol', 'tissue', 'sponge', 'shampoo']]
      ];
      for (const [cat, words] of rules) if (words.some((w) => txt.includes(w))) return cat;
      return 'super';
    };
    const draftCat = s.draftCat || guessCat(s.draft);
    const spentBy = {}; SC.forEach(([id]) => { spentBy[id] = s.history[id] || 0; });
    s.shop.forEach((x) => { if (x.done && x.price) spentBy[x.cat] = (spentBy[x.cat] || 0) + Number(x.price); });
    const spent = Object.values(spentBy).reduce((a, b) => a + b, 0);
    const maxCat = Math.max(1, ...Object.values(spentBy));
    const breakdown = SC.map(([id, name, icon]) => ({ id, name, icon, amt: spentBy[id] || 0 }))
      .filter((b) => b.amt > 0).sort((a, b) => b.amt - a.amt)
      .map((b) => ({ ...b, amtTxt: money(b.amt), pct: Math.round(b.amt / maxCat * 100), pctTxt: num(Math.round(b.amt / spent * 100)) + L('٪', '%'), tileCls: 'tile-s sc-' + b.id, barCls: 'bar-svg sc-' + b.id }));
    const budgetPct = Math.min(100, Math.round(spent / budget * 100));
    const budgetLine = spent <= budget
      ? L('من ميزانية ' + money(budget) + ' — المتبقي ' + money(budget - spent), 'of a ' + money(budget) + ' budget — ' + money(budget - spent) + ' left')
      : L('تجاوزت الميزانية بمقدار ' + money(spent - budget), 'Over budget by ' + money(spent - budget));
    const toggleItem = (it) => () => {
      if (it.done) { this.setState({ shop: this.state.shop.map((x) => x.id === it.id ? { ...x, done: false } : x) }); return; }
      this.setState({ sheet: 'price', priceFor: it.id, priceDraft: it.price ? String(it.price) : '' });
    };
    const shopCats = SC.filter(([id]) => s.shop.some((x) => x.cat === id));
    const shopFilters = [['all', L('الكل', 'All')]].concat(shopCats.map(([id, n]) => [id, n])).map(([k, n]) => ({
      name: k === 'all' ? n : n + ' (' + num(s.shop.filter((x) => x.cat === k && !x.done).length) + ')',
      cls: s.shopFilter === k ? 'chip-on' : 'chip', sel: () => this.setState({ shopFilter: k })
    }));
    const UNITS = {
      kg: ['كجم', 'kg', 'kg'], bag: ['كيس', 'bag', 'bags'], tray: ['طبق', 'tray', 'trays'], loaf: ['رغيف', 'loaf', 'loaves'],
      bottle: ['زجاجة', 'bottle', 'bottles'], pack: ['عبوة', 'pack', 'packs'], bird: ['دجاجة', 'chicken', 'chickens'], g: ['غرام', 'g', 'g'], box: ['علبة', 'box', 'boxes']
    };
    const CAT = [
      ['tomato', 'طماطم', 'Tomatoes', 'veg', 'kg', 0.5, 2, 'tomato'], ['potato', 'بطاطس', 'Potatoes', 'veg', 'kg', 0.5, 2, 'potato'],
      ['onion', 'بصل', 'Onions', 'veg', 'kg', 0.5, 1, 'onion'], ['cucumber', 'خيار', 'Cucumbers', 'veg', 'kg', 0.5, 1, 'cucumber'],
      ['lemon', 'ليمون', 'Lemons', 'veg', 'kg', 0.25, 0.5, 'lemon'], ['carrot', 'جزر', 'Carrots', 'veg', 'kg', 0.5, 1, 'carrot'],
      ['beef', 'لحم بقري', 'Beef', 'meat', 'kg', 0.5, 1, 'beef'], ['mince', 'لحم مفروم', 'Minced beef', 'meat', 'kg', 0.25, 1, 'mince'],
      ['chicken', 'دجاج', 'Chicken', 'meat', 'kg', 0.5, 1.5, 'chicken'], ['fish', 'سمك بلطي', 'Tilapia', 'fish', 'kg', 0.5, 1, 'fish'],
      ['milk', 'حليب', 'Milk', 'super', 'bag', 1, 2, 'bag'], ['eggs', 'بيض', 'Eggs', 'super', 'tray', 1, 1, 'egg'],
      ['bread', 'خبز', 'Bread', 'super', 'loaf', 5, 10, 'bread'], ['rice', 'أرز', 'Rice', 'super', 'kg', 1, 2, 'rice'],
      ['cheese', 'جبن أبيض', 'White cheese', 'super', 'kg', 0.25, 0.5, 'cheese'], ['oil', 'زيت', 'Cooking oil', 'super', 'bottle', 1, 1, 'oil'],
      ['tea', 'شاي', 'Tea', 'super', 'pack', 1, 1, 'cup'], ['cumin', 'كمون', 'Cumin', 'spice', 'g', 50, 100, 'jar'],
      ['panadol', 'بنادول', 'Panadol', 'pharm', 'box', 1, 1, 'pills'], ['detergent', 'مسحوق غسيل', 'Detergent', 'clean', 'pack', 1, 1, 'spray']
    ].map(([id, a, e, cat, unit, step, def, icon]) => ({ id, name: { ar: a, en: e }, cat, unit, step, def, icon }));
    const catById = {}; CAT.forEach((c) => { catById[c.id] = c; });
    const fmtQty = (q, unit) => {
      const whole = Math.floor(q + 1e-9), fr = Math.round((q - whole) * 100);
      const frS = fr === 50 ? '½' : fr === 25 ? '¼' : fr === 75 ? '¾' : '';
      const n = (whole === 0 && frS) ? frS : num(whole) + frS;
      const u = UNITS[unit] || ['', '', ''];
      if (!isAr) return n + ' ' + (q > 1 ? u[2] : u[1]);
      const AR = { bag: ['كيس', 'كيسان', 'أكياس', 'كيساً'], tray: ['طبق', 'طبقان', 'أطباق', 'طبقاً'], loaf: ['رغيف', 'رغيفان', 'أرغفة', 'رغيفاً'],
        bottle: ['زجاجة', 'زجاجتان', 'زجاجات', 'زجاجة'], pack: ['عبوة', 'عبوتان', 'عبوات', 'عبوة'], box: ['علبة', 'علبتان', 'علب', 'علبة'] }[unit];
      if (!AR || frS) return n + ' ' + u[0];
      if (q === 1) return AR[0];
      if (q === 2) return AR[1];
      return n + ' ' + (q <= 10 ? AR[2] : AR[3]);
    };
    const itemName = (it) => {
      const c = it.ref && catById[it.ref];
      return c ? fmtQty(it.qty, c.unit) + ' – ' + tx(c.name) : tx(it.name);
    };
    const itemIcon = (it) => { const c = it.ref && catById[it.ref]; return c ? c.icon : (it.icon || null); };
    const qpick = CAT.filter((c) => s.shopFilter === 'all' || c.cat === s.shopFilter)
      .sort((a, b) => (s.freq[b.id] || 0) - (s.freq[a.id] || 0))
      .map((c) => ({
        name: tx(c.name), icons: this.icons(c.icon, 1, 28), cls: s.qSel === c.id ? 'qt-on' : 'qt',
        sel: () => this.setState(this.state.qSel === c.id ? { qSel: null } : { qSel: c.id, qQty: this.state.lastQty[c.id] || c.def })
      }));
    const qc = s.qSel && catById[s.qSel];
    const qsel = qc ? { name: tx(qc.name), icons: this.icons(qc.icon, 1, 24), qtyTxt: fmtQty(s.qQty, qc.unit) } : { name: '', icons: [], qtyTxt: '' };
    const groups = shopCats.filter(([id]) => s.shopFilter === 'all' || s.shopFilter === id).map(([id, name, icon]) => {
      const its = s.shop.filter((x) => x.cat === id).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
      const nLeft = its.filter((x) => !x.done).length;
      return {
        name, icon, tileCls: 'tile-s sc-' + id,
        leftTxt: nLeft ? L('المتبقي ' + num(nLeft), nLeft + ' left') : L('اكتملت', 'All done'),
        items: its.map((it) => ({
          id: it.id, name: itemName(it), by: WHO[it.by] || it.by, done: it.done,
          icons: itemIcon(it) ? this.icons(itemIcon(it), 1, 18) : [],
          desc: tx(it.desc), hasDesc: !!tx(it.desc),
          boxCls: it.done ? 'it-done' : 'it', nameCls: it.done ? 'it-name-done' : 'it-name',
          edit: () => this.setState({ sheet: 'item', editId: it.id, edit: { name: itemName(it), orig: itemName(it), desc: tx(it.desc), cat: it.cat, price: it.price ? String(it.price) : '' } }),
          ckCls: it.done ? 'ck-on' : 'ck', tCls: it.done ? 't1 strike' : 't1',
          priceTxt: it.price ? money(it.price) : (it.done ? '—' : ''),
          priceCls: it.done ? 'amt' : 'amt-s', hasPrice: !!it.price,
          byInit: INIT[it.by] || '?', byCls: byCls(it.by),
          byAria: L('أضافه: ', 'Added by: ') + (WHO[it.by] || it.by),
          toggle: toggleItem(it)
        }))
      };
    });
    const priceItem = s.shop.find((x) => x.id === s.priceFor);
    const finishPrice = (price) => {
      const id = this.state.priceFor;
      this.setState({ shop: this.state.shop.map((x) => x.id === id ? { ...x, done: true, price: price } : x), sheet: null, priceFor: null, priceDraft: '' });
    };
    const left = s.shop.filter((x) => !x.done);

    const f = s.form;
    const kindList = [['pot', L('قِدر', 'Pot')], ['egg', L('بيض', 'Eggs')], ['bag', L('كيس', 'Bag')], ['cup', L('كوب', 'Cup')], ['pack', L('عبوة', 'Pack')], ['oven', L('فرن', 'Oven')]];
    const kinds = kindList.map(([id, label]) => ({ id, label, icons: this.icons(id, 1, 20), cls: f.icon === id ? 'chip-on' : 'chip', sel: () => this.setForm({ icon: id }) }));
    const buildTask = () => {
      const fm = this.state.form, name = (fm.name || '').trim();
      if (!name) { this.flash(L('اكتب اسم المهمة أولاً', 'Enter a task name first')); return null; }
      return { id: 'p' + Date.now(), name, icon: fm.icon, opts: [{ q: qtyLabel(fm.n), n: fm.n, m: fm.m }] };
    };
    const fCatList = [['appt', L('موعد', 'Appointment')], ['vax', L('تطعيم', 'Vaccine')], ['bill', L('فاتورة/تجديد', 'Bill/renewal')]];
    const fCats = fCatList.map(([k, n]) => ({ name: n, cls: f.cat === k ? 'chip-on' : 'chip', sel: () => this.setForm({ cat: k }) }));
    const fWho = PIDS.concat(['home']).map((k) => ({ name: WHO[k], cls: f.who === k ? 'chip-on' : 'chip', sel: () => this.setForm({ who: k }) }));
    const isMedForm = f.cat === 'med';
    const fmtWhen = (v, med) => {
      if (!v) return null;
      if (med) return { ar: 'يومياً ' + v, en: 'Daily ' + v };
      try {
        const d = new Date(v + 'T00:00'), o = { weekday: 'short', day: 'numeric', month: 'short' };
        return { ar: d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }), en: d.toLocaleDateString('en-US', o) };
      } catch (e) { return v; }
    };
    const openForm = (cat) => this.setState({ sheet: 'appt', form: { ...this.state.form, title: '', when: '', cat, shared: true, who: myId } });
    const sheetTitles = {
      price: L('تم الشراء ✓', 'Bought ✓'), card: L('بطاقة', 'Card'), settings: L('الإعدادات', 'Settings'), recView: L('السجل الطبي', 'Medical record'), item: L('تعديل الصنف', 'Edit item'), med: L('دواء جديد', 'New medicine'), medInfo: L('تفاصيل الدواء', 'Medicine details'), rec: L('تحليل / أشعة / كشف', 'Test / scan / visit'), menu: L('إضافة', 'Add'), theme: L('الإعدادات والمظهر', 'Settings & theme'),
      pick: pp ? tx(pp.name) : '', task: L('مهمة مطبخ جديدة', 'New kitchen task'), appt: isMedForm ? L('دواء جديد', 'New medicine') : L('تذكير جديد', 'New reminder')
    };

    return {
      T, lang, appCls: 'app th-' + theme + (isAr ? ' dir-rtl' : ' dir-ltr'),
      syncOn: S.enabled && !!fam, localOnly: !S.enabled,
      gSplash: S.enabled && (!s.authReady || (s.auth && !s.famReady)),
      gLogin: S.enabled && s.authReady && !s.auth,
      gFam: S.enabled && !!s.auth && s.famReady && !s.family,
      gApp: !S.enabled || (!!s.auth && !!s.family),
      af: s.af, afErr: s.afErr, hasAfErr: !!s.afErr, afBusy: s.afBusy, isSignup: s.af.mode === 'up', isLogin: s.af.mode !== 'up',
      afEmail: (e) => this.setState({ af: { ...this.state.af, email: e.target.value } }),
      afPw: (e) => this.setState({ af: { ...this.state.af, pw: e.target.value } }),
      afName: (e) => this.setState({ af: { ...this.state.af, name: e.target.value } }),
      afToggle: () => this.setState({ af: { ...this.state.af, mode: this.state.af.mode === 'up' ? 'in' : 'up' }, afErr: '' }),
      afSubmit: () => {
        const a = this.state.af; if (this.state.afBusy) return;
        if (a.mode === 'up' && !(a.name || '').trim()) { this.setState({ afErr: L('اكتب اسمك', 'Enter your name') }); return; }
        this.setState({ afBusy: true, afErr: '' });
        const pr = a.mode === 'up' ? S.signUp(a.email, a.pw, a.name.trim()) : S.signIn(a.email, a.pw);
        pr.then(() => { if (a.mode === 'up') this.setState({ userName: a.name.trim() }); this.setState({ afBusy: false, af: { ...this.state.af, pw: '' } }); })
          .catch((e) => this.setState({ afBusy: false, afErr: S.authError(e, isAr) }));
      },
      afForgot: () => {
        const em = (this.state.af.email || '').trim();
        if (!em) { this.setState({ afErr: L('اكتب بريدك أولاً', 'Enter your email first') }); return; }
        S.resetPassword(em).then(() => this.setState({ afErr: L('أرسلنا رابط تغيير كلمة المرور إلى بريدك', 'We emailed you a reset link') }))
          .catch((e) => this.setState({ afErr: S.authError(e, isAr) }));
      },
      myEmail: s.auth ? s.auth.email : '', famNameVal: s.famName,
      onFamName: (e) => this.setState({ famName: e.target.value }),
      createFam: () => {
        const n = (this.state.famName || '').trim(); if (!n) { this.flash(L('اكتب اسم الأسرة', 'Enter a family name')); return; }
        S.createFamily({ uid: s.auth.uid, email: s.auth.email }, n, s.auth.name || s.userName).catch((e) => this.flash(e.message));
      },
      logout: () => { if (!window.confirm(L('تسجيل الخروج من هذا الهاتف؟', 'Sign out on this phone?'))) return; this.setState({ sheet: null }); S.logOut(); },
      famLabel: fam ? fam.name : '',
      memberRows: fam ? (fam.memberEmails || []).map((em) => {
        const p = (fam.people || []).find((x) => x.email === em);
        return { name: p ? (p.id === myId ? p.name + L(' (أنت)', ' (you)') : p.name) : em, sub: p ? em : L('بانتظار التسجيل', 'Not joined yet'),
          canRemove: !!fam && fam.owner === myId && em !== (s.auth && s.auth.email),
          remove: () => { if (window.confirm(L('إزالة هذا الفرد من الأسرة؟', 'Remove this member?'))) S.removeEmail(fam.id, em); } };
      }) : [],
      inviteDraft: s.inviteDraft, onInvite: (e) => this.setState({ inviteDraft: e.target.value }),
      sendInvite: () => {
        const em = (this.state.inviteDraft || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { this.flash(L('البريد غير صحيح', 'Invalid email')); return; }
        S.inviteEmail(fam.id, em).then(() => { this.setState({ inviteDraft: '' }); this.flash(L('أُضيف. عندما يسجّل بهذا البريد سينضم تلقائياً', 'Added — they join automatically when they sign up')); });
      },
      depRows: (fam ? (fam.dependents || []) : (s.dependents || [])).map((d) => ({
        name: d.name,
        remove: () => {
          if (!window.confirm(L('حذف ', 'Remove ') + d.name + '?')) return;
          if (fam) S.updateFamily(fam.id, { dependents: (fam.dependents || []).filter((x) => x.id !== d.id) });
          else this.setState({ dependents: this.state.dependents.filter((x) => x.id !== d.id) });
        }
      })),
      depDraft: s.depDraft, onDep: (e) => this.setState({ depDraft: e.target.value }),
      addDep: () => {
        const n = (this.state.depDraft || '').trim(); if (!n) return;
        const d = { id: 'p' + Date.now(), name: n };
        if (fam) S.updateFamily(fam.id, { dependents: [...(fam.dependents || []), d] });
        else this.setState({ dependents: [...(this.state.dependents || []), d] });
        this.setState({ depDraft: '' });
      },
      budgetVal: String(budget), onBudget: (e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) return; if (fam) S.updateFamily(fam.id, { budget: v }); else this.setState({ budget: v }); },
      toggleLang: () => { const nl = isAr ? 'en' : 'ar'; this.setState({ lang: nl }); this.flash(nl === 'en' ? 'English' : 'العربية'); },
      nav, go, fast, themes,
      isToday: s.tab === 'today', isKitchen: s.tab === 'kitchen', isSched: s.tab === 'sched', isCards: s.tab === 'cards', isShop: s.tab === 'shop',
      timers, hasTimers: timers.length > 0, timerCount: num(timers.length), heroLine,
      medsDone: num(meds.filter((m) => m.tk).length), medsTotal: num(meds.length),
      weekCount: num(busy.size), week, meds, quick,
      shopLeft: left.slice(0, 4).map((x) => ({ name: itemName(x) })),
      shopLine: left.length ? L('أصناف للشراء: ' + num(left.length), left.length + ' items needed — whoever goes out grabs them') : L('لا توجد نواقص', 'Nothing needed'),
      goKitchen: () => this.setState({ tab: 'kitchen' }),
      presets, pick, catIcon, potIcon: this.icons('pot', 1, 24),
      minus: () => adjust(-1), plus: () => adjust(1),
      addQty: () => { editPreset((p) => { const last = p.opts[p.opts.length - 1]; const n = last.n + 1; return { ...p, opts: [...p.opts, { q: qtyLabel(n), n, m: last.m + 2 }] }; }); this.setState({ opt: pp ? pp.opts.length : 0 }); },
      startPick: () => { const p = presetsFind(this.state.pick); if (p) this.start(p, p.opts[this.state.opt], this.state.lvl); },
      upcoming, items, noItems: items.length === 0, cats, scopes,
      locked: s.locked, unlocked: !s.locked,
      unlock: () => { biometricUnlock(L('افتح البطاقات', 'Unlock cards'), L('إلغاء', 'Cancel')).then((ok) => { if (ok) this.setState({ locked: false }); }); },
      cardAlerts, noCards: s.cards.length === 0,
      openCardForm: () => this.setState({ sheet: 'card', cardForm: { id: null, type: '', who: myId, num: '', exp: '', front: '', back: '', shared: false } }),
      cf, isCardSheet: s.sheet === 'card',
      cfTypes: [L('بطاقة الرقم القومي', 'National ID'), L('جواز السفر', 'Passport'), L('رخصة القيادة', 'Driving license'), L('رخصة السيارة', 'Car license'), L('بطاقة التأمين الصحي', 'Health insurance card'), L('شهادة الميلاد', 'Birth certificate')]
        .map((n) => ({ name: n, cls: cf.type === n ? 'chip-on' : 'chip', sel: () => setCf({ type: n }) })),
      cfWho: PIDS.map((k) => ({ name: WHO[k], cls: cf.who === k ? 'chip-on' : 'chip', sel: () => setCf({ who: k }) })),
      cfType: (e) => setCf({ type: e.target.value }), cfNum: (e) => setCf({ num: e.target.value }), cfExp: (e) => setCf({ exp: e.target.value }),
      cfFront: pickImg('front'), cfBack: pickImg('back'), cfHasFront: !!cf.front, cfHasBack: !!cf.back,
      cfPrivCls: cf.shared ? 'chip' : 'chip-on', cfShareCls: cf.shared ? 'chip-on' : 'chip',
      cfPriv: () => setCf({ shared: false }), cfShare: () => setCf({ shared: true }),
      saveCard: () => {
        const c = this.state.cardForm; if (!c || !(c.type || '').trim()) { this.flash(L('اكتب نوع البطاقة أولاً', 'Enter the card type first')); return; }
        const rec = { ...c, type: c.type.trim(), id: c.id || 'c' + Date.now() };
        const exists = this.state.cards.some((x) => x.id === rec.id);
        this.setState({ cards: exists ? this.state.cards.map((x) => x.id === rec.id ? rec : x) : [...this.state.cards, rec], sheet: null, cardForm: null });
        this.flash(L('تم حفظ البطاقة', 'Card saved'));
      },
      cards,
      faceTxt: s.face === 'front' ? L('لا توجد صورة للوجه', 'No front photo') : L('لا توجد صورة للظهر', 'No back photo'),
      faceFrontCls: s.face === 'front' ? 'chip-on' : 'chip', faceBackCls: s.face === 'back' ? 'chip-on' : 'chip',
      showFront: () => this.setState({ face: 'front' }), showBack: () => this.setState({ face: 'back' }),

      draft: s.draft, hasDraft: !!(s.draft || '').trim(), draftPrice: s.draftPrice,
      draftCatName: scName[draftCat],
      draftCats: SC.map(([id, n]) => ({ name: n, cls: draftCat === id ? 'chip-on' : 'chip', sel: () => this.setState({ draftCat: id }) })),
      onType: (e) => this.setState({ draft: e.target.value }),
      onDraftPrice: (e) => this.setState({ draftPrice: e.target.value }),
      draftDesc: s.draftDesc, onDraftDesc: (e) => this.setState({ draftDesc: e.target.value }),
      qpick, qsel, hasQSel: !!qc,
      qMinus: () => { const c = catById[this.state.qSel]; if (c) this.setState({ qQty: Math.max(c.step, +(this.state.qQty - c.step).toFixed(2)) }); },
      qPlus: () => { const c = catById[this.state.qSel]; if (c) this.setState({ qQty: +(this.state.qQty + c.step).toFixed(2) }); },
      qAdd: () => {
        const c = catById[this.state.qSel]; if (!c) return;
        const q = this.state.qQty, ex = this.state.shop.find((x) => x.ref === c.id && !x.done);
        const shop = ex ? this.state.shop.map((x) => x === ex ? { ...x, qty: q } : x)
          : [{ id: Date.now(), ref: c.id, qty: q, name: '', desc: '', cat: c.cat, by: myId, done: false, price: null }, ...this.state.shop];
        this.setState({ shop, qSel: null, freq: { ...this.state.freq, [c.id]: (this.state.freq[c.id] || 0) + 1 }, lastQty: { ...this.state.lastQty, [c.id]: q } });
        this.flash(ex ? L('تم تعديل الكمية: ', 'Quantity updated: ') + fmtQty(q, c.unit) : L('تمت الإضافة: ', 'Added: ') + fmtQty(q, c.unit) + ' – ' + tx(c.name));
      },
      gridCls: s.shopView === 'grid' ? 'igrid' : 'ilist',
      viewGridCls: s.shopView === 'grid' ? 'seg-on' : 'seg-b', viewListCls: s.shopView === 'grid' ? 'seg-b' : 'seg-on',
      setGrid: () => this.setState({ shopView: 'grid' }), setList: () => this.setState({ shopView: 'list' }),
      isItem: s.sheet === 'item' && !!s.editId, edit: s.edit,
      editCats: SC.map(([id, n]) => ({ name: n, cls: s.edit.cat === id ? 'chip-on' : 'chip', sel: () => this.setState({ edit: { ...this.state.edit, cat: id } }) })),
      onEditName: (e) => this.setState({ edit: { ...this.state.edit, name: e.target.value } }),
      onEditDesc: (e) => this.setState({ edit: { ...this.state.edit, desc: e.target.value } }),
      onEditPrice: (e) => this.setState({ edit: { ...this.state.edit, price: e.target.value } }),
      saveEdit: () => {
        const ed = this.state.edit, nm = (ed.name || '').trim();
        if (!nm) { this.flash(L('اكتب الاسم أولاً', 'Enter a name first')); return; }
        const pr = parseFloat(ed.price);
        this.setState({ shop: this.state.shop.map((x) => x.id === this.state.editId ? { ...x, ref: (nm === ed.orig ? x.ref : null), icon: (nm === ed.orig ? x.icon : (x.icon || itemIcon(x))), name: nm, desc: (ed.desc || '').trim(), cat: ed.cat, price: isNaN(pr) ? null : pr } : x), sheet: null, editId: null });
        this.flash(L('تم حفظ التعديل', 'Changes saved'));
      },
      deleteEdit: () => { this.setState({ shop: this.state.shop.filter((x) => x.id !== this.state.editId), sheet: null, editId: null }); this.flash(L('تم الحذف', 'Deleted')); },
      addItem: () => {
        const v = this.state.draft.trim(); if (!v) return;
        const cat = this.state.draftCat || guessCat(v);
        const pr = parseFloat(this.state.draftPrice);
        const ds = (this.state.draftDesc || '').trim();
        this.setState({ shop: [{ id: Date.now(), name: v, desc: ds, cat, by: myId, done: false, price: isNaN(pr) ? null : pr }, ...this.state.shop], draft: '', draftDesc: '', draftCat: null, draftPrice: '' });
        this.flash(L('أُضيف إلى ' + scName[cat], 'Added to ' + scName[cat]));
      },
      spentTxt: money(spent), budgetPct, budgetLine, breakdown,
      showBreak: s.showBreak, breakBtn: s.showBreak ? L('إخفاء التفاصيل', 'Hide details') : L('التفاصيل', 'Details'),
      toggleBreak: () => this.setState({ showBreak: !this.state.showBreak }),
      spendOpen: s.spendOpen, spendBtn: s.spendOpen ? L('إخفاء ▴', 'Hide ▴') : L('إظهار ▾', 'Show ▾'),
      toggleSpend: () => this.setState({ spendOpen: !this.state.spendOpen, showBreak: false }),
      shopFilters, groups, hasDone: s.shop.some((x) => x.done),
      clearDone: () => {
        if (this.fid) {
          const add = {}; this.state.shop.forEach((x) => { if (x.done && x.price) add[x.cat] = (add[x.cat] || 0) + Number(x.price); });
          S.addSpend(this.fid, this.state.auth.uid, monthKey(), add).catch(() => {});
          this.setState({ shop: this.state.shop.filter((x) => !x.done) });
          this.flash(L('أُزيلت من القائمة وبقيت في المصروفات', 'Cleared — still counted in spending')); return;
        }
        const h = { ...this.state.history };
        this.state.shop.forEach((x) => { if (x.done && x.price) h[x.cat] = (h[x.cat] || 0) + Number(x.price); });
        this.setState({ history: h, shop: this.state.shop.filter((x) => !x.done) });
        this.flash(L('أُزيلت من القائمة وبقيت في المصروفات', 'Cleared — still counted in spending'));
      },
      isPrice: s.sheet === 'price' && !!priceItem,
      priceItemLine: priceItem ? L('كم دفعت مقابل «' + itemName(priceItem) + '»؟ اكتب المبلغ ليُحسب ضمن مصروفات الشهر.', 'How much did you pay for "' + itemName(priceItem) + '"? It will be added to this month\'s spending.') : '',
      priceDraft: s.priceDraft,
      onPrice: (e) => this.setState({ priceDraft: e.target.value }),
      priceQuick: [50, 100, 200, 500].map((v) => ({ name: money(v), sel: () => this.setState({ priceDraft: String(v) }) })),
      savePrice: () => { const v = parseFloat(this.state.priceDraft); finishPrice(isNaN(v) ? null : v); this.flash(isNaN(v) ? L('تم التأشير', 'Checked off') : L('تم التأشير وأُضيف ', 'Checked off · added ') + money(v)); },
      skipPrice: () => { const it = this.state.shop.find((x) => x.id === this.state.priceFor); finishPrice(it ? it.price : null); },

      showFab: !s.sheet, sheetOpen: !!s.sheet, sheetTitle: sheetTitles[s.sheet] || '',
      isMenu: s.sheet === 'menu', isThemeSheet: s.sheet === 'theme', isPick: s.sheet === 'pick' && !!pp, isTask: s.sheet === 'task', isAppt: s.sheet === 'appt',
      openMenu: () => this.setState({ sheet: 'menu' }),
      openTheme: () => this.setState({ sheet: 'theme' }),
      closeSheet: () => this.setState({ sheet: null, pick: null, priceFor: null, editId: null, medInfo: null }),
      openTask: () => this.setState({ sheet: 'task', form: { ...this.state.form, name: '', icon: 'pot', n: 1, m: 10 } }),
      openAppt: () => openForm('appt'),
      openMed: () => this.setState({ sheet: 'med', mf: { name: '', dose: '', times: ['09:00'], note: '', who: myId, shared: false } }),
      openRec: () => this.setState({ sheet: 'rec', rf: { type: 'lab', title: '', date: '', result: '', who: myId, shared: false } }),
      goMeds: () => this.setState({ tab: 'sched', schedSeg: 'meds' }), goRec: () => this.setState({ schedSeg: 'rec', recType: 'med' }),
      segs, isSegAppts: s.schedSeg === 'appts', isSegMeds: s.schedSeg === 'meds', isSegRec: s.schedSeg === 'rec',
      todayDoses, medGroups, noDoses: medGroups.length === 0, medWhoChips: whoChips(medWho, 'medWho', true),
      recList, noRec: recList.length === 0, recWhoChips: whoChips(s.recWho, 'recWho', true), recTypeChips,
      isMedSheet: s.sheet === 'med', isMedInfo: s.sheet === 'medInfo' && !!mInfo, isRecSheet: s.sheet === 'rec', mi,
      mf, mfTimes,
      mfName: (e) => setMf({ name: e.target.value }), mfDose: (e) => setMf({ dose: e.target.value }), mfNote: (e) => setMf({ note: e.target.value }),
      mfAddTime: () => setMf({ times: [...this.state.mf.times, '21:00'] }),
      mfWho: PIDS.map((k) => ({ name: WHO[k], cls: mf.who === k ? 'chip-on' : 'chip', sel: () => setMf({ who: k }) })),
      mfPrivCls: mf.shared ? 'chip' : 'chip-on', mfShareCls: mf.shared ? 'chip-on' : 'chip',
      mfPriv: () => setMf({ shared: false }), mfShare: () => setMf({ shared: true }),
      saveMed: () => {
        const f2 = this.state.mf, nm = (f2.name || '').trim();
        if (!nm) { this.flash(L('اكتب اسم الدواء أولاً', 'Enter the medicine name first')); return; }
        const today = todayISO();
        const m = { id: 'd' + Date.now(), name: nm, dose: (f2.dose || '').trim() || L('جرعة', 'dose'), times: [...f2.times].filter(Boolean).sort(), who: f2.who, shared: f2.shared, note: (f2.note || '').trim(), active: true, sd: today };
        this.setState({ meds: [...this.state.meds, m], sheet: null, tab: 'sched', schedSeg: 'meds', medWho: f2.who });
        this.flash(L('تم حفظ الدواء', 'Medicine saved') + '');
      },
      stopMed: () => {
        const id = this.state.medInfo;
        this.setState({ meds: this.state.meds.map((m) => m.id === id ? { ...m, active: false, ed: todayISO() } : m), sheet: null, medInfo: null });
        this.flash(L('نُقل إلى السجل الطبي', 'Moved to the medical record'));
      },
      rf, rfPh: rf.type === 'lab' ? L('مثلاً: صورة دم كاملة', 'e.g. complete blood count') : rf.type === 'img' ? L('مثلاً: أشعة على الركبة', 'e.g. knee X-ray') : L('مثلاً: كشف باطني', 'e.g. GP visit'),
      rfTypes: ['lab', 'img', 'visit'].map((k) => ({ name: RT[k][0], cls: rf.type === k ? 'chip-on' : 'chip', sel: () => setRf({ type: k }) })),
      rfTitle: (e) => setRf({ title: e.target.value }), rfDate: (e) => setRf({ date: e.target.value }), rfResult: (e) => setRf({ result: e.target.value }),
      rfWho: PIDS.map((k) => ({ name: WHO[k], cls: rf.who === k ? 'chip-on' : 'chip', sel: () => setRf({ who: k }) })),
      rfPrivCls: rf.shared ? 'chip' : 'chip-on', rfShareCls: rf.shared ? 'chip-on' : 'chip',
      rfPriv: () => setRf({ shared: false }), rfShare: () => setRf({ shared: true }),
      rfImg: (e) => { const f = e.target.files && e.target.files[0]; readImage(f, 1600).then((d) => { if (d) setRf({ img: d }); }); },
      rfAttachTxt: rf.img ? L('✓ أُرفقت صورة — تغيير', '✓ Photo attached — change') : L('إرفاق صورة التقرير', 'Attach a photo of the report'),
      isRecView: s.sheet === 'recView' && !!rvR, rv,
      userName: s.userName || '', setUserName: (e) => this.setState({ userName: e.target.value }),
      noTodayDoses: todayDoses.length === 0, noUpcoming: upcoming.length === 0,
      saveRec: () => {
        const r = this.state.rf, ti = (r.title || '').trim();
        if (!ti) { this.flash(L('اكتب العنوان أولاً', 'Enter a title first')); return; }
        const rec = { id: 'r' + Date.now(), type: r.type, title: ti, who: r.who, d: r.date || todayISO(), result: (r.result || '').trim(), shared: r.shared, img: r.img || '' };
        this.setState({ records: [rec, ...this.state.records], sheet: null, tab: 'sched', schedSeg: 'rec', recType: 'all', recWho: 'all' });
        this.flash(L('تم الحفظ في السجل الطبي', 'Saved to the medical record'));
      },
      openShop: () => this.setState({ sheet: null, tab: 'shop' }),

      form: { ...f, n: num(f.n), m: num(f.m) }, kinds, formIcons: this.icons(f.icon, f.n, f.n > 4 ? 24 : 30),
      setName: (e) => this.setForm({ name: e.target.value }),
      fQtyMinus: () => this.setForm({ n: Math.max(1, this.state.form.n - 1) }),
      fQtyPlus: () => this.setForm({ n: Math.min(8, this.state.form.n + 1) }),
      fMinMinus: () => this.setForm({ m: Math.max(1, this.state.form.m - 1) }),
      fMinPlus: () => this.setForm({ m: this.state.form.m + 1 }),
      saveTask: () => { const t = buildTask(); if (!t) return; this.setState({ presets: [...this.state.presets, t], sheet: null, tab: 'kitchen' }); this.flash(L('تم حفظ مهمة ', 'Saved: ') + t.name); },
      saveStartTask: () => { const t = buildTask(); if (!t) return; this.setState({ presets: [...this.state.presets, t] }); this.start(t, t.opts[0], 0); },

      fCats, fWho, apptPh: isMedForm ? L('مثلاً: شراب السعال — ٥ مل', 'e.g. cough syrup — 5 ml') : L('مثلاً: تطعيم الشهر الـ١٨', 'e.g. 18-month vaccine'),
      whenLbl: isMedForm ? L('الساعة (يومياً)', 'Time (every day)') : L('التاريخ', 'Date'), whenType: isMedForm ? 'time' : 'date',
      setTitle: (e) => this.setForm({ title: e.target.value }),
      setWhen: (e) => this.setForm({ when: e.target.value }),
      fSharedCls: f.shared ? 'chip-on' : 'chip', fPrivateCls: f.shared ? 'chip' : 'chip-on',
      setShared: () => this.setForm({ shared: true }), setPrivate: () => this.setForm({ shared: false }),
      saveAppt: () => {
        const fm = this.state.form, title = (fm.title || '').trim();
        if (!title) { this.flash(L('اكتب العنوان أولاً', 'Enter a title first')); return; }
        const when = fmtWhen(fm.when, fm.cat === 'med') || { ar: 'بلا تاريخ', en: 'No date' };
        const a = { id: 'x' + Date.now(), title, who: fm.who, when, d: fm.when || null, cat: fm.cat, shared: fm.shared };
        this.setState({ appts: [a, ...this.state.appts], sheet: null, tab: 'sched', cat: 'all', scope: 'all' });
        this.flash(L('تم الحفظ', 'Saved') + '');
      },

      toast: s.toast, hasToast: !!s.toast
    };
  }
}
