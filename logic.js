import { DCLogic } from './runtime.js';
import * as S from './sync.js';
import { shareText, localAlert, shareFile, listen, shareImage, pickPhone } from './native.js';
import * as AI from './ai.js';
import { localCommand } from './voice.js';
import { installDrag } from './drag.js';
import * as CR from './crypt.js';
import { homeVals, healthVals, reportVals, shopAnalysisVals, dossierVals, todoVals, todoReminders, choreVals, choreReminders, extraReminders, maintDueList, setExtraFor } from './home.js';
import { speak as nSpeak, scheduleTimer, cancelTimer, syncReminders, biometricUnlock, readImage, setupNative } from './native.js';

const STORE = 'baitna.v1';
const DOWNLOAD_URL = 'https://github.com/engkamal360-ui/BaitnaApp/releases/latest/download/baitna.apk';
const PERSIST = ['chcats', 'chores', 'todos', 'dossier', 'files', 'cgroups', 'prefs', 'cars', 'maint', 'warranty', 'contacts', 'health', 'measures', 'recur', 'lang', 'theme', 'userName', 'timers', 'presets', 'appts', 'taken', 'shop', 'history', 'histMonth', 'budget', 'shopView',
  'freq', 'lastQty', 'meds', 'records', 'cards', 'log', 'catalog', 'medWho', 'dependents', 'famPref', 'seenInvites', 'nudgeSeen', 'sortMode'];
const stable = (o) => JSON.stringify(o, Object.keys(o).sort());
const sjson = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, kk) => { a[kk] = v[kk]; return a; }, {}) : v);
const isoOf2 = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// ---- extra reminders the user can add on top of the defaults ----
export const REM = [['h1', 60], ['h3', 180], ['d1', 1440], ['d2', 2880], ['d3', 4320], ['w1', 10080], ['w2', 20160], ['m1', 43200]];
const remMin = (k) => (REM.find((x) => x[0] === k) || [0, 0])[1];
export function extraFor(rem, baseMs, title, ar, now) {
  return (rem || []).map((k) => ({ k, at: baseMs - remMin(k) * 60000 })).filter((x) => x.at > (now || Date.now()))
    .map((x) => ({ at: x.at, channel: 'reminders', title: (ar ? 'تذكير: ' : 'Reminder: ') + title, body: remLabel(x.k, ar) }));
}
export function remLabel(k, ar) {
  const A = { h1: 'بعد ساعة', h3: 'بعد ٣ ساعات', d1: 'غداً', d2: 'بعد يومين', d3: 'بعد ٣ أيام', w1: 'بعد أسبوع', w2: 'بعد أسبوعين', m1: 'بعد شهر' };
  const E = { h1: 'in 1 hour', h3: 'in 3 hours', d1: 'tomorrow', d2: 'in 2 days', d3: 'in 3 days', w1: 'in a week', w2: 'in 2 weeks', m1: 'in a month' };
  return (ar ? A : E)[k] || '';
}
setTimeout(() => setExtraFor(extraFor), 0);
// ---- per-person layout (what is shown on THIS person's screens; data is untouched) ----
const LAYOUT_SUBS = { sched: ['sched.appts', 'sched.meds', 'sched.health'], shop: ['shop.spend', 'shop.quick'], home: ['home.chores', 'home.car', 'home.maint', 'home.warranty', 'home.contacts'] };
export function hiddenFn(hide) {
  const H = hide || {};
  const h = (k) => { if (H[k]) return true; const p = k.split('.')[0]; if (p !== k && H[p]) return true; if (LAYOUT_SUBS[k]) return LAYOUT_SUBS[k].every((x) => H[x]); return false; };
  // derived: things that live on other screens
  const d = (k) => ({
    'today.meds': h('today.meds') || h('sched.meds'), 'today.appts': h('today.appts') || h('sched.appts'), 'today.alerts': h('today.alerts') || h('cards'),
    'today.shop': h('today.shop') || h('shop'), 'today.chores': h('today.chores') || h('home.chores'), 'today.week': h('today.week') || h('sched.appts')
  })[k];
  return (k) => { const v = d(k); return v === undefined ? h(k) : v; };
}
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
      locked: true, openCard: null, face: 'front', cardWho: 'all', cardKind: 'all', fullCard: null,
      shop: [],
      history: {}, histMonth: monthKey(), userName: '', cards: [], log: [], catalog: [], recur: [], prefs: [], cgroups: [], dossier: [], files: [], todos: [], tdDraft: '', chores: [], chDraft: '', chcats: [], ef: null, cars: [], maint: [], warranty: [], contacts: [], health: [], measures: [], hf: null, homeSeg: 'chores', mType: 'bp', mWho: null, mForm: {}, hpForm: {}, emerg: null, wView: null, repOff: 0, draftUnit: null, draftQty: 1,
      exp: { mode: 'month', from: '', to: '' }, review: null, aiBusy: false, dictText: '', famErr: false, myFams: [], cardForm: null, dependents: [],
      auth: null, authReady: !S.enabled, family: null, famReady: false, online: navigator.onLine,
      af: { email: '', pw: '', name: '', mode: 'in' }, afErr: '', afBusy: false, famName: '', inviteDraft: '', depDraft: '',
      famPref: null, famInvites: [], seenInvites: [], joinCode: '', joinBusy: false, inviteCode: '',
      budget: 8000, showBreak: false, spendOpen: false, shopFilter: 'all',
      freq: { milk: 12, bread: 10, tomato: 9, eggs: 8, chicken: 6, potato: 5, mince: 4, onion: 4, cucumber: 3, rice: 3, cheese: 3, oil: 2, lemon: 2, beef: 2, tea: 2, fish: 1, carrot: 1, cumin: 1, detergent: 1, panadol: 1 },
      lastQty: {}, qSel: null, qQty: 1,
      schedSeg: 'appts', medWho: 'me', recWho: 'all', recType: 'all', medInfo: null,
      meds: [],
      records: [],
      mf: { name: '', dose: '', times: ['09:00'], note: '', who: 'me', shared: false },
      rf: { type: 'visit', title: '', date: '', result: '', who: 'me', shared: true },
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
      this.famUnsub = S.watchFamilies(user.email, (list, err) => this.onFamilies(list, err));
    });
  }
  stopKinds() { this.unsubs.forEach((u) => u()); this.unsubs = []; this.fid = null; this.synced = {}; this.ready = {}; }
  onFamilies(list, err) {
    const a = this.authUser; if (!a) return;
    if (!list) { this.setState({ famErr: true, famReady: true }); return; } // connection/permission problem: never offer to create a new family
    const mine = (f) => (f.people || []).some((p) => p.id === a.uid);
    const age = (f) => (f.created && f.created.seconds) || 9e12;
    const myList = list.filter(mine).sort((x, y) => age(x) - age(y));
    let cur = list.find((f) => f.id === this.state.famPref) || myList[0] || (list.length === 1 ? list[0] : null);
    this.setState({ famErr: false, myFams: myList.map((f) => ({ id: f.id, name: f.name })) });
    const invites = list.filter((f) => f !== cur && !mine(f));
    const fresh = invites.filter((f) => !(this.state.seenInvites || []).includes(f.id));
    if (fresh.length) {
      const ar = this.lang() === 'ar';
      fresh.forEach((f) => localAlert(ar ? 'دعوة للانضمام إلى ' + f.name : 'Invitation to join ' + f.name, ar ? 'افتح «بيتنا» واضغط «انضمام»' : 'Open Baitna and tap Join'));
      this.setState({ seenInvites: [...(this.state.seenInvites || []), ...fresh.map((f) => f.id)] });
    }
    this.setState({ famInvites: invites });
    this.onFamily(cur);
  }
  nudge(title, body, silent) {
    const f = this.state.family, a = this.authUser, ar = this.lang() === 'ar';
    if (!S.enabled || !f || !a) { if (!silent) this.flash(ar ? 'في التطبيق على الهاتف سيصل إشعار لأفراد الأسرة' : 'On the phone app, family members get a notification'); return; }
    if ((f.memberEmails || []).length < 2) { if (!silent) this.flash(ar ? 'أضف أفراد أسرتك أولاً من الإعدادات' : 'Add family members first in Settings'); return; }
    const me = (f.people || []).find((p) => p.id === a.uid);
    const from = (me && me.name) || a.name || '';
    S.sendNudge(f.id, a.uid, from, title, (from ? from + ': ' : '') + body).then(() => { if (!silent) this.flash(ar ? 'تم إرسال التذكير للأسرة' : 'Reminder sent to the family'); })
      .catch(() => { if (!silent) this.flash(ar ? 'تعذر الإرسال، تحقق من الاتصال' : 'Could not send, check your connection'); });
  }
  editRecord(r) {
    this.setState({ sheet: 'rec', rf: { type: r.type, title: this.tx(r.title), date: r.d || '', result: this.tx(r.result), who: r.who, shared: !!r.shared, img: r.img || '', editId: r.id } });
  }
  acceptInvite(f) {
    // joining another family never removes you from your current one; switch between them in Settings
    this.setState({ famPref: f.id });
    this.onFamily(f);
  }
  onFamily(fam) {
    this.setState({ family: fam, famReady: true });
    this.famObj = fam;
    if (!fam) { this.stopKinds(); return; }
    const a = this.authUser;
    if (!a) return;
    if (!(fam.people || []).some((p) => p.id === a.uid)) {
      S.updateFamily(fam.id, { people: [...(fam.people || []), { id: a.uid, name: a.name || this.state.userName || a.email.split('@')[0], email: a.email }] }).catch(() => {});
    }
    this.famObj = fam;
    this.syncEnc(fam);
    if (this.fid === fam.id) return;
    this.stopKinds(); this.fid = fam.id;
    S.KINDS.forEach((kind) => {
      this.unsubs.push(S.watchKind(fam.id, a.uid, kind, (items) => {
        if (kind === 'cards') { this.rawCards = items; this.ready.cards = true; this.applyCards(); return; }
        this.synced[kind] = new Map(items.map((i) => [String(i.id), sjson(i)]));
        this.ready[kind] = true;
        this.setState({ [kind]: items });
      }));
    });
    this.unsubs.push(S.watchSpend(fam.id, monthKey(), (h) => this.setState({ history: h, histMonth: monthKey() })));
    this.unsubs.push(S.watchNudges(fam.id, (list) => {
      const seen = this.state.nudgeSeen || Date.now() - 60000, uid = this.authUser && this.authUser.uid;
      const fresh = list.filter((n) => n.from !== uid && (n.at || 0) > seen).sort((a, b) => a.at - b.at);
      if (!fresh.length) { if (!this.state.nudgeSeen) this.setState({ nudgeSeen: Date.now() }); return; }
      fresh.forEach((n) => localAlert(n.title, n.body));
      const last = fresh[fresh.length - 1];
      this.flash(last.title);
      this.setState({ nudgeSeen: Math.max(...fresh.map((n) => n.at)) });
    }));
  }
  // ---- card encryption (family PIN) ----
  encOn() { const f = this.famObj || this.state.family; return !!(S.enabled && f && f.cardCheck && f.cardSalt); }
  async syncEnc(fam) {
    const salt = fam && fam.cardCheck ? fam.cardSalt : null;
    if (salt === this.encSalt && (fam && fam.id) === this.encFid) return;
    this.encSalt = salt; this.encFid = fam && fam.id; this.cardKey = null;
    if (salt && CR.supported()) { const k = await CR.loadKey(fam.id + ':' + salt); if (k && this.encSalt === salt && await CR.verify(k, fam.cardCheck)) this.cardKey = k; }
    this.setState({ encTick: Date.now() });
    this.applyCards();
  }
  async applyCards() {
    const raw = this.rawCards; if (!raw) return;
    const seq = (this.cardSeq = (this.cardSeq || 0) + 1);
    const on = this.encOn(), key = this.cardKey;
    const syn = new Map(), out = [];
    for (const it of raw) {
      let x = it, push = false;
      if (on && it.enc) {
        if (key) { try { x = await CR.openCard(key, it); } catch (e) { x = { ...it, _locked: true }; } }
        else x = { ...it, _locked: true };
      } else if (on && !it.enc) { push = !!key && CR.SECRET.some((k) => it[k]); } // old plaintext card → re-save encrypted
      else if (!on && it.enc) { const { enc, ...rest } = it; x = rest; push = true; } // encryption was reset → drop unreadable blob
      out.push(x); syn.set(String(x.id), push ? '' : sjson(x));
    }
    if (seq !== this.cardSeq) return;
    this.synced.cards = syn;
    const needPush = [...syn.values()].some((v) => v === '');
    this.setState({ cards: out }, () => { if (needPush) this.pushSync(); });
  }
  pushCard(item) {
    const fid = this.fid;
    if (this.encOn()) {
      if (item._locked) return;
      if (!this.cardKey) return; // never upload card numbers in clear once the family turned encryption on
      CR.sealCard(this.cardKey, item).then((sealed) => S.putItem(fid, 'cards', sealed)).catch((e) => console.warn('put', e));
    } else { const { _locked, ...rest } = item; S.putItem(fid, 'cards', rest).catch((e) => console.warn('put', e)); }
  }
  async enableCardEnc(pin) {
    const fam = this.state.family; if (!fam || !this.fid) return false;
    const salt = CR.newSalt(), key = await CR.deriveKey(pin, salt), check = await CR.makeCheck(key);
    await CR.saveKey(fam.id + ':' + salt, key);
    this.encSalt = salt; this.encFid = fam.id; this.cardKey = key;
    await S.updateFamily(fam.id, { cardSalt: salt, cardCheck: check });
    this.famObj = { ...fam, cardSalt: salt, cardCheck: check };
    this.setState({ family: this.famObj }, () => { (this.state.cards || []).forEach((c) => { if (!c._locked) this.synced.cards && this.synced.cards.set(String(c.id), ''); }); this.pushSync(); });
    return true;
  }
  async unlockCardEnc(pin) {
    const fam = this.famObj || this.state.family; if (!this.encOn()) return false;
    const key = await CR.deriveKey(pin, fam.cardSalt);
    if (!(await CR.verify(key, fam.cardCheck))) return false;
    await CR.saveKey(fam.id + ':' + fam.cardSalt, key);
    this.cardKey = key; this.setState({ encTick: Date.now() }); await this.applyCards();
    this.pushSync();
    return true;
  }
  async resetCardEnc() {
    const fam = this.state.family; if (!fam) return;
    await S.updateFamily(fam.id, { cardSalt: null, cardCheck: null });
  }
  pushSync() {
    if (!this.fid || !this.authUser) return;
    const uid = this.authUser.uid;
    S.KINDS.forEach((kind) => {
      if (!this.ready[kind]) return;
      if (kind === 'log') this.pruneLog();
      const syn = this.synced[kind], seen = new Set();
      (this.state[kind] || []).forEach((it) => {
        const item = { ...it, owner: it.owner || uid, shared: kind === 'shop' ? true : !!it.shared };
        const key = String(item.id), j = sjson(item);
        seen.add(key);
        if (syn.get(key) !== j) { if (kind === 'cards' && this.encOn() && !this.cardKey) return; syn.set(key, j); if (kind === 'cards') this.pushCard(item); else S.putItem(this.fid, kind, item).catch((e) => console.warn('put', e)); }
      });
      const gone = [...syn.keys()].filter((key) => !seen.has(key));
      if (gone.length > 2 && !(this.bulkUntil > Date.now())) { console.warn('skipped unexpected bulk delete', kind, gone.length); gone.forEach((key) => syn.delete(key)); return; }
      gone.forEach((key) => { syn.delete(key); S.delItem(this.fid, kind, key).catch((e) => console.warn('del', e)); });
    });
  }
  retryFamSoon() { setTimeout(() => { const u = this.authUser; if (!u) return; if (this.famUnsub) this.famUnsub(); this.famUnsub = S.watchFamilies(u.email, (list, err) => this.onFamilies(list, err)); }, 50); }
  pruneLog() {
    const cut = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const keep = (l) => l.d >= cut || (l.price && (l.kind === 'shop' || l.kind === 'exp'));
    if ((this.state.log || []).some((l) => !keep(l))) { this.bulkUntil = Date.now() + 2000; this.setState({ log: this.state.log.filter(keep) }); }
  }
  copyText(txt) {
    const fall = () => { try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) {} };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(fall); else fall(); } catch (e) { fall(); }
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
  }
  // tap → onTap, hold ~1s → onHold (the tap that follows a hold is ignored; moving the finger cancels, so scrolling still works)
  press(onTap, onHold) {
    return {
      down: (e) => { this._lpFired = false; this._lpXY = [e.clientX, e.clientY]; clearTimeout(this._lp); this._lp = setTimeout(() => { this._lpFired = true; onHold(); }, 900); },
      move: (e) => { if (this._lpXY && (Math.abs(e.clientX - this._lpXY[0]) > 10 || Math.abs(e.clientY - this._lpXY[1]) > 10)) clearTimeout(this._lp); },
      up: () => clearTimeout(this._lp),
      tap: (e) => { if (e && e.preventDefault) e.preventDefault(); if (this._lpFired) { this._lpFired = false; return; } onTap(); },
      menu: (e) => { if (e && e.preventDefault) e.preventDefault(); }
    };
  }
  logDone(id, entry, on) {
    const others = (this.state.log || []).filter((l) => l.id !== id);
    const me = this.myId();
    this.setState({ log: on ? [...others, { id, d: todayISO(), at: Date.now(), by: me, ...entry }] : others });
  }
  syncNotes() {
    const s = this.state, ar = this.lang() === 'ar', tx = (v) => this.tx(v), list = [];
    const pf = this.myPrefs(); const hidAll = hiddenFn(pf.hide);
    const isHid = (k) => !!pf.muteHidden && hidAll(k);
    (isHid('sched.meds') ? [] : s.meds).filter((m) => m.active).forEach((m) => m.times.forEach((tm) => {
      const [h, mi] = tm.split(':').map(Number);
      list.push({ repeatDaily: true, hour: h, minute: mi, channel: 'meds', title: (ar ? 'موعد الدواء: ' : 'Medicine time: ') + tx(m.name), body: tx(m.dose) + (tx(m.note) ? ' — ' + tx(m.note) : '') });
    }));
    (isHid('sched.appts') ? [] : s.appts.concat((s.records || []).filter((r) => r.d && r.d >= todayISO()).map((r) => ({ d: r.d, tm: r.tm, title: r.title })))).forEach((a) => {
      if (!a.d) return;
      if (a.rem && a.rem.length) list.push(...extraFor(a.rem, new Date(a.d + 'T' + (a.tm || '09:00')).getTime(), tx(a.title), ar));
      const at = new Date(a.d + 'T09:00').getTime();
      if (a.tm) {
        const real = new Date(a.d + 'T' + a.tm).getTime();
        list.push({ at: new Date(a.d + 'T20:00').getTime() - 86400000, channel: 'reminders', title: (ar ? 'غداً ' + a.tm + ': ' : 'Tomorrow ' + a.tm + ': ') + tx(a.title), body: ar ? 'تذكير بموعد الغد' : 'Reminder for tomorrow' });
        list.push({ at: Math.min(at, real - 3 * 3600000), channel: 'reminders', title: (ar ? 'اليوم ' + a.tm + ': ' : 'Today ' + a.tm + ': ') + tx(a.title), body: ar ? 'تذكير بموعد اليوم' : 'Reminder for today' });
        list.push({ at: real - 3600000, channel: 'reminders', title: (ar ? 'بعد ساعة: ' : 'In one hour: ') + tx(a.title), body: ar ? 'الموعد الساعة ' + a.tm : 'At ' + a.tm });
        return;
      }
      list.push({ at: at - 86400000, channel: 'reminders', title: (ar ? 'غداً: ' : 'Tomorrow: ') + tx(a.title), body: ar ? 'تذكير بموعد الغد' : 'Reminder for tomorrow' });
      list.push({ at, channel: 'reminders', title: (ar ? 'اليوم: ' : 'Today: ') + tx(a.title), body: ar ? 'تذكير بموعد اليوم' : 'Reminder for today' });
    });
    const ymNow = todayISO().slice(0, 7);
    const dim = (y, m) => new Date(y, m + 1, 0).getDate();
    (isHid('shop.spend') ? [] : (s.recur || [])).forEach((r) => {
      if (r.kind && r.kind !== 'plain' && r.months && r.start) {
        const [sy, sm] = r.start.split('-').map(Number); const n0 = new Date(); const idx = (n0.getFullYear() - sy) * 12 + (n0.getMonth() + 1 - sm);
        const paidN = (s.log || []).filter((l) => l.recurId === r.id).length;
        if (r.kind === 'gam') { const pd = new Date(sy, sm - 1 + (r.turn || 1) - 1, Math.min(r.day || 1, 28), 10, 0); if (pd.getTime() > Date.now()) list.push({ at: pd.getTime(), channel: 'reminders', title: (ar ? 'دورك تقبض الجمعية: ' : 'Your gam’eya payout: ') + r.name, body: ar ? 'الشهر ده دورك 🎉' : 'It’s your turn this month 🎉' }); }
        if (idx < 0 || idx >= r.months || paidN >= r.months) return;
      }
      const paid = (s.log || []).some((l) => l.recurId === r.id && (l.d || '').slice(0, 7) === ymNow);
      if (r.rem && r.rem.length) { const n0 = new Date(); let b = new Date(n0.getFullYear(), n0.getMonth(), Math.min(r.day || 1, dim(n0.getFullYear(), n0.getMonth())), 10, 0); if (paid || b.getTime() < Date.now()) b = new Date(n0.getFullYear(), n0.getMonth() + 1, Math.min(r.day || 1, dim(n0.getFullYear(), n0.getMonth() + 1)), 10, 0); list.push(...extraFor(r.rem, b.getTime(), r.name, ar)); }
      const now = new Date(); const amt = r.amount ? (ar ? ' — ' + r.amount + ' ج.م' : ' — EGP ' + r.amount) : '';
      [0, 1].forEach((k) => {
        if (k === 0 && paid) return;
        const y0 = now.getFullYear(), m0 = now.getMonth() + k;
        const due = new Date(y0, m0, Math.min(r.day || 1, dim(y0, m0)), 10, 0);
        const eve = new Date(due.getTime() - 14 * 3600000);
        if (eve.getTime() > Date.now()) list.push({ at: eve.getTime(), channel: 'reminders', title: (ar ? 'غداً موعد دفع: ' : 'Due tomorrow: ') + r.name + amt, body: ar ? 'تذكير بمصروف ثابت' : 'Fixed expense reminder' });
        if (due.getTime() > Date.now()) list.push({ at: due.getTime(), channel: 'reminders', title: (ar ? 'مستحق اليوم: ' : 'Due today: ') + r.name + amt, body: ar ? 'بعد الدفع افتح بيتنا واضغط «سجّل الدفع»' : 'After paying, open Baitna and tap “Mark paid”' });
      });
    });
    (isHid('cards') ? [] : s.cards).forEach((c) => {
      if (!c.exp) return;
      if (c.rem && c.rem.length) { const e = /^\d{4}-\d{2}$/.test(c.exp) ? c.exp + '-01' : c.exp; list.push(...extraFor(c.rem, new Date(e + 'T10:00').getTime(), (ar ? 'تنتهي: ' : 'Expires: ') + c.type, ar)); }
      const at = new Date(c.exp + 'T09:00').getTime() - 30 * 86400000;
      list.push({ at, channel: 'reminders', title: (ar ? 'تنتهي بعد شهر: ' : 'Expires in a month: ') + c.type, body: ar ? 'حان وقت التجديد' : 'Time to renew' });
    });
    try { if (!isHid('today.todos')) list.push(...todoReminders(s, this.myId(), ar)); } catch (e) {}
    try { if (!isHid('home.chores')) list.push(...choreReminders(s, this.myId(), ar)); } catch (e) {}
    try { list.push(...extraReminders(s, ar, isHid)); } catch (e) { console.warn(e); }
    syncReminders(list);
  }
  componentDidMount() {
    installDrag((l, ids, moved) => { const f = this._dragH && this._dragH[l]; if (f) f(ids, moved); });
    this.iv = setInterval(() => this.tick(), 500);
    setupNative().then(() => this.syncNotes());
    this.startSync();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setState({ locked: true, openCard: null, fullCard: null }); else this.tick(); });
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
  setCardView(v) { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, cardView: v, shared: false }], openCard: null }); }
  stepZoom(d) {
    clearTimeout(this._zt); this._zt = setTimeout(() => this.setState({ zoomOpen: false }), 4000);
    const Z = [0.85, 0.92, 1, 1.08, 1.16], cur = this.myPrefs(); const i = Math.max(0, Z.indexOf(cur.zoom || 1));
    const z = Z[Math.min(Z.length - 1, Math.max(0, i + d))]; if (z === (cur.zoom || 1)) return;
    this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, zoom: z, shared: false }] });
  }
  setPref(o) { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, ...o, shared: false }] }); }
  myPrefs() { const id = 'p_' + this.myId(); return (this.state.prefs || []).find((x) => x.id === id) || { id, hide: {} }; }
  setHide(patch) {
    const cur = this.myPrefs(); const hide = { ...(cur.hide || {}), ...patch };
    Object.keys(hide).forEach((k) => { if (!hide[k]) delete hide[k]; });
    const item = { ...cur, hide, shared: false };
    this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), item] });
  }
  renderVals() {
    const isHid = hiddenFn(this.myPrefs().hide);
    const s0 = this.state;
    const effTab = s0.tab !== 'today' && isHid(s0.tab) ? 'today' : s0.tab;
    const segKey = { appts: 'sched.appts', meds: 'sched.meds', rec: 'sched.health' };
    const effSeg = !isHid(segKey[s0.schedSeg]) ? s0.schedSeg : (['appts', 'meds', 'rec'].find((k) => !isHid(segKey[k])) || 'appts');
    const effHome = !isHid('home.' + (s0.homeSeg || 'chores')) ? (s0.homeSeg || 'chores') : (['chores', 'car', 'maint', 'warranty', 'contacts'].find((k) => !isHid('home.' + k)) || 'chores');
    const s = { ...s0, tab: effTab, schedSeg: effSeg, homeSeg: effHome }, unit = this.unit(), fast = false;
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
    const pCls = (w) => { if (w === myId) return 'pp-0'; if (w === 'home') return 'pp-h'; const i = PEOPLE.findIndex((p) => p.id === w); return 'pp-' + (((i < 0 ? 4 : i) % 4) + 1); };
    const sortMode = s.sortMode === 'person' ? 'person' : 'date';

    const T = {
      hello: this.myName() ? L('مرحباً يا ', 'Hi ') + this.myName() : L('مرحباً', 'Hello'), brand: L('بيتنا', 'Baitna'), sync: fam ? (s.online ? L('عائلة ', 'Family: ') + fam.name + L(' · متزامن', ' · synced') : L('غير متصل — ستتم المزامنة لاحقاً', 'Offline — will sync later')) : L('محفوظ على هاتفك', 'Saved on your phone'),
      langBtn: L('EN', 'ع'), familyT: L('الأسرة', 'Family'), settingsT: L('الإعدادات', 'Settings'), addPersonChip: L('+ فرد', '+ Person'), addPersonT: L('إضافة فرد', 'Add a person'), langLbl: L('اللغة', 'Language'), catsBtn: L('الأقسام', 'Categories'), encT: L('تشفير البطاقات', 'Encrypt cards'), encBanner: L('شفّر أرقام البطاقات وصورها برقم سري للأسرة', 'Encrypt card numbers & photos with a family PIN'), encOnTxt: L('أرقام البطاقات وصورها مشفّرة — لا يقرؤها أحد خارج أسرتك، ولا حتى خادم Firebase', 'Card numbers & photos are encrypted — nobody outside your family can read them, not even the server'), encIntro: L('اختر رقماً سرياً (٦ أرقام أو أكثر). ستُشفَّر أرقام البطاقات والـ IBAN والحسابات والصور على هاتفك قبل رفعها، فلا يستطيع أحد قراءتها بدون هذا الرقم.', 'Choose a PIN (6+ digits). Numbers, IBANs, accounts and photos are encrypted on your phone before upload.'), encWarn: L('⚠️ احفظ الرقم جيداً: لو نُسي لا يمكن استرجاع البطاقات. أخبر به أفراد الأسرة ليدخلوه مرة واحدة على هواتفهم.', '⚠️ Keep it safe: a forgotten PIN can’t be recovered. Share it with family members — they enter it once.'), pinPh: L('الرقم السري', 'PIN'), pin2Ph: L('أعد كتابة الرقم السري', 'Repeat PIN'), encGo: L('تفعيل التشفير', 'Turn on encryption'), needPinT: L('بطاقات الأسرة مشفّرة', 'Family cards are encrypted'), needPinS: L('أدخل الرقم السري للأسرة مرة واحدة على هذا الهاتف', 'Enter the family PIN once on this phone'), unlockGo: L('فتح', 'Unlock'), forgotPinT: L('نسيت الرقم السري؟', 'Forgot the PIN?'), priLblT: L('الأولوية', 'Priority'), inTodayLbl: L('في «اليوم»', 'On Today'), catsNote: L('قسّم مهام البيت كما تحب. اضغط مطولاً على أي قسم واسحبه لترتيبه. مفتاح «في اليوم» يحدد ما يظهر لك أنت في شاشة اليوم (لا يؤثر على باقي الأسرة).', 'Organise tasks your way. “On Today” controls what YOU see on the Today screen.'), newCatPh: L('اسم القسم (مثلاً: الحديقة)', 'Category (e.g. Garden)'), emojiPh: L('🙂', '🙂'), choresT: L('مهام البيت', 'Household tasks'), chorePh: L('أضف مهمة للبيت… (مثلاً: تصليح الحنفية)', 'Add a household task…'), takeIt: L('عليّ', 'I’ll do it'), choresDoneT: L('تمّت مؤخراً', 'Recently done'), boardT: L('أبطال الشهر', 'This month’s heroes'), allChores: L('كل المهام', 'All tasks'), repLbl: L('تتكرر', 'Repeats'), dueOpt: L('قبل تاريخ (اختياري)', 'Due by (optional)'), choreHint: L('اضغط «عليّ» لتأخذ المهمة، و✓ عند الانتهاء. اضغط على المهمة لتعيينها لشخص أو جعلها تتكرر.', 'Tap “I’ll do it” to take a task and ✓ when done. Tap a task to assign or repeat it.'), todosT: L('مهامي اليوم', 'My day'), todoPh: L('أضف مهمة سريعة…', 'Add a quick task…'), todoHint: L('اضغط على المهمة لتحديد وقت تنبيه أو إرسالها لفرد من الأسرة', 'Tap a task to set a reminder time or send it to someone'), allDoneT: L('أنجزت كل مهامك 👏', 'All done 👏'), clearDoneT: L('مسح المنجز', 'Clear done'), whenLbl2: L('متى', 'When'), forLbl: L('لمن', 'For'), tmOpt: L('تنبيه في الساعة (اختياري)', 'Remind at (optional)'), zoomLbl: L('حجم العرض', 'Display size'), zoomOutA: L('تصغير', 'Smaller'), zoomInA: L('تكبير', 'Larger'), zoomHint: L('صغّر لترى محتوى أكثر في الشاشة، أو كبّر لقراءة أسهل', 'Smaller fits more on screen; larger is easier to read'), remT: L('تنبيه إضافي', 'Extra reminder'), dossierT: L('الملف الطبي', 'Medical file'), dossierS: L('صور التحاليل والأشعة والتقارير والروشتات', 'Results, scans, reports, prescriptions'), dosAddBtn: L('إضافة نتيجة أو صورة', 'Add a result or photo'),
      dosEmptyT: L('الملف فارغ', 'Nothing here yet'), dosEmptyS: L('صوّر أي تحليل أو أشعة أو تقرير، ويبقى محفوظاً لكل الأسرة', 'Snap any lab result, scan or report — kept safely for the family'),
      dosTitleLbl: L('العنوان', 'Title'), dosTitlePh: L('مثلاً: صورة دم كاملة — معمل البرج', 'e.g. CBC — Al Borg lab'), dosPhotos: L('صوّر أو اختر الصفحات (يمكن أكثر من صفحة)', 'Snap or pick pages (several allowed)'),
      dosNoteLbl: L('ملاحظة (اختياري)', 'Note (optional)'), dosNotePh: L('مثلاً: الدكتور طلب إعادته بعد ٣ أشهر', 'e.g. repeat in 3 months'), sharePage: L('مشاركة الصفحة', 'Share page'), addPage: L('صفحة', 'Page'), delPage: L('حذف الصفحة', 'Delete page'), delAllPages: L('حذف الملف كله', 'Delete all'), fromContacts: L('اختر من جهات الاتصال', 'Pick from contacts'), searchPh: L('ابحث بالاسم أو الرقم أو المجموعة', 'Search name, number or group'), groupsBtn: L('المجموعات', 'Groups'), noMatchT: L('لا توجد نتائج', 'No results'), groupLbl: L('المجموعة', 'Group'), newGroup: L('مجموعة جديدة', 'New group'), groupPh: L('اسم المجموعة (مثلاً: مدرسة الأولاد)', 'Group name (e.g. Kids’ school)'),
      groupsNote: L('قسّم الأرقام كما تحب: غيّر الأسماء، رتّبها بالأسهم، أو أضف مجموعات جديدة. التعديل يظهر لكل الأسرة.', 'Organise contacts your way: rename, reorder or add groups. Changes are shared with the family.'),
      carBasic: L('البيانات الأساسية', 'Basics'), makeLbl: L('الماركة', 'Make'), makePh: L('هيونداي', 'Hyundai'), modelLbl: L('الموديل', 'Model'), modelPh: L('إلنترا', 'Elantra'), yearLbl: L('سنة الصنع', 'Year'), colorLbl: L('اللون', 'Colour'),
      carNickname: L('اسم مختصر (اختياري)', 'Nickname (optional)'), carNicknamePh: L('مثلاً: عربية البيت', 'e.g. Family car'), carMore: L('بيانات إضافية لتحليل أوسع', 'More details for deeper analysis'), carMoreS: L('(اختياري)', '(optional)'),
      fuelTypeLbl: L('نوع الوقود وناقل الحركة', 'Fuel & transmission'), tankLbl: L('سعة التانك (لتر)', 'Tank (L)'), ccLbl: L('سعة المحرك (سي سي)', 'Engine (cc)'), ratedLbl: L('استهلاك المصنع (كم/لتر)', 'Rated economy (km/L)'), ratedPh: L('من كتالوج العربية', 'From the manual'),
      buyDateLbl: L('تاريخ الشراء', 'Bought on'), buyKmLbl: L('العداد عند الشراء', 'Km at purchase'), buyPriceLbl: L('سعر الشراء (اختياري)', 'Purchase price (optional)'), licEndLbl: L('انتهاء الرخصة', 'Licence expiry'), insEndLbl: L('انتهاء التأمين', 'Insurance expiry'),
      carProfile: L('ملف العربية', 'Car profile'), shopAnT: L('تحليل المشتريات', 'Shopping analysis'), saEmpty: L('سجّل أسعار المشتريات لتظهر التحليلات', 'Record prices to see the analysis'), saWeekly: L('متوسط الأسبوع', 'Per week'), saTotal: L('إجمالي المشتريات', 'Total shopping'), saVisits: L('أيام شراء', 'Shopping days'),
      saDue: L('قرب موعد شرائها حسب عادتكم', 'Due by your habit'), saMonthly: L('آخر ٦ أشهر', 'Last 6 months'), saTop: L('أكثر ما تصرفون عليه', 'Where the money goes'), saRhythm: L('إيقاع الشراء', 'Buying rhythm'), byStoreT: L('حسب المتجر', 'By store'), cardViewT: L('طريقة العرض', 'View'), viewWallet: L('محفظة', 'Wallet'), viewTiles: L('مربعات', 'Tiles'), layoutT: L('تخصيص الواجهة', 'Customise screens'), layoutS: L('أظهر أو أخفِ الأقسام على هاتفك', 'Show or hide sections on your phone'), layoutNote: L('الإخفاء لشاشتك أنت فقط. البيانات تبقى محفوظة وتصل لباقي الأسرة كالمعتاد، وتعود فوراً عند الإظهار.', 'Hiding only affects your screens. Data stays saved and synced for the family, and comes back instantly.'), muteT: L('إيقاف تذكيرات الأقسام المخفية', 'Mute reminders of hidden sections'), muteS: L('بشكل افتراضي تصلك التذكيرات حتى من الأقسام المخفية', 'By default you still get reminders from hidden sections'), showAllBtn: L('إظهار كل الأقسام', 'Show everything'), layoutTip: L('للترتيب: اضغط مطولاً على أي قسم ثم اسحبه لمكانه الجديد وأفلته. تلميح: الضغط المطوّل على أي قسم في الشريط السفلي يخفيه بسرعة.', 'To reorder: press and hold a row, drag it, then drop. Tip: long-press a tab in the bottom bar to hide it.'),
      reportBtn: L('📊 التقرير', '📊 Report'), emergBtn: L('طوارئ', 'Emergency'), emergTitle: L('بطاقة الطوارئ الطبية', 'Medical emergency card'), ambulance: L('الإسعاف ١٢٣', 'Ambulance 123'),
      bloodLbl: L('فصيلة الدم', 'Blood type'), allergyLbl: L('الحساسية', 'Allergies'), chronicLbl: L('أمراض مزمنة', 'Chronic conditions'), currentMeds: L('أدوية حالية', 'Current medicines'), insuranceLbl: L('التأمين الصحي', 'Health insurance'),
      allergyPh: L('مثلاً: بنسلين، فول سوداني', 'e.g. penicillin, peanuts'), chronicPh: L('مثلاً: ضغط، سكر، ربو', 'e.g. hypertension, diabetes, asthma'), birthLbl: L('تاريخ الميلاد', 'Date of birth'),
      iceLbl: L('رقم للطوارئ (اسم ورقم)', 'Emergency contact (name & number)'), icePh: L('مثلاً: منى 010…', 'e.g. Mona 010…'),
      mBp: L('الضغط', 'BP'), mSugar: L('السكر', 'Sugar'), mWeight: L('الوزن', 'Weight'), mHeight: L('الطول', 'Height'), measuresOpen: L('القياسات والرسم البياني', 'Readings & chart'),
      editHp: L('تعديل الملف', 'Edit profile'), newReading: L('قراءة', 'Reading'), vaxT: L('التطعيمات', 'Vaccinations'), toAppt: L('أضف للمواعيد', 'Add to calendar'),
      vaxTemplate: L('إضافة جدول التطعيمات الإجباري', 'Add the standard vaccination schedule'), vaxNote: L('جدول مبدئي حسب التطعيمات الإجبارية في مصر — راجعه مع كارت التطعيم وطبيب الأطفال، وعدّل أي بند.', 'A starting template based on Egypt’s mandatory schedule — check it against the vaccination card and your paediatrician.'),
      recordsT: L('الزيارات والتحاليل', 'Visits & tests'), ctxRand: L('عشوائي', 'Random'), ctxFast: L('صائم', 'Fasting'), ctxAfter: L('بعد الأكل بساعتين', '2h after meal'),
      chartHint: L('سجّل قراءتين على الأقل ليظهر الرسم البياني', 'Add at least two readings to see the chart'), shareDoctor: L('مشاركة القراءات مع الطبيب', 'Share readings with the doctor'),
      medDisclaimer: L('الأرقام الطبيعية للإرشاد فقط ولا تغني عن استشارة الطبيب.', 'Normal ranges are for guidance only — not medical advice.'),
      totalLbl: L('إجمالي المصروفات', 'Total spent'), shopLbl: L('مشتريات', 'Shopping'), otherLbl: L('أخرى', 'Other'),
      byCatT: L('حسب البند', 'By category'), dailyT: L('الصرف يوماً بيوم', 'Day by day'), topT: L('أكبر خمسة بنود', 'Top five'), priceChT: L('أصناف تغيّر سعرها', 'Price changes'), byWhoT: L('حسب الشخص', 'By person'), shareReport: L('مشاركة التقرير', 'Share report'),
      noCarT: L('أضف عربيتك', 'Add your car'), noCarS: L('نتابع لك تغيير الزيت والصيانة والبنزين والترخيص في مكان واحد', 'Track oil changes, service, fuel and license in one place'),
      updKm: L('📷 تحديث العداد', '📷 Update'), consumption: L('استهلاك', 'Economy'), fuelMonth: L('بنزين الشهر', 'Fuel this month'), servMonth: L('صيانة الشهر', 'Service this month'),
      fuelUp: L('تموين', 'Fuel'), logService: L('سجّل صيانة', 'Log service'), maintSched: L('جدول الصيانة', 'Maintenance'), doneBtn: L('تمّت', 'Done'), addMaintItem: L('بند صيانة', 'Maintenance item'),
      carDocs: L('أوراق العربية (من البطاقات)', 'Car documents (from Cards)'), serviceLog: L('سجل الصيانة', 'Service history'), addCarBtn: L('إضافة عربية', 'Add a car'),
      suggested: L('مقترحات', 'Suggestions'), customItem: L('بند آخر', 'Other item'), warrantyHint: L('صوّر الفاتورة واحفظ مدة الضمان، ونذكّرك قبل انتهائه بشهر.', 'Photograph the invoice and set the warranty — we remind you a month before it ends.'),
      addWarrantyBtn: L('جهاز وضمان', 'Device & warranty'), contactsHint: L('اضغط مطولاً على أي رقم لنسخه.', 'Long-press a contact to copy the number.'), addContactBtn: L('رقم جديد', 'New contact'), callT: L('اتصال', 'Call'),
      carName: L('اسم العربية', 'Car name'), fullTank: L('ملأت التانك للآخر', 'Filled the tank'), fullTankS: L('أدق حساب للاستهلاك يكون من تانك كامل لتانك كامل', 'Full-to-full gives the most accurate economy'), fuelAnalysis: L('تحليل استهلاك البنزين', 'Fuel economy'), costPerKm: L('تكلفة الكيلو', 'Cost/km'), lastTank: L('آخر تانك', 'Last tank'), yourAvg: L('متوسطك', 'Your average'), checkThese: L('راجع هذه الأسباب المحتملة:', 'Possible causes to check:'), fillUps: L('آخر التفويلات', 'Recent fill-ups'), carNamePh: L('مثلاً: هيونداي إلنترا ٢٠٢٠', 'e.g. Hyundai Elantra 2020'), plate: L('رقم اللوحة (اختياري)', 'Plate (optional)'), odometer: L('العداد (كم)', 'Odometer (km)'),
      carPresetNote: L('سنضيف جدول صيانة مقترحاً (زيت، فلتر، فرامل…) تقدر تعدّله.', 'We’ll add a suggested schedule (oil, filters, brakes…) you can edit.'),
      kmUnitHint: L('صوّر العداد ونقرأ الرقم لك، أو اكتبه بنفسك', 'Snap the odometer and we read it, or type it'), fuelCost: L('المبلغ', 'Amount'), liters: L('اللترات', 'Litres'),
      fuelHint: L('للمتابعة وتحليل الاستهلاك فقط — لا يُضاف لمصروفات الشهر', 'For tracking and fuel economy only — not added to monthly expenses'), serviceWhat: L('نوع الصيانة', 'Service'),
      costOpt: L('التكلفة (اختياري — تُضاف للمصروفات)', 'Cost (optional — added to expenses)'), noteOpt: L('ملاحظة', 'Note'), maintItemLbl: L('اسم البند', 'Item'),
      everyMonths: L('كل كام شهر', 'Every N months'), everyKm: L('أو كل كام كيلو', 'or every N km'), lastTime: L('آخر مرة', 'Last done'), lastKm: L('عند عداد', 'At km'),
      deviceName: L('الجهاز', 'Device'), devicePh: L('مثلاً: غسالة، تلاجة، موبايل', 'e.g. washer, fridge, phone'), brandLbl: L('الماركة', 'Brand'), storeLbl: L('المحل', 'Store'), buyDate: L('تاريخ الشراء', 'Bought on'),
      warrantyLen: L('مدة الضمان', 'Warranty'), serviceCenter: L('رقم خدمة العملاء/الصيانة (اختياري)', 'Service centre number (optional)'), invoicePhoto: L('📷 صورة الفاتورة', '📷 Invoice photo'),
      contactName: L('الاسم', 'Name'), phoneLbl: L('الرقم', 'Number'), themeLbl: L('المظهر', 'Theme'),
      famOptApp: L('يستخدم التطبيق', 'Uses the app'), famOptAppS: L('زوج/زوجة أو ابن له هاتف — نرسل له دعوة', 'Spouse or child with a phone — send an invite'), famOptDep: L('بلا هاتف', 'No phone'), famOptDepS: L('طفل أو فرد تديرون مواعيده وأدويته', 'A child or someone you manage'), langAria: L('Switch to English', 'التحويل إلى العربية'), themeAria: L('تغيير المظهر', 'Change theme'),
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
      segAppts: L('مواعيد', 'Appointments'), segMeds: L('أدوية', 'Medicines'), segRec: L('الصحة', 'Health'),
      noMeds: L('لا توجد أدوية هنا', 'No medicines here'), addMed: L('+ دواء جديد', '+ New medicine'), stoppedLink: L('الأدوية المتوقفة ←', 'Stopped medicines →'),
      addRec: L('+ تحليل / أشعة / كشف', '+ Test / scan / visit'),
      mRec: L('تحليل / أشعة / كشف', 'Test / scan / visit'), mRecSub: L('يُحفظ في السجل الطبي', 'Saved to the medical record'),
      medName: L('اسم الدواء', 'Medicine name'), medNamePh: L('مثلاً: كونكور ٥', 'e.g. Concor 5'), dose: L('الجرعة', 'Dose'), dosePh: L('مثلاً: ١ قرص', 'e.g. 1 tablet'),
      times: L('المواعيد اليومية', 'Daily times'), addTime: L('+ موعد آخر', '+ Another time'), medNote: L('ملاحظة', 'Note'), medNotePh: L('مثلاً: بعد الأكل', 'e.g. after food'),
      stopMed: L('أوقفتُ هذا الدواء', 'I stopped this medicine'), stopShort: L('أوقفته', 'Stopped'), stopHint: L('سيختفي من الجدول ويبقى في السجل الطبي', 'It leaves the schedule but stays in the medical record'),
      recDate: L('التاريخ (إن كان قادماً يظهر أيضاً في المواعيد)', 'Date (if upcoming, it also shows in appointments)'), result: L('النتيجة / ملاحظات', 'Result / notes'), resultPh: L('مثلاً: النتائج طبيعية', 'e.g. all normal'),
      attach: L('إرفاق صورة أو PDF', 'Attach a photo or PDF'),
      addCard: L('+ إضافة بطاقة', '+ Add a card'), noCards: L('لم تُضف أي بطاقة بعد', 'No cards yet'),
      cardKind: L('التصنيف', 'Category'), cardIssuer: L('البنك', 'Bank'), cardIssuerPh: L('مثلاً: البنك الأهلي', 'e.g. National Bank'),
      cardLast4: L('رقم البطاقة (يكفي آخر ٤ أرقام)', 'Card number (last 4 digits is enough)'), cardExpMonth: L('تاريخ الانتهاء (شهر/سنة)', 'Expiry (month/year)'),
      hotline: L('رقم خدمة العملاء (للإبلاغ عن فقد البطاقة)', 'Customer service number (to report a lost card)'), callBank: L('اتصال بخدمة العملاء', 'Call customer service'),
      acctShort: L('الحساب', 'Account'), ibanLbl: L('رقم IBAN (اختياري)', 'IBAN (optional)'), acctLbl: L('رقم الحساب (اختياري)', 'Account number (optional)'), ibanBad: L('تأكد من رقم IBAN — يبدو أن فيه خطأ', 'Check the IBAN — it looks wrong'), copyIbanT: L('نسخ IBAN', 'Copy IBAN'), copyAcctT: L('نسخ رقم الحساب', 'Copy account no.'),
      bankWarn: L('لا تحفظ أبداً الرقم السري (PIN) أو رمز CVV المكتوب خلف البطاقة.', 'Never store the PIN or the CVV code on the back of the card.'),
      cardType: L('نوع البطاقة', 'Card type'),
      cardTypePh: L('أو اكتب نوعاً آخر', 'or type another'), cardNum: L('الرقم', 'Number'), cardExp: L('تاريخ الانتهاء (اختياري)', 'Expiry date (optional)'),
      frontPhoto: L('صورة الوجه', 'Front photo'), backPhoto: L('صورة الظهر', 'Back photo'), photoAdded: L('✓ أُضيفت', '✓ added'),
      editCard: L('تعديل', 'Edit'), yourName: L('اسمك', 'Your name'), noDosesToday: L('لا توجد أدوية مسجلة. أضفها من قسم المواعيد ← أدوية.', 'No medicines yet. Add them from Schedule → Medicines.'),
      noUpcoming: L('لا توجد مواعيد قادمة', 'No upcoming appointments'),
      loginTitle: L('تسجيل الدخول', 'Sign in'), signupTitle: L('حساب جديد', 'Create account'), email: L('البريد الإلكتروني', 'Email'),
      password: L('كلمة المرور', 'Password'), yourNameReq: L('اسمك (يظهر لأفراد أسرتك)', 'Your name (shown to your family)'),
      loginBtn: L('دخول', 'Sign in'), signupBtn: L('إنشاء الحساب', 'Create account'), toSignup: L('ليس لديك حساب؟ أنشئ حساباً', 'No account? Create one'),
      toLogin: L('لديك حساب؟ سجّل الدخول', 'Have an account? Sign in'), forgot: L('نسيت كلمة المرور؟', 'Forgot password?'),
      loginHint: L('سجّل ببريدك الإلكتروني ليُشارَك التطبيق بينك وبين أفراد أسرتك', 'Sign in with your email to share the app with your family'),
      famTitle: L('أسرتك', 'Your family'), famEmailNote: L('دخلت بالبريد: ', 'Signed in as: '), famNotYou: L('ليس بريدك المعتاد؟ سجّل الخروج وادخل به', 'Not your usual email? Sign out and use it'), famCreateHint: L('أنشئ مجموعة لأسرتك، ثم أضف بريد كل فرد من الإعدادات', 'Create your family group, then add each member’s email from Settings'),
      famName: L('اسم الأسرة', 'Family name'), famNamePh: L('مثلاً: أسرة كمال', 'e.g. The Kamal family'), famCreate: L('إنشاء الأسرة', 'Create family'),
      famJoinHint: L('أو اطلب من أحد أفراد أسرتك إضافة بريدك من الإعدادات، وسينضم حسابك تلقائياً:', 'Or ask a family member to add your email in Settings — you will join automatically:'),
      logout: L('تسجيل الخروج', 'Sign out'), loading: L('جارٍ التحميل…', 'Loading…'),
      members: L('أفراد الأسرة', 'Family members'), invitePh: L('بريد فرد جديد', 'New member’s email'), invite: L('إضافة', 'Add'),
      pendingTag: L('بانتظار التسجيل', 'Not joined yet'), depPh: L('الاسم (مثلاً: يوسف)', 'Name (e.g. Youssef)'),
      depHint: L('الأطفال ومن لا يملك هاتفاً: أضفهم بالاسم ليظهروا في خيارات «لمن»', 'Children or anyone without a phone: add them by name for the “For” options'),
      localNote: L('المشاركة غير مفعّلة في هذه النسخة: البيانات محفوظة على هذا الهاتف فقط', 'Sharing is not enabled in this build: data stays on this phone'),
      budgetLbl: L('ميزانية الشهر (ج.م)', 'Monthly budget (EGP)'),
      joinTitle: L('الانضمام بكود', 'Join with a code'), joinPh: L('مثلاً: ABCD-2345', 'e.g. ABCD-2345'), joinBtn: L('انضمام', 'Join'),
      joinHint: L('اطلب الكود من أحد أفراد أسرتك (من الإعدادات › مشاركة دعوة)', 'Ask a family member for the code (Settings › Share invitation)'),
      shareInviteBtn: L('مشاركة دعوة (واتساب وغيره)', 'Share invitation (WhatsApp, etc.)'), inviteCodeLbl: L('كود الأسرة:', 'Family code:'),
      orEmail: L('أو أضف بريده مباشرة:', 'Or add their email directly:'), decline: L('رفض', 'Decline'), invitesTitle: L('دعوات', 'Invitations'),
      editBtn: L('تعديل', 'Edit'), tapToEdit: L('اضغط على أي موعد لتعديله', 'Tap an appointment to edit it'),
      listTitle: L('القائمة', 'The list'), newItemTitle: L('صنف جديد — اختر نوع الكمية', 'New item — choose the unit'), unitOptional: L('بدون وحدة', 'No unit'),
      setPriceBtn: L('+ السعر', '+ Price'), exportBtn: L('تصدير المصروفات', 'Export expenses'), exportFile: L('تصدير ملف Excel (CSV)', 'Export Excel file (CSV)'),
      from: L('من', 'From'), to: L('إلى', 'To'), receiptBtn: L('مسح إيصال', 'Scan a receipt'), dictBtn: L('إملاء', 'Dictate'),
      dictHint: L('تكلّم أو اكتب بشكل طبيعي، وأنا أسجّله في مكانه. أمثلة: «عندي كشف أسنان يوم الخميس الساعة ٥ ونص» — «٢ كيلو طماطم وكيس حليب» — «يوسف ياخد شراب الكحة مرتين في اليوم» — «شغّل مؤقت للمكرونة ١٠ دقائق»', 'Speak or type naturally and I will file it. E.g. “Dentist on Thursday at 5:30”, “2 kg tomatoes and a bag of milk”, “Youssef takes cough syrup twice a day”, “Start a 10-minute pasta timer”'),
      mic: L('تحدّث', 'Speak'), understand: L('افهمها', 'Understand'), reading: L('جارٍ القراءة على هاتفك… (أول مرة تأخذ ثوانٍ)', 'Reading on your phone… (first time takes a few seconds)'),
      reviewHintR: L('راجع الأصناف والأسعار، والأصناف الموجودة في قائمتك ستُعلَّم كمُشتراة', 'Check items and prices; items already on your list get checked off'),
      reviewHintL: L('راجع ما فهمته ثم احفظه — اضغط على الاسم لتعديله', 'Check what I understood, then save — tap a name to edit it'), noDateWarn: L('بلا تاريخ', 'No date'), addExp: L('+ مصروف آخر (إيجار، فواتير…)', '+ Other expense (rent, bills…)'), fixedExp: L('مصروفات ثابتة وأقساط وجمعيات', 'Fixed, installments & gam’eya'), duesT: L('مستحقات قريبة', 'Coming up to pay'), recentExpT: L('آخر المصروفات', 'Recent expenses'),
      expWhat: L('البند', 'What for'), expWhatPh: L('مثلاً: إيجار الشقة / فاتورة الكهرباء', 'e.g. Rent / electricity bill'), expAmt: L('المبلغ', 'Amount'), expCat: L('النوع', 'Category'), expDate: L('التاريخ', 'Date'), paidBy: L('دفعها', 'Paid by'),
      recurT: L('يتكرر كل شهر', 'Repeats monthly'), paidNowT: L('دُفع هذا الشهر بالفعل', 'Already paid this month'), paidNowS: L('اتركه مغلقاً ليظهر لك يوم الاستحقاق وتؤكد دفعه بنفسك', 'Leave off to confirm it yourself on the due day'), dayPh: L('من ١ إلى ٣١', '1 to 31'), amtOpt: L('المبلغ (اتركه فارغاً لو الفاتورة متغيرة)', 'Amount (leave empty if it varies)'), dayHint: L('لو اخترت ٢٩ أو ٣٠ أو ٣١ يُحسب آخر يوم في الشهور الأقصر', 'Days 29–31 fall on the last day in shorter months'), recurS: L('يظهر لك كل شهر لتأكيد دفعه بضغطة، مع تذكير في موعده', 'Shows every month to confirm with one tap, with a reminder'), recurDay: L('يوم الاستحقاق', 'Due day'), stopRecur: L('إيقاف المصروف الثابت', 'Stop fixed expense'),
      mExp: L('مصروف', 'Expense'), ckindLbl: L('نوع الالتزام', 'Commitment type'), monthsLbl: L('عدد الأشهر', 'Number of months'), startLbl: L('أول شهر', 'First month'), turnLbl: L('دورك رقم', 'Your turn #'), monthsGamLbl: L('عدد الأشهر (= عدد الأفراد)', 'Months (= members)'), mExpSub: L('إيجار، فواتير، مدارس، بنزين…', 'Rent, bills, school, fuel…'), voiceBtn: L('قل ما تريد تسجيله', 'Say what to record'), forWhom: L('لـ:', 'For:'), confirmAdd: L('حفظ الكل', 'Save all'), priceShort: L('السعر', 'Price'), remindFam: L('تذكير الأسرة', 'Remind family'), remindShop: L('ذكّر الأسرة بالمشتريات', 'Remind family to shop'), shareList: L('مشاركة القائمة', 'Share the list'),
      famErrTxt: L('تعذّر الاتصال بأسرتك. تأكد من الإنترنت ثم أعد المحاولة — بياناتك محفوظة ولن تُنشأ أسرة جديدة.', 'Could not reach your family. Check the internet and retry — your data is safe and no new family will be created.'),
      retry: L('إعادة المحاولة', 'Retry'), myFamsLbl: L('أسرك (اضغط للتبديل):', 'Your families (tap to switch):'),
      apptsTitle: L('المواعيد', 'Appointments'), doneTitle: L('تم إنجازه', 'Done'), todayDoneTitle: L('أُنجز اليوم', 'Done today'), markDone: L('تم', 'Done'), calendar: L('التقويم', 'Calendar'), prevG: L('›', '‹'), nextG: L('‹', '›'), prevMonth: L('الشهر السابق', 'Previous month'), nextMonth: L('الشهر التالي', 'Next month'),
      noDayItems: L('لا توجد مواعيد في هذا اليوم', 'Nothing on this day'), addOnDay: L('+ إضافة موعد في هذا اليوم', '+ Add on this day'), backToday: L('اليوم', 'Today'),
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
      title: L('العنوان', 'Title'), type: L('النوع', 'Type'), forWho: L('لمن', 'For'), visibility: L('الظهور', 'Visibility'),
      sharedWife: L('ظاهر لكل الأسرة', 'Visible to the family'), privateMe: L('مخفي عن الأسرة', 'Hidden from the family'),
      visHint: L('«لمن» = صاحب الموعد. «الظهور» = من يستطيع رؤيته. المخفي يراه من أضافه فقط.', '“For” is whose it is. “Visibility” is who can see it. Hidden items are seen only by whoever added them.'),
      sortDate: L('حسب الموعد', 'By date'), sortPerson: L('حسب الشخص', 'By person')
    };

    const tabs = ['today', 'kitchen', 'sched', 'cards', 'shop', 'home'];
    const nav = {}, go = {};
    const navHold = {};
    tabs.forEach((k) => { nav[k] = s.tab === k ? 'nb-on' : 'nb';
      const pr = this.press(() => this.setState({ tab: k }), () => {
        if (k === 'today') return;
        const nm = { kitchen: L('المطبخ', 'Kitchen'), sched: L('المواعيد', 'Schedule'), cards: L('البطاقات', 'Cards'), shop: L('المشتريات', 'Shopping'), home: L('البيت', 'Home') }[k];
        if (!window.confirm(L('إخفاء «' + nm + '» من شاشتك؟\nالبيانات تبقى محفوظة ويراها باقي الأسرة، ويمكنك إرجاعه من الإعدادات ← تخصيص الواجهة.', 'Hide “' + nm + '” from your screen?\nData stays saved for the family; bring it back in Settings → Customise.'))) return;
        this.setHide({ [k]: true }); this.flash(L('أُخفي «' + nm + '»', 'Hid “' + nm + '”'));
      });
      go[k] = pr.tap; navHold[k] = pr; });

    const themeList = [
      ['mint', L('نعناع', 'Mint'), L('فاتح وهادئ', 'Light and calm')], ['night', L('ليل', 'Night'), L('داكن ومريح للعين', 'Dark, easy on the eyes')],
      ['sand', L('رملي', 'Sand'), L('دافئ بدرجات البني', 'Warm browns')], ['ocean', L('بحري', 'Ocean'), L('أزرق ونظيف', 'Clean blue')],
      ['onyx', L('أونيكس', 'Onyx'), L('أسود وذهبي', 'Black & gold'), true], ['emerald', L('زمرّد', 'Emerald'), L('أخضر ملكي ولمسة ذهب', 'Royal green & gold'), true], ['pearl', L('لؤلؤ', 'Pearl'), L('عاجي وشمبانيا', 'Ivory & champagne'), true]
    ];
    const themes = themeList.map(([id, name, desc, prem]) => ({
      name, desc, prem: !!prem, miniCls: 'mini th-' + id, cardCls: (theme === id ? 'thc-on' : 'thc') + (prem ? ' thc-prem' : ''),
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
      appt: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
      maint: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'
    };
    const fmtTm = (v) => { if (!v) return ''; const [h, m] = v.split(':').map(Number); if (!isAr) return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); return num((h % 12 || 12) + ':' + String(m).padStart(2, '0')) + (h < 12 ? ' ص' : ' م'); };
    const decorate = (x) => ({
      id: x.id, title: tx(x.title), who: WHO[x.who] || x.who, cat: x.cat,
      when: (x.d ? (() => { try { return new Date(x.d + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return x.d; } })() : tx(x.when)) + (x.tm ? ' · ' + fmtTm(x.tm) : ''),
      bCls: x.shared ? 'b-none' : 'b-lock', bTxt: x.shared ? '' : L('مخفي', 'Hidden'),
      whoPill: WHO[x.who] || '', pCls: 'pp ' + pCls(x.who),
      tileCls: 'tile cat-' + x.cat, catCls: 'cat-' + x.cat, icon: catIcon[x.cat], isMed: x.cat === 'med'
    });
    const REC_LBL = { visit: L('كشف', 'Visit'), lab: L('تحليل', 'Lab test'), img: L('أشعة', 'Imaging') };
    const recAppts = (s.records || []).filter((r) => r.d && r.d >= todayISO()).map((r) => ({
      id: 'rec:' + r.id, recId: r.id, title: (tx(r.title).startsWith(REC_LBL[r.type] || '~') ? '' : (REC_LBL[r.type] || '') + ': ') + tx(r.title), who: r.who, d: r.d, cat: 'appt', shared: !!r.shared
    }));
    const maintAppts = maintDueList(s).filter((x) => x.d <= addDaysISO(60) && !isHid(x.m.carId ? 'home.car' : 'home.maint')).map((x) => ({
      id: 'mt:' + x.m.id, maintId: x.m.id, carId: x.m.carId || null, title: (x.car ? x.car.name + ': ' : '') + x.m.name + (x.est ? L(' — وصلت للكيلومترات', ' — mileage reached') : ''),
      who: 'home', d: x.d, cat: 'maint', shared: true
    }));
    const apptsAll = s.appts.concat(recAppts, maintAppts);
    const takeFn = (id) => () => this.setState({ taken: { ...this.state.taken, [id]: !this.state.taken[id] } });
    const longDateS = (iso) => { try { return new Date(iso + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return iso; } };
    const mkAppt = (x) => {
        const tk = !!s.taken[x.id];
        const srcRec = x.recId ? (s.records || []).find((r) => r.id === x.recId) : null;
        const doneOn = srcRec ? srcRec.doneOn : x.doneOn;
        return { ...decorate(x), tCls: tk ? 't1 strike' : 't1', takeCls: tk ? 'btn-g' : 'btn', takeTxt: tk ? L('تم ✓ — تراجع', 'Taken ✓ — undo') : L('تم تناوله', 'Mark as taken'), take: takeFn(x.id),
          isDone: !!doneOn, ckCls: doneOn ? 'ck-on' : 'ck', nameCls: doneOn ? 'it-name-done' : 'it-name',
          toggleDone: (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (x.maintId) { const m = (this.state.maint || []).find((y) => y.id === x.maintId); const car = x.carId ? (this.state.cars || []).find((y) => y.id === x.carId) : null;
              if (m) this.setState({ sheet: 'service', hf: { mid: m.id, carId: m.carId || null, name: m.name, d: todayISO(), km: car && car.km != null ? String(car.km) : '', cost: '', note: '' } }); return; }
            const on = !doneOn, val = on ? todayISO() : null;
            if (x.recId) this.setState({ records: this.state.records.map((r) => r.id === x.recId ? { ...r, doneOn: val } : r) });
            else this.setState({ appts: this.state.appts.map((y) => y.id === x.id ? { ...y, doneOn: val } : y) });
            this.logDone('a:' + x.id, { kind: 'appt', text: tx(x.title), who: x.who, shared: !!x.shared }, on);
            if (on && x.cat === 'bill') this.setState({ sheet: 'exp', ef: { text: tx(x.title), amount: '', ecat: guessECat(tx(x.title)), d: todayISO(), who: x.who === 'home' ? myId : (x.who || myId), recur: false, day: Number(todayISO().slice(8)), apptId: x.id } });
          },
          canRemind: !!x.shared && !doneOn && !x.maintId, canDel: !x.maintId,
          remind: (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.nudge(L('تذكير: ', 'Reminder: ') + tx(x.title), (x.d ? longDateS(x.d) : '') + (WHO[x.who] ? ' · ' + WHO[x.who] : ''));
          },
          edit: () => {
            if (x.maintId) { this.setState({ tab: 'home', homeSeg: x.carId ? 'car' : 'maint' }); return; }
            if (x.recId) { const r = this.state.records.find((y) => y.id === x.recId); if (r) this.editRecord(r); return; }
            this.setState({ sheet: 'appt', form: { ...this.state.form, title: tx(x.title), when: x.d || '', tm: x.tm || '', cat: x.cat, who: x.who, shared: !!x.shared, rem: x.rem || [], editId: x.id } });
          },
          del: (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (x.maintId) { this.setState({ tab: 'home', homeSeg: x.carId ? 'car' : 'maint' }); return; }
            if (x.recId) { if (!window.confirm(L('حذف هذا الكشف من المواعيد والسجل الطبي؟', 'Delete this visit from appointments and the medical record?'))) return; this.setState({ records: this.state.records.filter((y) => y.id !== x.recId) }); return; }
            if (!window.confirm(L('حذف هذا الموعد؟', 'Delete this appointment?'))) return; this.setState({ appts: this.state.appts.filter((y) => y.id !== x.id) });
          } };
      };
    const items = apptsAll.slice().sort((a, b) => (a.d || '9').localeCompare(b.d || '9'))
      .filter((x) => s.cat === 'all' || x.cat === s.cat)
      .filter((x) => s.scope === 'all' || (s.scope === 'shared') === x.shared)
      .map(mkAppt);
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
        boxCls: tk ? 'it-done' : (nx ? 'it-next' : 'it'), byInit: INIT[m.who], byCls: byCls(m.who), whoName: WHO[m.who], who: m.who, whoPill: WHO[m.who] || '', pCls: 'pp ' + pCls(m.who), hidden: !m.shared,
        take: () => {
          const cut = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
          this.setState({ meds: this.state.meds.map((mm) => {
            if (mm.id !== m.id) return mm;
            const hist = {}; Object.keys(mm.takenOn || {}).forEach((d) => { if (d >= cut) hist[d] = mm.takenOn[d]; });
            return { ...mm, takenOn: { ...hist, [TD]: { ...(hist[TD] || {}), [tm]: !tk } } };
          }) });
          this.logDone('m:' + m.id + ':' + tm + ':' + TD, { kind: 'med', text: tx(m.dose) + ' – ' + tx(m.name), tm, who: m.who, shared: !!m.shared }, !tk);
        },
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
      .map((r) => ({ ...r, open: () => this.setState({ sheet: 'recView', recView: r.id }), date: fmtDate(r.d) + (r.d > todayISO() && r.type !== 'med' ? L(' · قادم', ' · upcoming') : '') + (r.img ? L(' · صورة', ' · photo') : ''), icon: RT[r.type][1], tileCls: 'tile-xs ' + RT[r.type][2], byInit: INIT[r.who], byCls: byCls(r.who), whoName: WHO[r.who] }));
    const rvR = recAll.find((r) => r.id === s.recView);
    const rv = rvR ? {
      title: rvR.title, desc: rvR.desc, meta: RT[rvR.type][0] + ' · ' + (WHO[rvR.who] || '') + ' · ' + fmtDate(rvR.d),
      img: rvR.img, hasImg: !!rvR.img, canDel: rvR.type !== 'med',
      edit: () => { if (rvR.type === 'med') { this.setState({ sheet: 'medInfo', medInfo: rvR.id.replace('med:', '') }); return; } const r = this.state.records.find((y) => y.id === rvR.id); if (r) this.editRecord(r); },
      del: () => { if (!window.confirm(L('حذف هذا السجل؟', 'Delete this record?'))) return; this.setState({ records: this.state.records.filter((x) => x.id !== rvR.id), sheet: null }); }
    } : { title: '', desc: '', meta: '', img: '', hasImg: false, canDel: false };
    const recTypeChips = [['all', L('الكل', 'All')]].concat(Object.keys(RT).map((k) => [k, RT[k][0]]))
      .map(([k, n]) => ({ name: n, cls: s.recType === k ? 'chip-on' : 'chip', sel: () => this.setState({ recType: k }) }));
    const segs = [['appts', T.segAppts], ['meds', T.segMeds], ['rec', T.segRec]].filter(([k]) => !isHid(segKey[k])).map(([k, n]) => ({ name: n, cls: s.schedSeg === k ? 'sg-on' : 'sg', sel: () => this.setState({ schedSeg: k }) }));
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
      line2: (WHO[mInfo.who]) + ' · ' + (mInfo.shared ? L('ظاهر للأسرة', 'Visible to family') : L('مخفي عن الأسرة', 'Hidden from family')) + (tx(mInfo.note) ? ' · ' + tx(mInfo.note) : ''),
      line3: L('بدأ من ', 'Started ') + fmtDate(mInfo.sd)
    } : { title: '', line1: '', line2: '', line3: '' };
    const catList = [['all', L('الكل', 'All')], ['vax', L('تطعيمات', 'Vaccines')], ['bill', L('فواتير وتجديدات', 'Bills & renewals')], ['appt', L('مواعيد', 'Appointments')], ['maint', L('صيانة', 'Maintenance')]];
    const cats = catList.map(([k, n]) => ({ name: n, cls: s.cat === k ? 'chip-on' : 'chip', sel: () => this.setState({ cat: k }) }));
    const scList = [['all', L('الكل', 'All')], ['shared', L('الظاهر للأسرة', 'Visible')], ['private', L('المخفي', 'Hidden')]];
    const scopes = scList.map(([k, n]) => ({ name: n, cls: s.scope === k ? 'chip-on' : 'chip', sel: () => this.setState({ scope: k }) }));
    const dayDiff = (iso) => Math.round((new Date(iso + 'T00:00') - new Date(todayISO() + 'T00:00')) / 86400000);
    const BUCKETS = [['past', L('مواعيد سابقة', 'Past')], ['today', L('اليوم', 'Today')], ['tom', L('غداً', 'Tomorrow')], ['after', L('بعد غد', 'Day after tomorrow')],
      ['week', L('خلال الأسبوع', 'This week')], ['later', L('قريباً', 'Later')], ['nodate', L('بلا تاريخ', 'No date')]];
    const bucketOf = (x) => { if (!x.d) return 'nodate'; const n = dayDiff(x.d); return n < 0 ? 'past' : n === 0 ? 'today' : n === 1 ? 'tom' : n === 2 ? 'after' : n <= 7 ? 'week' : 'later'; };
    const groupAppts = (list, order, limitLater) => order.map((k) => {
      let its = list.filter((x) => bucketOf(x) === k);
      if (k === 'past') its = its.slice().reverse();
      const more = limitLater && k === 'later' && its.length > limitLater;
      return { key: k, name: BUCKETS.find((b) => b[0] === k)[1], items: (more ? its.slice(0, limitLater) : its).map(mkAppt), n: its.length };
    }).filter((g) => g.n > 0);
    const apptSorted = apptsAll.slice().sort((a, b) => (a.d || '9').localeCompare(b.d || '9'))
      .filter((x) => s.cat === 'all' || x.cat === s.cat)
      .filter((x) => s.scope === 'all' || (s.scope === 'shared') === x.shared);
    const personOrder = PEOPLE.map((p) => p.id).concat(['home']);
    const groupByPerson = (list, map) => personOrder.map((pid) => {
      const its = list.filter((x) => x.who === pid);
      return { key: pid, name: WHO[pid] || '', items: its.map(map), n: its.length };
    }).concat([{ key: '?', name: L('غير محدد', 'Unassigned'), items: list.filter((x) => !personOrder.includes(x.who)).map(map), n: list.filter((x) => !personOrder.includes(x.who)).length }]).filter((g) => g.n > 0);
    const futureFirst = (a, b) => { const fa = a.d && a.d >= todayISO(), fb = b.d && b.d >= todayISO(); if (fa !== fb) return fa ? -1 : 1; return (a.d || '9').localeCompare(b.d || '9') || (a.tm || '99').localeCompare(b.tm || '99'); };
    const apptGroups = sortMode === 'person' ? groupByPerson(apptSorted.slice().sort(futureFirst), mkAppt) : groupAppts(apptSorted, ['today', 'tom', 'after', 'week', 'later', 'nodate', 'past']);
    const upList = apptsAll.filter((x) => x.d && x.d >= todayISO()).sort((a, b) => a.d.localeCompare(b.d));
    const todayGroups = sortMode === 'person' ? groupByPerson(upList, mkAppt) : groupAppts(upList, ['today', 'tom', 'after', 'week', 'later'], 3);
    const upcoming = apptsAll.filter((x) => x.d && x.d >= todayISO());
    const busy = new Set(apptsAll.filter((x) => x.d).map((x) => x.d));
    const dn = isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isoOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const TODAY = todayISO(), sel = s.selDay;
    const pickDay = (iso) => () => this.setState({ selDay: this.state.selDay === iso && this.state.sheet !== 'cal' ? null : iso });
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i); const iso = isoOf(d);
      return { name: dn[d.getDay()], num: num(d.getDate()), cls: iso === sel ? 'day day-on' : (i === 0 ? 'day day-today' : 'day'), dot: busy.has(iso) ? 'dd' : 'dd-no', pick: pickDay(iso) };
    });
    // ---- selected day + month calendar ----
    const longDate = (iso) => { try { return new Date(iso + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: iso.slice(0, 4) !== TODAY.slice(0, 4) ? 'numeric' : undefined }); } catch (e) { return iso; } };
    const relDay = (iso) => { const n = dayDiff(iso); return n === 0 ? L('اليوم — ', 'Today — ') : n === 1 ? L('غداً — ', 'Tomorrow — ') : n === -1 ? L('أمس — ', 'Yesterday — ') : ''; };
    const dayItems = sel ? apptsAll.filter((x) => x.d === sel).map(mkAppt) : [];
    const LOGK = { appt: L('موعد', 'Appointment'), med: L('دواء', 'Medicine'), shop: L('مشتريات', 'Shopping') };
    const fmtClock = (ms) => { try { return new Date(ms).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
    const logRows = (d) => (s.log || []).filter((l) => l.d === d).sort((a, b) => a.at - b.at).map((l) => ({
      text: l.text + (l.price ? ' · ' + money(l.price) : ''), kind: LOGK[l.kind] || '', time: fmtClock(l.at),
      whoPill: WHO[l.who] || '', pCls: 'pp ' + pCls(l.who), byTxt: l.by && l.by !== l.who && WHO[l.by] ? L('بواسطة ', 'by ') + WHO[l.by] : ''
    }));
    const dayLog = sel ? logRows(sel) : [];
    const todayLog = logRows(TODAY);
    const dayMeds = (sel && sel >= TODAY) ? allDoses.length : 0;
    const calMonth = s.calMonth || (sel || TODAY).slice(0, 7);
    const [cy, cm] = calMonth.split('-').map(Number);
    const startDow = isAr ? 6 : 0; // Arabic weeks start on Saturday
    const first = new Date(cy, cm - 1, 1), lead = (first.getDay() - startDow + 7) % 7, dim = new Date(cy, cm, 0).getDate();
    const calCells = [];
    for (let i = 0; i < lead; i++) calCells.push({ num: '', cls: 'cd cd-blank', dot: 'dd-no', pick: () => {} });
    for (let dd = 1; dd <= dim; dd++) {
      const iso = calMonth + '-' + String(dd).padStart(2, '0');
      calCells.push({ num: num(dd), cls: 'cd' + (iso === sel ? ' cd-on' : '') + (iso === TODAY ? ' cd-today' : '') + (iso < TODAY ? ' cd-past' : ''), dot: busy.has(iso) ? 'dd' : 'dd-no', pick: () => this.setState({ selDay: iso }) });
    }
    const calHead = (isAr ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((n) => ({ n }));
    const shiftMonth = (k) => () => { const d = new Date(cy, cm - 1 + k, 1); this.setState({ calMonth: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }); };

    const daysTo = (iso) => Math.round((new Date(iso + 'T00:00') - new Date(todayISO() + 'T00:00')) / 86400000);
    const expDay = (e) => { if (!e) return ''; if (/^\d{4}-\d{2}$/.test(e)) { const [y, m] = e.split('-').map(Number); return e + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0'); } return e; };
    const expTxt = (raw) => {
      const iso = expDay(raw);
      if (!iso) return L('بلا تاريخ انتهاء', 'No expiry');
      const n = daysTo(iso);
      if (n < 0) return L('منتهية منذ ' + num(-n) + ' يوماً', 'Expired ' + (-n) + ' days ago');
      if (n <= 60) return L('تنتهي بعد ' + num(n) + ' يوماً', 'Expires in ' + n + ' days');
      if (/^\d{4}-\d{2}$/.test(raw)) return L('تنتهي ', 'Expires ') + num(raw.slice(5)) + '/' + num(raw.slice(2, 4));
      try { return L('تنتهي ', 'Expires ') + new Date(iso + 'T00:00').toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' }); } catch (e) { return iso; }
    };
    const KINDS = [
      ['id', L('هويات ووثائق', 'IDs & documents'), 'M3 5h18v14H3zM9 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M14 10h4M14 14h3'],
      ['bank', L('بطاقات بنكية', 'Bank cards'), 'M2 6h20v12H2zM2 10h20M6 15h4'],
      ['health', L('تأمين وصحة', 'Insurance & health'), 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 9v6M9 12h6'],
      ['other', L('عضويات وأخرى', 'Memberships & other'), 'M4 7h16v10H4zM8 11h8M8 14h5']
    ];
    const kindOf = (k) => k.kind || 'id';
    const ibanClean = (v) => (v || '').replace(/[\s-]/g, '').toUpperCase();
    const ibanOk = (v) => { const x = ibanClean(v); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(x)) return false;
      const r = (x.slice(4) + x.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55)); let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1; };
    const ibanPretty = (v) => ibanClean(v).replace(/(.{4})(?=.)/g, '$1 ');
    const maskNum = (n) => { const d = (n || '').replace(/\s/g, ''); return d.length > 4 ? '•••• ' + d.slice(-4) : (d || '—'); };
    const WC = { id: 'wc wc-id', bank: 'wc wc-bank', health: 'wc wc-health', other: 'wc wc-other' };
    const cardDetails = (k) => [k.type + (k.issuer ? ' — ' + k.issuer : ''), L('الاسم: ', 'Name: ') + (WHO[k.who] || ''), k.num ? L('الرقم: ', 'Number: ') + k.num : '', k.acct ? L('رقم الحساب: ', 'Account: ') + k.acct : '', k.iban ? 'IBAN: ' + ibanClean(k.iban) : '', k.exp ? L('الانتهاء: ', 'Expiry: ') + k.exp : ''].filter(Boolean).join('\n');
    const mkCard = (k) => {
      const img = s.face === 'front' ? k.front : k.back, bank = kindOf(k) === 'bank', reveal = s.revealCard === k.id, isOpen = s.openCard === k.id;
      const raw = (k.num || '').replace(/\s/g, '');
      const ib = ibanClean(k.iban);
      const copyNum = () => { if (!raw && ib) { this.copyText(ib); this.flash(L('تم نسخ IBAN ✓', 'IBAN copied ✓')); return; } if (!raw) { this.flash(L('لا يوجد رقم لهذه البطاقة', 'This card has no number')); return; } this.copyText(raw); this.flash(L('تم نسخ الرقم ✓', 'Number copied ✓')); };
      const pr = this.press(() => { if (this.state.openCard === k.id) this.setState({ fullCard: { id: k.id, face: 'front', rot: 0 } }); else this.setState({ openCard: k.id, face: 'front', revealCard: null }); }, copyNum);
      const expN = k.exp ? daysTo(expDay(k.exp)) : null;
      const pretty = (!raw && ib) ? (reveal ? ibanPretty(ib) : ib.slice(0, 4) + ' •••• ' + ib.slice(-4)) : (bank && !reveal) ? (raw.length > 4 ? '•••• •••• ' + raw.slice(-4) : raw || '') : (bank ? raw.replace(/(.{4})(?=.)/g, '$1 ') : raw);
      return {
        id: k.id, type: k.type, title: k.type + (k.issuer ? ' — ' + k.issuer : ''), cardName: k.type, issuer: k.issuer || '', hasIssuer: !!k.issuer,
        who: WHO[k.who] || k.who, expiry: expTxt(k.exp), expShort: k.exp ? (/^\d{4}-\d{2}$/.test(k.exp) ? num(k.exp.slice(5)) + '/' + num(k.exp.slice(2, 4)) : num(k.exp.slice(5, 7)) + '/' + num(k.exp.slice(2, 4))) : '',
        num: (bank && !reveal) ? maskNum(k.num) : (k.num || '—'), faceNum: k._locked ? '🔒 •••• ••••' : pretty, isBank: bank && !!raw, canReveal: bank && (raw.length > 4 || !!ib || !!k.acct),
        hasIban: !!ib, ibanTxt: reveal ? ibanPretty(ib) : (ib ? ib.slice(0, 4) + ' •••• •••• ' + ib.slice(-4) : ''),
        copyIban: () => { this.copyText(ib); this.flash(L('تم نسخ IBAN ✓', 'IBAN copied ✓')); },
        hasAcct: !!k.acct, acctTxt: reveal ? String(k.acct) : (k.acct ? '•••• ' + String(k.acct).slice(-4) : ''),
        copyAcct: () => { this.copyText(String(k.acct || '').replace(/\s/g, '')); this.flash(L('تم نسخ رقم الحساب ✓', 'Account number copied ✓')); },
        renewTxt: k.exp ? L('سيصلك تذكير قبل الانتهاء بـ٣٠ يوماً', 'You will be reminded 30 days before expiry') : '',
        revealTxt: reveal ? L('إخفاء الرقم', 'Hide number') : L('إظهار الرقم', 'Show number'),
        reveal: () => this.setState({ revealCard: reveal ? null : k.id }),
        hasHotline: !!k.hotline, hotline: k.hotline || '', tel: 'tel:' + (k.hotline || '').replace(/[^0-9+]/g, ''),
        alert: expN != null && expN <= 30, expBadge: expN == null ? '' : expN < 0 ? L('منتهية', 'Expired') : expN <= 30 ? L('تنتهي قريباً', 'Expiring') : '',
        icon: (KINDS.find((x) => x[0] === kindOf(k)) || KINDS[0])[2],
        tileCls: 'ctile ct-' + kindOf(k) + (isOpen ? ' ctile-on' : ''), shortNum: raw ? '•••• ' + raw.slice(-4) : (ib ? ib.slice(0, 4) + ' •••• ' + ib.slice(-4) : ''),
        wcCls: WC[kindOf(k)] + (isOpen ? ' wc-open' : '') + (k.color ? ' wc-c-' + k.color : ''),
        bCls: k.shared ? 'b-none' : 'b-lock', bTxt: k.shared ? '' : L('مخفي', 'Hidden'), hidden: !k.shared, whoPill: WHO[k.who] || '', pCls: 'pp ' + pCls(k.who), isOpen,
        img: img || '', hasImg: !!img, noImg: !img,
        down: pr.down, move: pr.move, up: pr.up, tap: pr.tap, menu: pr.menu,
        open: pr.tap,
        close: () => this.setState({ openCard: null, revealCard: null }),
        full: () => this.setState({ fullCard: { id: k.id, face: this.state.face, rot: 0 } }),
        copy: copyNum,
        copyAll: () => { this.copyText(cardDetails(k)); this.flash(L('تم نسخ بيانات البطاقة ✓', 'Card details copied ✓')); },
        edit: () => { if (k._locked) { this.flash(L('هذه البطاقة مشفّرة برقم سري آخر', 'This card is locked with another PIN')); return; } const { _locked, ...kk } = k; this.setState({ sheet: 'card', cardForm: { kind: 'id', ...kk } }); },
        del: () => { if (!window.confirm(L('حذف هذه البطاقة؟', 'Delete this card?'))) return; this.setState({ cards: this.state.cards.filter((x) => x.id !== k.id), openCard: null }); }
      };
    };
    const cards = s.cards.map(mkCard);
    const ownersWithCards = PIDS.concat(['home']).filter((id) => s.cards.some((k) => k.who === id)).concat([...new Set(s.cards.map((k) => k.who))].filter((w) => w && !PIDS.includes(w) && w !== 'home'));
    const cWho = s.cardWho !== 'all' && ownersWithCards.includes(s.cardWho) ? s.cardWho : 'all';
    const kindsPresent = KINDS.filter(([id]) => s.cards.some((k) => kindOf(k) === id));
    const cKind = s.cardKind !== 'all' && kindsPresent.some(([id]) => id === s.cardKind) ? s.cardKind : 'all';
    const kOrder = { id: 0, bank: 1, health: 2, other: 3 };
    const visCards = s.cards.filter((k) => (cWho === 'all' || k.who === cWho) && (cKind === 'all' || kindOf(k) === cKind))
      .sort((a, b) => kOrder[kindOf(a)] - kOrder[kindOf(b)]);
    const cardGroups = (cWho === 'all' ? ownersWithCards : [cWho]).map((w) => ({ name: WHO[w] || w, items: visCards.filter((k) => k.who === w).map(mkCard).map((c, i, a) => i === a.length - 1 ? { ...c, wcCls: c.wcCls + ' wc-last' } : c), pCls: 'pp ' + pCls(w) }))
      .filter((g) => g.items.length).map((g) => ({ ...g, openItems: g.items.filter((x) => x.isOpen), countTxt: L(g.items.length === 1 ? 'بطاقة واحدة' : g.items.length === 2 ? 'بطاقتان' : num(g.items.length) + (g.items.length > 10 ? ' بطاقة' : ' بطاقات'), g.items.length + (g.items.length === 1 ? ' card' : ' cards')) }));
    const cardWhoChips = [{ id: 'all', name: L('الكل', 'All') }].concat(ownersWithCards.map((id) => ({ id, name: WHO[id] || id })))
      .map((c) => ({ name: c.name, cls: cWho === c.id ? 'tab tab-on' : 'tab', sel: () => this.setState({ cardWho: c.id, openCard: null }) }));
    const cardKindChips = kindsPresent.length < 2 ? [] : [{ id: 'all', name: L('كل الأنواع', 'All types') }].concat(kindsPresent.map(([id, n]) => ({ id, name: n })))
      .map((c) => ({ name: c.name, cls: cKind === c.id ? 'chip-on' : 'chip', sel: () => this.setState({ cardKind: c.id, openCard: null }) }));
    const fc = s.fullCard && s.cards.find((k) => k.id === s.fullCard.id);
    const fcImg = fc ? (s.fullCard.face === 'back' ? fc.back : fc.front) : '';
    const fullView = fc ? {
      ...mkCard(fc), fImg: fcImg || '', fHasImg: !!fcImg, fNoImg: !fcImg,
      imgCls: 'fs-img' + (s.fullCard.rot ? ' fs-rot' : ''),
      frontCls: s.fullCard.face !== 'back' ? 'fs-b fs-on' : 'fs-b', backCls: s.fullCard.face === 'back' ? 'fs-b fs-on' : 'fs-b',
      toFront: () => this.setState({ fullCard: { ...this.state.fullCard, face: 'front' } }), toBack: () => this.setState({ fullCard: { ...this.state.fullCard, face: 'back' } }),
      rotate: () => this.setState({ fullCard: { ...this.state.fullCard, rot: this.state.fullCard.rot ? 0 : 90 } }),
      closeFull: () => this.setState({ fullCard: null })
    } : null;
    const cardAlerts = s.cards.filter((k) => k.exp && daysTo(expDay(k.exp)) <= 30).map((k) => ({
      text: (daysTo(expDay(k.exp)) < 0 ? L('انتهت صلاحية ', 'Expired: ') : L('قريباً تنتهي: ', 'Expiring soon: ')) + k.type + (k.issuer ? ' ' + k.issuer : '') + ' (' + (WHO[k.who] || '') + ') — ' + expTxt(k.exp)
    }));
    const cf = s.cardForm || { kind: 'id', type: '', who: myId, num: '', exp: '', front: '', back: '', shared: true };
    const cfKind = cf.kind || 'id';
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
    const EC = [
      ['rent', L('إيجار', 'Rent'), 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6'],
      ['elec', L('كهرباء', 'Electricity'), 'M13 2L4 14h7l-1 8 9-12h-7z'],
      ['water', L('مياه', 'Water'), 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z'],
      ['gas', L('غاز', 'Gas'), 'M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 0-3-1-5 1-8z'],
      ['net', L('إنترنت وموبايل', 'Internet & phone'), 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01'],
      ['school', L('مدارس ودروس', 'School & tutoring'), 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5'],
      ['car', L('مواصلات وبنزين', 'Transport & fuel'), 'M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v2M17 19v2'],
      ['health', L('علاج وأطباء', 'Health'), 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z'],
      ['inst', L('أقساط واشتراكات', 'Installments & subscriptions'), 'M3 6h18v12H3zM3 10h18M7 15h3'],
      ['maint', L('صيانة البيت', 'Home maintenance'), 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'],
      ['other', L('أخرى', 'Other'), 'M5 12h.01M12 12h.01M19 12h.01']
    ];
    const ecName = {}; EC.forEach(([id, n]) => { ecName[id] = n; });
    const guessECat = (txt) => { const v = (txt || '').toLowerCase();
      const R = [['rent', /(ايجار|إيجار|rent)/], ['elec', /(كهربا|كهرباء|electric)/], ['water', /(مياه|مية|ميه|water)/], ['gas', /(غاز|gas)/], ['net', /(نت|انترنت|إنترنت|موبايل|كارت شحن|فودافون|اتصالات|اورنج|وي\b|internet|phone|mobile)/],
        ['school', /(مدرس|مصاريف المدرسة|دروس|درس|حضانة|جامعة|school|tuition)/], ['car', /(بنزين|عربية|مواصلات|اوبر|أوبر|uber|fuel|car)/], ['health', /(دكتور|كشف|علاج|تحليل|اشعة|أشعة|صيدلية|doctor)/], ['inst', /(قسط|اقساط|أقساط|اشتراك|نادي|جيم|netflix|subscription)/]];
      for (const [k, r] of R) if (r.test(v)) return k; return 'other'; };
    const ym0 = todayISO().slice(0, 7);
    const expThisMonth = (s.log || []).filter((l) => l.kind === 'exp' && !l.fuel && l.price && (l.d || '').slice(0, 7) === ym0);
    const spentBy = {}; SC.forEach(([id]) => { spentBy[id] = s.history[id] || 0; });
    expThisMonth.forEach((l) => { const k = 'e-' + (l.ecat || 'other'); spentBy[k] = (spentBy[k] || 0) + Number(l.price); });
    s.shop.forEach((x) => { if (x.done && x.price) spentBy[x.cat] = (spentBy[x.cat] || 0) + Number(x.price); });
    const spent = Object.values(spentBy).reduce((a, b) => a + b, 0);
    const maxCat = Math.max(1, ...Object.values(spentBy));
    const breakdown = SC.map(([id, name, icon]) => ({ id, name, icon, amt: spentBy[id] || 0, cc: 'sc-' + id }))
      .concat(EC.map(([id, name, icon]) => ({ id: 'e-' + id, name, icon, amt: spentBy['e-' + id] || 0, cc: 'ec' })))
      .filter((b) => b.amt > 0).sort((a, b) => b.amt - a.amt)
      .map((b) => ({ ...b, amtTxt: money(b.amt), pct: Math.round(b.amt / maxCat * 100), pctTxt: num(Math.round(b.amt / spent * 100)) + L('٪', '%'), tileCls: 'tile-s ' + b.cc, barCls: 'bar-svg ' + b.cc }));
    const shopSpent = SC.reduce((a, [id]) => a + (spentBy[id] || 0), 0), otherSpent = spent - shopSpent;
    const ymNow0 = todayISO().slice(0, 7);
    const monthDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
    const addYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const ymName = (ym) => { try { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }); } catch (e) { return ym; } };
    const commitInfo = (r) => {
      if (!r.kind || r.kind === 'plain' || !r.months || !r.start) return null;
      const idx = monthDiff(r.start, ymNow0); // 0 = first month
      const paidN = (s.log || []).filter((l) => l.recurId === r.id).length;
      const done = idx >= r.months || paidN >= r.months;
      const endYM = addYM(r.start, r.months - 1);
      const info = { done, notStarted: idx < 0, paidN, months: r.months, pct: Math.min(100, Math.round(paidN / r.months * 100)), endTxt: ymName(endYM) };
      if (r.kind === 'inst') { const left = Math.max(0, r.months - paidN); info.line = L('قسط ' + num(paidN) + ' من ' + num(r.months) + (r.amount ? ' · المتبقي ' + money(left * r.amount) : '') + ' · ينتهي ' + ymName(endYM), 'Paid ' + paidN + ' of ' + r.months + (r.amount ? ' · ' + money(left * r.amount) + ' left' : '') + ' · ends ' + ymName(endYM)); }
      if (r.kind === 'gam') { const payYM = addYM(r.start, (r.turn || 1) - 1); const payNow = payYM === ymNow0; const payPast = monthDiff(payYM, ymNow0) > 0;
        info.payNow = payNow; info.line = L('جمعية ' + num(r.months) + ' أشهر · ' + (payNow ? 'هذا الشهر دورك تقبض 🎉' : payPast ? 'قبضت في ' + ymName(payYM) : 'قبضك في ' + ymName(payYM)) + (r.amount ? ' (' + money(r.amount * r.months) + ')' : '') + ' · دفعت ' + num(paidN) + ' من ' + num(r.months), (payNow ? 'Your payout is this month 🎉' : (payPast ? 'Paid out ' : 'Payout ') + ymName(payYM)) + ' · paid ' + paidN + '/' + r.months); }
      return info;
    };
    const recurRows = (s.recur || []).filter((r) => { const ci = commitInfo(r); return !ci || (!ci.done && !ci.notStarted) || (ci.done && (s.log || []).some((l) => l.recurId === r.id && (l.d || '').slice(0, 7) === ymNow0)); }).slice().sort((a, b) => (a.day || 1) - (b.day || 1)).map((r) => {
      const paid = expThisMonth.find((l) => l.recurId === r.id);
      const ci = commitInfo(r);
      const nowD = new Date(), dIn = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
      const effDay = Math.min(r.day || 1, dIn);
      const due = Number(todayISO().slice(8)) >= effDay;
      const dLeft = effDay - Number(todayISO().slice(8));
      return { dLeft, whenTxt: paid ? '' : dLeft < 0 ? L('متأخر ' + (dLeft === -1 ? 'يوماً واحداً' : dLeft === -2 ? 'يومين' : num(-dLeft) + ' أيام'), (-dLeft) + ' day(s) late') : dLeft === 0 ? L('مستحق اليوم', 'Due today') : dLeft === 1 ? L('مستحق غداً', 'Due tomorrow') : L('بعد ' + (dLeft === 2 ? 'يومين' : num(dLeft) + ' أيام'), 'In ' + dLeft + ' days'),
        ci: ci || {}, hasCi: !!ci, ciLine: ci ? ci.line : '', ciPct: ci ? ci.pct : 0, ciHot: !!(ci && ci.payNow),
        name: r.name, amtTxt: paid ? money(paid.price) : r.amount ? money(r.amount) : L('مبلغ متغير', 'Varies'), icon: (EC.find((e) => e[0] === r.ecat) || EC[EC.length - 1])[2],
        dayTxt: (r.day || 1) >= 29 ? L('آخر الشهر (يوم ' + num(r.day) + ')', 'Day ' + r.day + ' / month end') : L('يوم ' + num(r.day || 1) + ' من كل شهر', 'Day ' + (r.day || 1) + ' monthly'), paid: !!paid, unpaid: !paid,
        stCls: paid ? 'rc-st rc-paid' : due ? 'rc-st rc-due' : 'rc-st', stTxt: paid ? L('دُفع ✓', 'Paid ✓') : L('سجّل الدفع', 'Mark paid'),
        pay: () => { if (paid) return; this.setState({ sheet: 'exp', ef: { text: r.name, amount: r.amount ? String(r.amount) : '', ecat: r.ecat, d: todayISO(), who: r.who || myId, recur: false, day: r.day, recurId: r.id, lockRecur: true, payMode: true } }); },
        edit: () => this.setState({ sheet: 'exp', ef: { ckind: r.kind || 'plain', months: r.months ? String(r.months) : '', start: r.start || '', turn: r.turn ? String(r.turn) : '', rem: r.rem || [], text: r.name, amount: String(r.amount || ''), ecat: r.ecat, d: todayISO(), who: r.who || myId, recur: true, day: r.day || 1, editRecur: r.id } }) };
    });
    const recentExp = (s.log || []).filter((l) => l.kind === 'exp' && !l.fuel && l.price).sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.at || 0) - (a.at || 0)).slice(0, 6).map((l) => ({
      name: l.text, amtTxt: money(l.price), sub: (ecName[l.ecat] || '') + ' · ' + longDateS(l.d) + (WHO[l.who] ? ' · ' + WHO[l.who] : ''),
      del: () => { if (!window.confirm(L('حذف هذا المصروف؟', 'Delete this expense?'))) return; this.setState({ log: this.state.log.filter((x) => x.id !== l.id) }); }
    }));
    const budgetPct = Math.min(100, Math.round(spent / budget * 100));
    const budgetLine = spent <= budget
      ? L('من ميزانية ' + money(budget) + ' — المتبقي ' + money(budget - spent), 'of a ' + money(budget) + ' budget — ' + money(budget - spent) + ' left')
      : L('تجاوزت الميزانية بمقدار ' + money(spent - budget), 'Over budget by ' + money(spent - budget));
    const toggleItem = (it) => () => {
      if (it.done) { this.setState({ shop: this.state.shop.map((x) => x.id === it.id ? { ...x, done: false } : x) }); this.logDone('s:' + it.id, {}, false); return; }
      this.setState({ sheet: 'price', priceFor: it.id, priceDraft: it.price ? String(it.price) : '' });
    };
    const shopCats = SC.filter(([id]) => s.shop.some((x) => x.cat === id));
    const shopFilters = [['all', L('الكل', 'All')]].concat(shopCats.map(([id, n]) => [id, n])).map(([k, n]) => ({
      name: k === 'all' ? n : n + ' (' + num(s.shop.filter((x) => x.cat === k && !x.done).length) + ')',
      cls: s.shopFilter === k ? 'chip-on' : 'chip', tabCls: s.shopFilter === k ? 'tab tab-on' : 'tab', sel: () => this.setState({ shopFilter: k })
    }));
    const UNITS = {
      kg: ['كجم', 'kg', 'kg'], bag: ['كيس', 'bag', 'bags'], tray: ['طبق', 'tray', 'trays'], loaf: ['رغيف', 'loaf', 'loaves'],
      bottle: ['زجاجة', 'bottle', 'bottles'], pack: ['عبوة', 'pack', 'packs'], bird: ['دجاجة', 'chicken', 'chickens'], g: ['غرام', 'g', 'g'], box: ['علبة', 'box', 'boxes'], piece: ['قطعة', 'piece', 'pieces'], l: ['لتر', 'L', 'L']
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
    const UNIT_STEP = { kg: 0.5, g: 100, l: 0.5 };
    (s.catalog || []).forEach((c) => { CAT.push({ id: c.id, name: c.name, cat: c.cat, unit: c.unit, step: UNIT_STEP[c.unit] || 1, def: c.def || 1, icon: c.icon || 'pack', custom: true }); });
    const catById = {}; CAT.forEach((c) => { catById[c.id] = c; });
    const normName = (v) => (v || '').toString().trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
    const findCat = (name) => { const n = normName(name); if (!n) return null; return CAT.find((c) => normName(c.name.ar || c.name) === n || normName(c.name.en || '') === n) || null; };
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
      if (c) return fmtQty(it.qty, c.unit) + ' – ' + tx(c.name);
      return (it.unit && it.qty ? fmtQty(it.qty, it.unit) + ' – ' : '') + tx(it.name);
    };
    const itemBase = (it) => { const c = it.ref && catById[it.ref]; return c ? { base: tx(c.name), qty: it.qty || null, unit: c.unit || null } : { base: tx(it.name), qty: it.qty || null, unit: it.unit || null }; };
    const itemIcon = (it) => { const c = it.ref && catById[it.ref]; return c ? c.icon : (it.icon || null); };
    const qpick = CAT.filter((c) => s.shopFilter === 'all' || c.cat === s.shopFilter)
      .sort((a, b) => (s.freq[b.id] || 0) - (s.freq[a.id] || 0))
      .map((c) => ({
        name: tx(c.name), icons: this.icons(c.icon, 1, 28), cls: s.qSel === c.id ? 'qt-on' : 'qt',
        sel: () => this.setState(this.state.qSel === c.id ? { qSel: null } : { qSel: c.id, qQty: this.state.lastQty[c.id] || c.def })
      }));
    const dq = normName(s.draft);
    const suggest = dq.length >= 1 ? CAT.filter((c) => normName(tx(c.name)).includes(dq) || normName(c.name.en || '').includes(dq) || normName(c.name.ar || c.name).includes(dq))
      .sort((a, b) => (s.freq[b.id] || 0) - (s.freq[a.id] || 0)).slice(0, 6).map((c) => ({
        name: tx(c.name), unitTxt: (UNITS[c.unit] || ['', ''])[isAr ? 0 : 1], storeTxt: scName[c.cat] || '', icons: this.icons(c.icon, 1, 22),
        pick: () => this.setState({ qSel: c.id, qQty: this.state.lastQty[c.id] || c.def, draft: '', draftCat: null, draftUnit: null, draftQty: 1 })
      })) : [];
    const exactHit = dq && CAT.some((c) => normName(tx(c.name)) === dq);
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
          priceTxt: it.price ? money(it.price) : '',
          needPrice: it.done && !it.price,
          setPrice: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ sheet: 'price', priceFor: it.id, priceDraft: '' }); },
          priceCls: it.done ? 'amt' : 'amt-s', hasPrice: !!it.price,
          byInit: INIT[it.by] || '?', byCls: byCls(it.by),
          byAria: L('أضافه: ', 'Added by: ') + (WHO[it.by] || it.by),
          toggle: toggleItem(it)
        }))
      };
    });
    const priceItem = s.shop.find((x) => x.id === s.priceFor);
    const finishPrice = (price) => {
      const id = this.state.priceFor, it = this.state.shop.find((x) => x.id === id);
      this.setState({ shop: this.state.shop.map((x) => x.id === id ? { ...x, done: true, price: price } : x), sheet: null, priceFor: null, priceDraft: '' });
      if (it) this.logDone('s:' + id, { kind: 'shop', text: itemName(it), ...itemBase(it), price: price || null, cat: it.cat, who: this.myId(), shared: true, ...(((this.state.log || []).find((l) => l.id === 's:' + id) || {}).d ? { d: this.state.log.find((l) => l.id === 's:' + id).d } : {}) }, true);
    };
    const left = s.shop.filter((x) => !x.done);
    const ym = (d) => d.toISOString().slice(0, 7);
    const nowD2 = new Date();
    let expFrom, expTo;
    if (s.exp.mode === 'last') { const d = new Date(nowD2.getFullYear(), nowD2.getMonth() - 1, 1); expFrom = isoOf2(d); expTo = isoOf2(new Date(nowD2.getFullYear(), nowD2.getMonth(), 0)); }
    else if (s.exp.mode === '3m') { expFrom = isoOf2(new Date(nowD2.getFullYear(), nowD2.getMonth() - 2, 1)); expTo = todayISO(); }
    else if (s.exp.mode === 'custom') { expFrom = s.exp.from || todayISO().slice(0, 8) + '01'; expTo = s.exp.to || todayISO(); }
    else { expFrom = todayISO().slice(0, 8) + '01'; expTo = todayISO(); }
    const expRows = (s.log || []).filter((l) => (l.kind === 'shop' || l.kind === 'exp') && !l.fuel && l.price && l.d >= expFrom && l.d <= expTo).sort((a, b) => a.d.localeCompare(b.d) || a.at - b.at);
    const expTotal = expRows.reduce((a, r) => a + Number(r.price), 0);
    const expCats = SC.map(([id, n]) => ({ name: n, amt: expRows.filter((r) => r.kind === 'shop' && (r.cat || 'super') === id).reduce((a, r) => a + Number(r.price), 0) }))
      .concat(EC.map(([id, n]) => ({ name: n, amt: expRows.filter((r) => r.kind === 'exp' && (r.ecat || 'other') === id).reduce((a, r) => a + Number(r.price), 0) }))).filter((c) => c.amt > 0)
      .map((c) => ({ ...c, amtTxt: money(c.amt) }));

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
    const openForm = (cat) => this.setState({ sheet: 'appt', form: { ...this.state.form, title: '', when: '', tm: '', cat, shared: true, who: myId, rem: [], editId: null } });
    const sheetTitles = {
      price: L('تم الشراء ✓', 'Bought ✓'), card: L('بطاقة', 'Card'), export: L('تصدير المصروفات', 'Export expenses'), dict: L('قل ما تريد تسجيله', 'Say what to record'), exp: (s.ef && s.ef.editRecur) ? L('مصروف ثابت', 'Fixed expense') : (s.ef && s.ef.payMode) ? L('تأكيد دفع: ', 'Confirm payment: ') + (s.ef.text || '') : L('مصروف جديد', 'New expense'), review: L('مراجعة قبل الإضافة', 'Review before adding'), cal: L('التقويم', 'Calendar'), join: L('الانضمام إلى أسرة', 'Join a family'), settings: L('الإعدادات', 'Settings'), recView: L('السجل الطبي', 'Medical record'), item: L('تعديل الصنف', 'Edit item'), med: L('دواء جديد', 'New medicine'), medInfo: L('تفاصيل الدواء', 'Medicine details'), rec: L('تحليل / أشعة / كشف', 'Test / scan / visit'), menu: L('إضافة', 'Add'), theme: L('الإعدادات', 'Settings'), family: L('الأسرة', 'Family'), layout: L('تخصيص الواجهة', 'Customise screens'),
      pick: pp ? tx(pp.name) : '', task: L('مهمة مطبخ جديدة', 'New kitchen task'), appt: s.form.editId ? L('تعديل الموعد', 'Edit appointment') : L('موعد جديد', 'New appointment')
    };

    if (s.sheet === 'med' && s.mf.editId) sheetTitles.med = L('تعديل الدواء', 'Edit medicine');
    if (s.sheet === 'rec' && s.rf.editId) sheetTitles.rec = L('تعديل السجل', 'Edit record');
    const HX = { isHid, AI, localAlert, pickPhone, shareImage, s, L, num, money, isAr, WHO, PIDS, PEOPLE, myId, pCls, longDateS, readImage, tx, expTxt, daysTo, expDay, shareText, SC, EC, scName, ecName, budget };
    const HV = homeVals(this, HX), HL = healthVals(this, HX), RP = reportVals(this, HX), SA = shopAnalysisVals(this, HX), DZ = dossierVals(this, HX), TDO = todoVals(this, HX), CH = choreVals(this, HX);
    Object.assign(sheetTitles, HV.homeSheetTitles, DZ.dosTitles, { todo: TDO.todoTitle, chore: CH.choreTitle, chcats: CH.chcatsTitle, cardEnc: L('تشفير البطاقات', 'Encrypt cards') }, { hp: L('الملف الصحي', 'Health profile'), measures: L('القياسات', 'Measurements'), report: L('تقرير الشهر', 'Monthly report'), shopAn: L('تحليل المشتريات', 'Shopping analysis') });
    return {
      T, lang, appCls: 'app th-' + theme + (isAr ? ' dir-rtl' : ' dir-ltr'),
      appStyle: (() => { const z = this.myPrefs().zoom || 1; try { if (document.documentElement.style.zoom !== String(z)) document.documentElement.style.zoom = String(z); } catch (e) {} return ''; })(),
      zoomIn: () => this.stepZoom(1), zoomOut: () => this.stepZoom(-1), zoomOpen: !!s.zoomOpen,
      toggleZoom: () => { const open = !this.state.zoomOpen; this.setState({ zoomOpen: open }); clearTimeout(this._zt); if (open) this._zt = setTimeout(() => this.setState({ zoomOpen: false }), 4000); },
      zoomDots: [0.85, 0.92, 1, 1.08, 1.16].map((z) => ({ cls: (this.myPrefs().zoom || 1) === z ? 'on' : '' })),
      canZoomIn: (this.myPrefs().zoom || 1) < 1.16, canZoomOut: (this.myPrefs().zoom || 1) > 0.85,
      zoomChips: [[0.85, 'A−−'], [0.92, 'A−'], [1, 'A'], [1.08, 'A+'], [1.16, 'A++']].map(([z, n]) => ({ name: n, cls: (this.myPrefs().zoom || 1) === z ? 'zc zc-on' : 'zc', sel: () => { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, zoom: z, shared: false }] }); } })),
      syncOn: S.enabled && !!fam, localOnly: !S.enabled,
      gSplash: S.enabled && (!s.authReady || (s.auth && !s.famReady)),
      gLogin: S.enabled && s.authReady && !s.auth,
      gFam: S.enabled && !!s.auth && s.famReady && !s.family && !s.famErr,
      gFamErr: S.enabled && !!s.auth && s.famReady && !s.family && !!s.famErr,
      retryFam: () => { const u = this.authUser; if (!u) return; if (this.famUnsub) this.famUnsub(); this.setState({ famErr: false, famReady: false }); this.famUnsub = S.watchFamilies(u.email, (list, err) => this.onFamilies(list, err)); },
      hasManyFams: (s.myFams || []).length > 1,
      famRows: (s.myFams || []).map((f) => ({ name: f.name, cls: fam && fam.id === f.id ? 'chip-on' : 'chip', sel: () => { this.setState({ famPref: f.id, sheet: null }); this.retryFamSoon(); } })),
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
        if (!window.confirm(L('لم نجد أي أسرة مرتبطة بالبريد ' + s.auth.email + '.\n\nلو كانت لك أسرة من قبل: تأكد أنك دخلت بنفس البريد القديم، أو اطلب من أحد أفرادها «كود الأسرة».\n\nإنشاء أسرة جديدة فارغة؟', 'No family is linked to ' + s.auth.email + '.\n\nIf you had one, sign in with the same email or ask a member for the family code.\n\nCreate a NEW empty family?'))) return;
        S.createFamily({ uid: s.auth.uid, email: s.auth.email }, n, s.auth.name || s.userName).catch((e) => this.flash(e.message));
      },
      authEmail: (s.auth && s.auth.email) || '', logoutQuick: () => S.logOut(),
      logout: () => { if (!window.confirm(L('تسجيل الخروج من هذا الهاتف؟', 'Sign out on this phone?'))) return; this.setState({ sheet: null }); S.logOut(); },
      famLabel: fam ? fam.name : '',
      hasInvites: (s.famInvites || []).length > 0,
      inviteRows: (s.famInvites || []).map((f) => ({
        text: L('دعوة للانضمام إلى «' + f.name + '»', 'Invitation to join “' + f.name + '”'),
        sub: fam ? L('عند الانضمام ستغادر «' + fam.name + '»', 'Joining will leave “' + fam.name + '”') : L('من ' + ((f.people || [])[0] || {}).name, 'From ' + ((f.people || [])[0] || {}).name),
        join: () => this.acceptInvite(f),
        reject: () => { if (window.confirm(L('رفض الدعوة؟', 'Decline the invitation?'))) S.removeEmail(f.id, s.auth.email); }
      })),
      joinCode: s.joinCode, onJoinCode: (e) => this.setState({ joinCode: e.target.value }),
      doJoin: () => {
        const c = S.normCode(this.state.joinCode); if (c.length < 6) { this.flash(L('اكتب الكود كاملاً', 'Enter the full code')); return; }
        this.setState({ joinBusy: true });
        S.joinWithCode(c, s.auth.email).then((fid) => {
          const old = this.state.family;
          this.setState({ famPref: fid, joinBusy: false, joinCode: '', sheet: null });
          this.flash(L('تم الانضمام إلى الأسرة', 'Joined the family'));
        }).catch((e) => { this.setState({ joinBusy: false }); this.flash(S.authError(e, isAr)); });
      },
      inviteCodeTxt: fam && fam.inviteCode ? fam.inviteCode.slice(0, 4) + '-' + fam.inviteCode.slice(4) : '',
      hasInviteCode: !!(fam && fam.inviteCode),
      shareInvite: () => {
        S.ensureInviteCode(fam, s.auth.uid).then((code) => {
          const pretty = code.slice(0, 4) + '-' + code.slice(4);
          const msg = isAr
            ? 'انضم إلى أسرتنا «' + fam.name + '» على تطبيق بيتنا:\n١. نزّل التطبيق: ' + DOWNLOAD_URL + '\n٢. أنشئ حساباً، ثم اختر «الانضمام بكود» واكتب: ' + pretty
            : 'Join our family “' + fam.name + '” on Baitna:\n1. Download: ' + DOWNLOAD_URL + '\n2. Create an account, choose “Join with a code” and enter: ' + pretty;
          return shareText(L('دعوة إلى بيتنا', 'Baitna invitation'), msg).then((r) => { if (r === 'copied') this.flash(L('تم نسخ الدعوة', 'Invitation copied')); });
        }).catch((e) => this.flash(S.authError(e, isAr)));
      },
      openJoin: () => this.setState({ sheet: 'join' }),
      isJoinSheet: s.sheet === 'join',
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
        const n = (this.state.depDraft || '').trim(); if (!n) { this.flash(L('اكتب الاسم أولاً', 'Enter a name first')); return; }
        const d = { id: 'p' + Date.now(), name: n };
        if (fam) S.updateFamily(fam.id, { dependents: [...(fam.dependents || []), d] });
        else this.setState({ dependents: [...(this.state.dependents || []), d] });
        const ret = this.state.famRet; const st = { depDraft: '', famAdd: null, famRet: null };
        if (ret) {
          st.sheet = ret;
          if (ret === 'appt') st.form = { ...this.state.form, who: d.id };
          if (ret === 'med') st.mf = { ...this.state.mf, who: d.id };
          if (ret === 'rec') st.rf = { ...this.state.rf, who: d.id };
          if (ret === 'card' && this.state.cardForm) st.cardForm = { ...this.state.cardForm, who: d.id };
          if (ret === 'exp' && this.state.ef) st.ef = { ...this.state.ef, who: d.id };
        }
        this.setState(st);
        this.flash(L('أُضيف ' + n + ' إلى الأسرة', n + ' added to the family'));
      },
      openFamily: () => this.setState({ sheet: 'family', famAdd: null, famRet: null }),
      isFamilySheet: s.sheet === 'family',
      addPersonFrom: () => this.setState({ famRet: this.state.sheet, sheet: 'family', famAdd: 'dep' }),
      famAddApp: s.famAdd === 'app', famAddDep: s.famAdd === 'dep',
      famOptAppCls: 'fam-opt' + (s.famAdd === 'app' ? ' fam-opt-on' : ''), famOptDepCls: 'fam-opt' + (s.famAdd === 'dep' ? ' fam-opt-on' : ''),
      pickFamApp: () => this.setState({ famAdd: this.state.famAdd === 'app' ? null : 'app' }),
      pickFamDep: () => this.setState({ famAdd: this.state.famAdd === 'dep' ? null : 'dep' }),
      famPeople: (() => {
        const rows = [];
        const init = (n) => (n || '?').trim().charAt(0);
        if (fam) {
          (fam.people || []).forEach((p) => rows.push({ name: p.id === myId ? p.name + L(' (أنت)', ' (you)') : p.name, init: init(p.name), avCls: 'av ' + pCls(p.id), sub: L('يستخدم التطبيق', 'Uses the app') + (p.email ? ' · ' + p.email : ''),
            canRemove: fam.owner === myId && p.id !== myId, remove: () => { if (window.confirm(L('إزالة ' + p.name + ' من الأسرة؟', 'Remove ' + p.name + '?'))) S.removeEmail(fam.id, p.email); } }));
          (fam.memberEmails || []).filter((em) => !(fam.people || []).some((p) => p.email === em)).forEach((em) => rows.push({ name: em, init: '✉', avCls: 'av pp-h', sub: L('دُعي — بانتظار التسجيل', 'Invited — not joined yet'),
            canRemove: fam.owner === myId, remove: () => { if (window.confirm(L('إلغاء الدعوة؟', 'Cancel invite?'))) S.removeEmail(fam.id, em); } }));
        } else rows.push({ name: (s.userName || L('أنا', 'Me')) + L(' (أنت)', ' (you)'), init: init(s.userName || 'أ'), avCls: 'av pp-0', sub: L('على هذا الهاتف', 'On this phone'), canRemove: false, remove: () => {} });
        (fam ? (fam.dependents || []) : (s.dependents || [])).forEach((d) => rows.push({ name: d.name, init: init(d.name), avCls: 'av ' + pCls(d.id), sub: L('بلا حساب — تديرون مواعيده وأدويته', 'No account — you manage their items'), canRemove: true,
          remove: () => { if (!window.confirm(L('حذف ', 'Remove ') + d.name + '?')) return;
            if (fam) S.updateFamily(fam.id, { dependents: (fam.dependents || []).filter((x) => x.id !== d.id) }); else this.setState({ dependents: this.state.dependents.filter((x) => x.id !== d.id) }); } }));
        return rows;
      })(),
      famSummary: (() => { const n = fam ? (fam.people || []).length + (fam.dependents || []).length : 1 + (s.dependents || []).length; return (fam ? fam.name + ' · ' : '') + L(n === 1 ? 'فرد واحد' : n === 2 ? 'فردان' : num(n) + ' أفراد', n + ' people'); })(),
      langArCls: isAr ? 'sg sg-on' : 'sg', langEnCls: isAr ? 'sg' : 'sg sg-on',
      setAr: () => this.setState({ lang: 'ar' }), setEn: () => this.setState({ lang: 'en' }),
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
      upcoming, items, noItems: items.length === 0, apptGroups, todayGroups,
      sortDateCls: sortMode === 'date' ? 'sg-on' : 'sg', sortPersonCls: sortMode === 'person' ? 'sg-on' : 'sg',
      setSortDate: () => this.setState({ sortMode: 'date' }), setSortPerson: () => this.setState({ sortMode: 'person' }),
      doseGroups: sortMode === 'person'
        ? personOrder.map((pid) => ({ name: WHO[pid] || '', hasName: true, items: todayDoses.filter((d) => d.who === pid) })).filter((g) => g.items.length)
        : [{ name: '', hasName: false, items: todayDoses }],
      dayLog, hasDayLog: dayLog.length > 0, todayLog, hasTodayLog: todayLog.length > 0, todayLogCount: num(todayLog.length),
      hasSel: !!sel, selTitle: sel ? relDay(sel) + longDate(sel) : '', dayItems, noDayItems: !!sel && dayItems.length === 0,
      dayMedsTxt: dayMeds ? L('وجرعات الأدوية اليومية: ' + num(dayMeds), 'Plus daily medicine doses: ' + dayMeds) : '', hasDayMeds: dayMeds > 0,
      addOnDayFn: () => this.setState({ sheet: 'appt', form: { ...this.state.form, title: '', when: this.state.selDay || '', tm: '', cat: 'appt', shared: true, who: myId, rem: [], editId: null } }),
      openCal: () => this.setState({ sheet: 'cal', calMonth: null, selDay: this.state.selDay || TODAY }),
      isCal: s.sheet === 'cal', calCells, calHead, calPrev: shiftMonth(-1), calNext: shiftMonth(1),
      calTitle: (() => { try { return first.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }); } catch (e) { return calMonth; } })(),
      calToday: () => this.setState({ selDay: TODAY, calMonth: null }), cats, scopes,
      locked: s.locked, unlocked: !s.locked && !(this.encOn() && !this.cardKey),
      needPin: !s.locked && this.encOn() && !this.cardKey, encOn: this.encOn() && !!this.cardKey, canEnc: !!(S.enabled && fam && !this.encOn() && CR.supported()),
      pinIn: s.pinIn || '', onPin: (e) => this.setState({ pinIn: e.target.value.replace(/\D/g, '').slice(0, 12), pinErr: '' }), pinErr: s.pinErr || '', hasPinErr: !!s.pinErr, pinBusy: !!s.pinBusy,
      pin2: s.pin2 || '', onPin2: (e) => this.setState({ pin2: e.target.value.replace(/\D/g, '').slice(0, 12), pinErr: '' }),
      openEnc: () => this.setState({ sheet: 'cardEnc', pinIn: '', pin2: '', pinErr: '' }), isCardEnc: s.sheet === 'cardEnc',
      doEnableEnc: () => { const p = this.state.pinIn || '', p2 = this.state.pin2 || '';
        if (p.length < 6) { this.setState({ pinErr: L('الرقم السري ٦ أرقام على الأقل', 'At least 6 digits') }); return; }
        if (p !== p2) { this.setState({ pinErr: L('الرقمان غير متطابقين', 'PINs don’t match') }); return; }
        this.setState({ pinBusy: true });
        this.enableCardEnc(p).then(() => { this.setState({ pinBusy: false, sheet: null, pinIn: '', pin2: '' }); this.flash(L('تم تشفير البطاقات 🔐 أخبر أفراد الأسرة بالرقم السري', 'Cards encrypted 🔐 share the PIN with your family'), 3500); })
          .catch((e) => { console.warn(e); this.setState({ pinBusy: false, pinErr: L('تعذّر التفعيل — تأكد من الاتصال بالإنترنت', 'Could not enable — check your connection') }); }); },
      doUnlockEnc: () => { const p = this.state.pinIn || ''; if (!p) return; this.setState({ pinBusy: true });
        this.unlockCardEnc(p).then((ok) => this.setState(ok ? { pinBusy: false, pinIn: '' } : { pinBusy: false, pinErr: L('الرقم السري غير صحيح', 'Wrong PIN') })).catch(() => this.setState({ pinBusy: false, pinErr: L('حدث خطأ — حاول مرة أخرى', 'Something went wrong') })); },
      onPinKey: (e) => { if (e.key === 'Enter') { if (this.state.sheet === 'cardEnc') return; e.target.blur(); } },
      forgotPin: () => {
        if (!window.confirm(L('لا يمكن استرجاع الرقم السري، ولا يستطيع أحد (ولا نحن) فك تشفير البطاقات بدونه.\n\nإعادة الضبط تحذف أرقام البطاقات وصورها المشفرة وتُبقي أنواعها وتواريخ انتهائها، ثم تستطيع إدخالها من جديد.\n\nهل تريد المتابعة؟', 'The PIN cannot be recovered. Resetting deletes encrypted numbers and photos (types and expiry dates stay). Continue?'))) return;
        if (!window.confirm(L('تأكيد أخير: حذف بيانات البطاقات المشفرة لكل الأسرة؟', 'Final check: delete encrypted card data for the whole family?'))) return;
        this.resetCardEnc().then(() => this.flash(L('أُعيد ضبط التشفير — أدخل أرقام البطاقات من جديد', 'Encryption reset — re-enter card numbers'), 3500)).catch(() => this.flash(L('تعذّر — تأكد من الاتصال', 'Failed — check connection')));
      },
      unlock: () => { biometricUnlock(L('افتح البطاقات', 'Unlock cards'), L('إلغاء', 'Cancel')).then((ok) => { if (ok) this.setState({ locked: false }); }); },
      cardAlerts, noCards: s.cards.length === 0,
      openCardForm: () => (this.encOn() && !this.cardKey) ? this.flash(L('أدخل الرقم السري للبطاقات أولاً', 'Enter the cards PIN first')) : this.setState({ sheet: 'card', cardForm: { id: null, kind: 'id', type: '', who: myId, num: '', exp: '', front: '', back: '', shared: true } }),
      cf, isCardSheet: s.sheet === 'card',
      cfKinds: KINDS.map(([id, name]) => ({ name, cls: cfKind === id ? 'chip-on' : 'chip', sel: () => setCf({ kind: id, type: '', shared: id !== 'bank', exp: '' }) })),
      cfIsBank: cfKind === 'bank', cfNotBank: cfKind !== 'bank',
      cfIssuer: (e) => setCf({ issuer: e.target.value }), cfHot: (e) => setCf({ hotline: e.target.value }),
      cfIban: (e) => setCf({ iban: e.target.value.toUpperCase() }), cfAcct: (e) => setCf({ acct: e.target.value }), cfIsAccount: /IBAN|حساب|account/i.test(cf.type || ''),
      cfIbanBad: !!(cf.iban && ibanClean(cf.iban).length > 4 && !ibanOk(cf.iban)),
      cardGrid: this.myPrefs().cardView === 'grid', cardWallet: this.myPrefs().cardView !== 'grid',
      setCardWallet: () => this.setCardView('wallet'), setCardGrid: () => this.setCardView('grid'),
      _unusedCv: (v) => () => { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, cardView: v, shared: false }], openCard: null }); },
      cardViewWalletCls: this.myPrefs().cardView !== 'grid' ? 'vt vt-on' : 'vt', cardViewGridCls: this.myPrefs().cardView === 'grid' ? 'vt vt-on' : 'vt',
      cardGroups, cardWhoChips, cardKindChips, hasCardKindChips: cardKindChips.length > 0, hasCardWhoChips: ownersWithCards.length > 1,
      noCardMatch: s.cards.length > 0 && visCards.length === 0,
      isFull: !!fullView, fv: fullView || { fImg: '', fHasImg: false, fNoImg: true },
      cardHint: L('اضغط على البطاقة لفتحها، واضغط مرة أخرى لعرضها بملء الشاشة. اضغط مطولاً لنسخ الرقم.', 'Tap a card to open it, tap again for full screen. Long-press to copy the number.'),
      cardSafe: L('🔒 بيانات البطاقات لا تُقرأ آلياً ولا تُرسل لأي خدمة، ومحمية بالبصمة', '🔒 Card data is never sent to AI and is protected by your fingerprint'),
      T2: { copyAll: L('نسخ كل البيانات', 'Copy all details'), rotate: L('تدوير', 'Rotate'), fullscreen: L('ملء الشاشة', 'Full screen'), closeCard: L('إغلاق', 'Close'), noMatch: L('لا توجد بطاقات بهذا الفلتر', 'No cards match this filter'), noPhoto: L('لا توجد صورة — أضفها من «تعديل»', 'No photo — add one from “Edit”') },
      cfTypes: ({
        id: [L('بطاقة الرقم القومي', 'National ID'), L('جواز السفر', 'Passport'), L('رخصة القيادة', 'Driving license'), L('رخصة السيارة', 'Car license'), L('شهادة الميلاد', 'Birth certificate'), L('الإقامة', 'Residence permit')],
        bank: [L('بطاقة خصم', 'Debit card'), L('بطاقة ائتمان', 'Credit card'), L('بطاقة مسبقة الدفع', 'Prepaid card'), L('حساب بنكي (IBAN)', 'Bank account (IBAN)')],
        health: [L('التأمين الصحي', 'Health insurance'), L('تأمين العمل الطبي', 'Work medical insurance'), L('تأمين السيارة', 'Car insurance')],
        other: [L('عضوية النادي', 'Club membership'), L('كارت النقابة', 'Union card'), L('بطاقة ولاء', 'Loyalty card'), L('كارت المترو', 'Metro card')]
      }[cfKind] || [])
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
        const hit = findCat(v);
        if (hit) { this.setState({ qSel: hit.id, qQty: this.state.lastQty[hit.id] || hit.def, draft: '' }); return; }
        const cat = this.state.draftCat || guessCat(v);
        const pr = parseFloat(this.state.draftPrice);
        const ds = (this.state.draftDesc || '').trim();
        const unit = this.state.draftUnit;
        const newCat = { id: 'u' + Date.now(), name: v, cat, unit: unit || 'piece', def: this.state.draftQty || 1, icon: 'pack', shared: true };
        const item = unit ? { id: Date.now(), ref: newCat.id, qty: this.state.draftQty || 1, name: '', desc: ds, cat, by: myId, done: false, price: isNaN(pr) ? null : pr }
          : { id: Date.now(), name: v, desc: ds, cat, by: myId, done: false, price: isNaN(pr) ? null : pr };
        this.setState({ shop: [item, ...this.state.shop], catalog: unit ? [...(this.state.catalog || []), newCat] : (this.state.catalog || []), draft: '', draftDesc: '', draftCat: null, draftPrice: '', draftUnit: null, draftQty: 1 });
        this.flash(L('أُضيف إلى ' + scName[cat], 'Added to ' + scName[cat]));
      },
      spentTxt: money(spent), budgetPct, budgetLine, breakdown,
      showBreak: s.showBreak, breakBtn: s.showBreak ? L('إخفاء التفاصيل', 'Hide details') : L('التفاصيل', 'Details'),
      toggleBreak: () => this.setState({ showBreak: !this.state.showBreak }),
      spendOpen: s.spendOpen, spendBtn: s.spendOpen ? L('إخفاء ▴', 'Hide ▴') : L('إظهار ▾', 'Show ▾'),
      toggleSpend: () => this.setState({ spendOpen: !this.state.spendOpen, showBreak: false }),
      isGridView: s.shopView === 'grid', isListView: s.shopView !== 'grid',
      viewLabel: s.shopView === 'grid' ? L('عرض كقائمة', 'Show as list') : L('عرض في عمودين', 'Show in two columns'),
      toggleView: () => this.setState({ shopView: this.state.shopView === 'grid' ? 'list' : 'grid' }),
      leftCountTxt: left.length ? L('متبقٍ ' + num(left.length) + (left.length === 1 ? ' صنف' : left.length === 2 ? '' : left.length <= 10 ? ' أصناف' : ' صنفاً'), left.length + ' to buy').replace('متبقٍ ٢', 'متبقٍ صنفان') : L('لا توجد نواقص', 'Nothing to buy'),
      shopFilters, groups, hasDone: s.shop.some((x) => x.done), hasLeft: left.length > 0,
      remindShopFn: () => {
        const names = left.map((x) => itemName(x));
        const body = names.slice(0, 6).join('، ') + (names.length > 6 ? L(' و' + num(names.length - 6) + ' غيرها', ' +' + (names.length - 6) + ' more') : '');
        this.nudge(L('قائمة المشتريات (' + num(names.length) + ')', 'Shopping list (' + names.length + ')'), body);
      },
      shareListFn: () => {
        const lines = [];
        SC.forEach(([id, n]) => { const its = left.filter((x) => x.cat === id); if (its.length) { lines.push('— ' + n + ':'); its.forEach((x) => lines.push('• ' + itemName(x) + (tx(x.desc) ? ' (' + tx(x.desc) + ')' : ''))); } });
        shareText(L('قائمة المشتريات', 'Shopping list'), L('قائمة المشتريات:', 'Shopping list:') + '\n' + lines.join('\n')).then((r) => { if (r === 'copied') this.flash(L('تم نسخ القائمة', 'List copied')); });
      },
      suggest, hasSuggest: suggest.length > 0, showNewItem: !!dq && !exactHit,
      draftUnits: ['kg', 'g', 'piece', 'pack', 'bag', 'box', 'bottle', 'tray', 'loaf', 'l'].map((u) => ({ name: (UNITS[u] || ['', ''])[isAr ? 0 : 1], cls: s.draftUnit === u ? 'chip-on' : 'chip',
        sel: () => this.setState({ draftUnit: this.state.draftUnit === u ? null : u, draftQty: this.state.draftUnit === u ? 1 : (u === 'g' ? 250 : 1) }) })),
      hasDraftUnit: !!s.draftUnit, draftQtyTxt: s.draftUnit ? fmtQty(s.draftQty || 1, s.draftUnit) : '',
      draftMinus: () => { const st = UNIT_STEP[this.state.draftUnit] || 1; this.setState({ draftQty: Math.max(st, +((this.state.draftQty || 1) - st).toFixed(2)) }); },
      draftPlus: () => { const st = UNIT_STEP[this.state.draftUnit] || 1; this.setState({ draftQty: +((this.state.draftQty || 1) + st).toFixed(2) }); },
      hasUnpriced: s.shop.some((x) => x.done && !x.price),
      clearLbl: (() => { const n = s.shop.filter((x) => x.done && x.price).length, u = s.shop.filter((x) => x.done && !x.price).length;
        if (!n) return L('سجّل أسعار ما اشتريته (' + num(u) + ') ثم أزله', 'Add prices for bought items (' + u + '), then clear');
        return L('إزالة ما تم شراؤه وسُجّل سعره (' + num(n) + ')', 'Clear bought & priced items (' + n + ')') + (u ? L(' · يبقى ' + num(u) + ' بلا سعر', ' · ' + u + ' without price stay') : ''); })(),

      // ---- export expenses ----
      openExport: () => this.setState({ sheet: 'export' }),
      isExport: s.sheet === 'export',
      expModes: [['month', L('هذا الشهر', 'This month')], ['last', L('الشهر الماضي', 'Last month')], ['3m', L('آخر ٣ أشهر', 'Last 3 months')], ['custom', L('فترة محددة', 'Custom range')]]
        .map(([k, n]) => ({ name: n, cls: s.exp.mode === k ? 'chip-on' : 'chip', sel: () => this.setState({ exp: { ...this.state.exp, mode: k } }) })),
      expCustom: s.exp.mode === 'custom', expFrom: s.exp.from, expTo: s.exp.to,
      onExpFrom: (e) => this.setState({ exp: { ...this.state.exp, from: e.target.value } }),
      onExpTo: (e) => this.setState({ exp: { ...this.state.exp, to: e.target.value } }),
      expSummary: expRows.length ? L((expRows.length === 1 ? 'بند واحد' : expRows.length === 2 ? 'بندان' : num(expRows.length) + (expRows.length > 10 ? ' بنداً' : ' بنود')) + ' — الإجمالي ' + money(expTotal), expRows.length + ' purchases — total ' + money(expTotal)) : L('لا توجد مصروفات مسجلة في هذه الفترة', 'No expenses recorded in this period'),
      expByCat: expCats, hasExp: expRows.length > 0, expRange: expFrom + ' → ' + expTo,
      doExport: () => {
        const head = L('التاريخ,البند,القسم,المبلغ (ج.م),بواسطة', 'Date,Item,Category,Amount (EGP),By');
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = expRows.map((r) => [r.d, q(r.text), q(r.kind === 'exp' ? (ecName[r.ecat] || '') : (scName[r.cat] || '')), r.price, q(WHO[r.who] || '')].join(','));
        lines.push(''); lines.push([q(L('الإجمالي', 'Total')), '', '', expTotal, ''].join(','));
        expCats.forEach((c) => lines.push([q(c.name), '', '', c.amt, ''].join(',')));
        const csv = '﻿' + head + '\n' + lines.join('\n');
        const fname = 'baitna-expenses-' + expFrom + '_' + expTo + '.csv';
        shareFile(fname, csv, L('مصروفات بيتنا', 'Baitna expenses')).then((ok) => {
          if (ok) return;
          shareText(L('مصروفات بيتنا', 'Baitna expenses'), csv.replace('﻿', '')).then((r) => this.flash(r === 'copied' ? L('تم نسخ البيانات — الصقها في Excel', 'Copied — paste into Excel') : L('تم', 'Done')));
        });
      },

      // ---- receipt & dictation (AI) ----
      aiOn: AI.aiAvailable, aiBusy: s.aiBusy,
      scanReceipt: (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        this.setState({ aiBusy: true, sheet: 'review', review: null });
        readImage(f, 1600).then((img) => AI.readReceipt(img, CAT.map((c) => tx(c.name))))
          .then((r) => this.setState({ aiBusy: false, review: { mode: 'receipt', store: r.store || '', date: r.date || todayISO(), items: (r.items || []).map((x, i) => ({ k: i, on: true, name: x.name || '', qty: x.qty || null, unit: x.unit || null, price: x.price != null ? String(x.price) : '', cat: x.cat || guessCat(x.name || '') })) } }))
          .catch((err) => { console.warn(err); this.setState({ aiBusy: false, sheet: null }); this.flash(L('لم أستطع قراءة الإيصال — صوّره من قريب وفي إضاءة جيدة وبشكل مستقيم', 'Couldn’t read the receipt — shoot it close, straight and well lit'), 3500); });
      },
      startDictation: () => {
        this.setState({ sheet: 'dict', listening: true });
        listen(lang).then((txt) => this.setState({ listening: false, dictText: ((this.state.dictText || '') + (txt ? (this.state.dictText ? '، ' : '') + txt : '')).trim() }))
          .catch((err) => { this.setState({ listening: false }); if (err && /permission/.test(err.message)) this.flash(L('اسمح للتطبيق باستخدام الميكروفون', 'Allow microphone access')); else if (err && /no-speech/.test(err.message)) this.flash(L('الإملاء الصوتي غير متاح هنا — اكتب الطلبات', 'Voice input unavailable here — type the list')); });
      },
      isDict: s.sheet === 'dict', micTxt: s.listening ? L('جارٍ الاستماع…', 'Listening…') : L('تحدّث', 'Speak'), micCls: s.listening ? 'btn-g grow mic-on' : 'btn-g grow', dictText: s.dictText, onDict: (e) => this.setState({ dictText: e.target.value }),
      parseDict: () => {
        const txt = (this.state.dictText || '').trim(); if (!txt) return;
        const ctx = { today: todayISO(), weekday: new Date().toLocaleDateString('en-US', { weekday: 'long' }), me: myId,
          people: PIDS.map((id) => ({ id, name: (PEOPLE.find((p) => p.id === id) || {}).name || WHO[id], dep: !((PEOPLE.find((p) => p.id === id) || {}).email) && id !== myId })), knownNames: CAT.map((c) => tx(c.name)) };
        const toRows = (r) => (r.actions || r.items || []).map((x, i) => {
          const ty = x.type || 'shop';
          if (ty === 'shop') return { k: i, on: true, type: 'shop', name: x.name || '', qty: x.qty || null, unit: x.unit || null, price: '', cat: x.cat || guessCat(x.name || ''), note: x.note || '' };
          if (ty === 'appt') return { k: i, on: true, type: 'appt', name: x.title || '', date: x.date || '', time: x.time || '', apCat: ['vax', 'bill'].includes(x.cat) ? x.cat : 'appt', who: PIDS.includes(x.who) || x.who === 'home' ? x.who : myId };
          if (ty === 'med') return { k: i, on: true, type: 'med', name: x.name || '', dose: x.dose || '', times: (x.times && x.times.length ? x.times : ['09:00']).filter((v) => /^\d\d:\d\d$/.test(v)), who: PIDS.includes(x.who) ? x.who : myId };
          if (ty === 'rec') return { k: i, on: true, type: 'rec', name: x.title || '', recKind: ['visit', 'lab', 'img'].includes(x.kind) ? x.kind : 'visit', date: x.date || todayISO(), result: x.result || '', who: PIDS.includes(x.who) ? x.who : myId };
          if (ty === 'timer') return { k: i, on: true, type: 'timer', name: x.name || L('مؤقت', 'Timer'), minutes: Math.max(1, Math.round(+x.minutes || 5)) };
          if (ty === 'exp') return { k: i, on: true, type: 'exp', name: x.name || '', price: x.amount != null ? String(x.amount) : '', ecat: EC.some((e) => e[0] === x.ecat) ? x.ecat : guessECat(x.name || ''), date: x.date || todayISO(), who: PIDS.includes(x.who) ? x.who : myId };
          return null;
        }).filter(Boolean);
        const local = () => toRows(localCommand(txt, ctx, guessCat));
        this.setState({ sheet: 'review', review: { mode: 'cmd', items: local() } }); // understood on the phone itself
      },
      reviewIsCmd: !!(s.review && s.review.mode !== 'receipt'),
      hasReviewRows: !!(s.review && s.review.items.length),
      isReview: s.sheet === 'review', reviewLoading: s.sheet === 'review' && !s.review,
      reviewIsReceipt: !!(s.review && s.review.mode === 'receipt'), reviewStore: (s.review && s.review.store) || '',
      reviewRows: ((s.review && s.review.items) || []).map((x) => ({
        ...(() => { const ty = x.type || 'shop'; const upd = (o) => this.setState({ review: { ...this.state.review, items: this.state.review.items.map((y) => y.k === x.k ? { ...y, ...o } : y) } });
          const APC = { appt: L('موعد', 'Appointment'), vax: L('تطعيم', 'Vaccine'), bill: L('فاتورة/تجديد', 'Bill/renewal') };
          const RK = { visit: L('كشف', 'Visit'), lab: L('تحليل', 'Lab test'), img: L('أشعة', 'Imaging') };
          return {
            typeTxt: ty === 'exp' ? (ecName[x.ecat] || L('مصروف', 'Expense')) : ty === 'shop' ? L('مشتريات', 'Shopping') : ty === 'appt' ? APC[x.apCat] : ty === 'med' ? L('دواء', 'Medicine') : ty === 'rec' ? RK[x.recKind] : L('مؤقت', 'Timer'),
            typeCls: 'rv-ty rv-' + ty, isAppt: ty === 'appt', isMedR: ty === 'med', isRecR: ty === 'rec', isTimerR: ty === 'timer', isShopR: ty === 'shop', isExpR: ty === 'exp', showPrice: ty === 'exp' || !!(s.review && s.review.mode === 'receipt'),
            date: x.date || '', time: x.time || '', onDate: (e) => upd({ date: e.target.value }), onTime: (e) => upd({ time: e.target.value }),
            whoTxt: x.who ? (WHO[x.who] || '') : '', hasWho: !!x.who && ty !== 'shop' && ty !== 'timer',
            nextWho: () => { const ids = ty === 'appt' ? PIDS.concat(['home']) : PIDS; upd({ who: ids[(ids.indexOf(x.who) + 1) % ids.length] }); },
            timesTxt: (x.times || []).map(fmtTm).join('، '), dose: x.dose || '', onDose: (e) => upd({ dose: e.target.value }),
            minTxt: x.minutes ? L(num(x.minutes) + ' دقيقة', x.minutes + ' min') : '',
            minMinus: () => upd({ minutes: Math.max(1, (x.minutes || 5) - 1) }), minPlus: () => upd({ minutes: (x.minutes || 5) + 1 }),
            noDate: ty === 'appt' && !x.date
          }; })(),
        name: x.name, price: x.price, qtyTxt: x.qty && x.unit ? fmtQty(x.qty, x.unit) : (x.qty ? num(x.qty) : ''),
        ckCls: x.on ? 'ck-on' : 'ck', on: x.on, storeTxt: scName[x.cat] || '',
        toggle: () => this.setState({ review: { ...this.state.review, items: this.state.review.items.map((y) => y.k === x.k ? { ...y, on: !y.on } : y) } }),
        onName: (e) => this.setState({ review: { ...this.state.review, items: this.state.review.items.map((y) => y.k === x.k ? { ...y, name: e.target.value } : y) } }),
        onPrice: (e) => this.setState({ review: { ...this.state.review, items: this.state.review.items.map((y) => y.k === x.k ? { ...y, price: e.target.value } : y) } })
      })),
      reviewTotal: (() => { const r = s.review; if (!r) return ''; const sum = r.items.filter((x) => x.on).reduce((a, x) => a + (parseFloat(x.price) || 0), 0); return sum ? L('الإجمالي: ', 'Total: ') + money(sum) : ''; })(),
      confirmReview: () => {
        const r = this.state.review; if (!r) return;
        const receipt = r.mode === 'receipt';
        let shop = [...this.state.shop]; const logs = []; let added = 0, matched = 0;
        const newCats = []; const appts = [], meds = [], recs = [], timers = [], exps = [];
        r.items.filter((x) => x.on && (x.name || '').trim()).forEach((x, i) => {
          const nm = x.name.trim();
          if (x.type === 'appt') { appts.push({ id: 'x' + (Date.now() + i), title: nm, who: x.who || myId, d: x.date || null, tm: x.time || null, when: fmtWhen(x.date, false) || { ar: 'بلا تاريخ', en: 'No date' }, cat: x.apCat || 'appt', shared: true }); return; }
          if (x.type === 'med') { meds.push({ id: 'd' + (Date.now() + i), active: true, sd: todayISO(), name: nm, dose: (x.dose || '').trim() || L('جرعة', 'dose'), times: [...(x.times || ['09:00'])].sort(), who: x.who || myId, shared: false, note: '' }); return; }
          if (x.type === 'rec') { recs.push({ id: 'r' + (Date.now() + i), type: x.recKind || 'visit', title: nm, who: x.who || myId, d: x.date || todayISO(), result: x.result || '', shared: true, img: '' }); return; }
          if (x.type === 'timer') { timers.push(x); return; }
          if (x.type === 'exp') { const a = parseFloat(x.price); if (!isNaN(a) && a > 0) exps.push({ id: 'e' + (Date.now() + i), kind: 'exp', text: nm, price: a, ecat: x.ecat || 'other', d: x.date || todayISO(), at: Date.now(), by: myId, who: x.who || myId, shared: true }); return; }
          const hit = findCat(x.name);
          const price = parseFloat(x.price);
          const open = shop.find((y) => !y.done && ((hit && y.ref === hit.id) || normName(itemName(y)).includes(normName(x.name))));
          if (!receipt && open && hit && open.ref === hit.id) {
            shop = shop.map((y) => y === open ? { ...y, qty: +(((y.qty || hit.def) + (x.qty || hit.def))).toFixed(2) } : y); matched++; return;
          }
          if (receipt && open) {
            shop = shop.map((y) => y === open ? { ...y, done: true, price: isNaN(price) ? null : price } : y); matched++;
            logs.push({ id: 's:' + open.id, kind: 'shop', text: itemName(open), ...itemBase(open), price: isNaN(price) ? null : price, cat: open.cat });
            return;
          }
          const id = Date.now() + i;
          let item;
          if (hit) item = { id, ref: hit.id, qty: x.qty || hit.def, name: '', desc: x.note || '', cat: hit.cat, by: myId, done: receipt, price: receipt && !isNaN(price) ? price : null };
          else if (x.unit) { const nc = { id: 'u' + id, name: x.name.trim(), cat: x.cat, unit: x.unit, def: x.qty || 1, icon: 'pack', shared: true }; newCats.push(nc); item = { id, ref: nc.id, qty: x.qty || 1, name: '', desc: x.note || '', cat: x.cat, by: myId, done: receipt, price: receipt && !isNaN(price) ? price : null }; }
          else item = { id, name: x.name.trim(), desc: x.note || '', cat: x.cat, by: myId, done: receipt, price: receipt && !isNaN(price) ? price : null };
          shop = [item, ...shop]; added++;
          if (receipt) logs.push({ id: 's:' + id, kind: 'shop', text: x.name.trim(), base: hit ? tx(hit.name) : x.name.trim(), qty: x.qty || null, unit: x.unit || (hit ? hit.unit : null), price: isNaN(price) ? null : price, cat: x.cat });
        });
        const day = receipt && r.date ? r.date : todayISO();
        const me = this.myId();
        const others = (this.state.log || []).filter((l) => !logs.some((n) => n.id === l.id));
        const nShop = added + matched;
        this.setState({ shop, catalog: [...(this.state.catalog || []), ...newCats], sheet: null, review: null, dictText: '',
          appts: [...appts, ...this.state.appts], meds: [...this.state.meds, ...meds], records: [...recs, ...this.state.records],
          log: [...others, ...logs.map((l) => ({ ...l, d: day, at: Date.now(), by: me, who: me, shared: true })), ...exps] });
        appts.forEach((a) => this.nudge(L('موعد جديد: ', 'New appointment: ') + a.title, (a.d ? longDateS(a.d) + (a.tm ? ' · ' + fmtTm(a.tm) : '') : L('بلا تاريخ', 'No date')) + (WHO[a.who] ? ' · ' + WHO[a.who] : ''), true));
        timers.forEach((x) => { const pr = this.state.presets.find((p) => normName(tx(p.name)).includes(normName(x.name)) || normName(x.name).includes(normName(tx(p.name))));
          this.start({ name: x.name, icon: pr ? pr.icon : 'pot', levels: null }, { m: x.minutes, q: '', n: 1 }, 0); });
        if (receipt) { this.flash(L('سُجّل ' + num(nShop) + ' صنفاً بأسعارها', 'Recorded ' + nShop + ' items with prices')); return; }
        const parts = [];
        if (nShop) parts.push(L(num(nShop) + ' للمشتريات', nShop + ' to shopping'));
        if (appts.length) parts.push(L(num(appts.length) + ' موعد', appts.length + ' appointment(s)'));
        if (meds.length) parts.push(L(num(meds.length) + ' دواء', meds.length + ' medicine(s)'));
        if (recs.length) parts.push(L(num(recs.length) + ' في السجل الطبي', recs.length + ' to the record'));
        if (timers.length) parts.push(L(num(timers.length) + ' مؤقت', timers.length + ' timer(s)'));
        if (exps.length) parts.push(L(num(exps.length) + ' مصروف بقيمة ' + money(exps.reduce((a, e) => a + e.price, 0)), exps.length + ' expense(s)'));
        if (!timers.length) { if (appts.length && !nShop && !meds.length) this.setState({ tab: 'sched', schedSeg: 'appts' }); else if (meds.length && !nShop) this.setState({ tab: 'sched', schedSeg: 'meds' }); }
        this.flash(L('تم الحفظ: ', 'Saved: ') + parts.join(L('، ', ', ')));
      },
      // ---- other expenses (rent, bills, ...) ----
      openExp: () => this.setState({ sheet: 'exp', ef: { text: '', amount: '', ecat: 'rent', d: todayISO(), who: myId, recur: false, day: '' } }),
      isExpSheet: s.sheet === 'exp' && !!s.ef,
      efv: (() => { const ef = s.ef || {}; const set = (o) => this.setState({ ef: { ...this.state.ef, ...o } });
        return { text: ef.text || '', amount: ef.amount || '', d: ef.d || '', day: ef.day || '', dayTxt: num(ef.day || 1),
          onDay: (e) => { const v = parseInt(String(e.target.value).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); set({ day: isNaN(v) ? '' : Math.max(1, Math.min(31, v)) }); },
          paidNow: !!ef.paidNow, showPaidToggle: !!ef.recur && !ef.editRecur && !ef.lockRecur, paidCls: ef.paidNow ? 'vis vis-on' : 'vis vis-off', togglePaid: () => set({ paidNow: !this.state.ef.paidNow }),
          showDate: !ef.editRecur && (!ef.recur || !!ef.paidNow), needAmountHint: !!ef.recur && !ef.paidNow || !!ef.editRecur,
          cats: EC.map(([id, n]) => ({ name: n, cls: ef.ecat === id ? 'chip-on' : 'chip', sel: () => set({ ecat: id, ecatTouched: true }) })),
          who: PIDS.map((id) => ({ name: WHO[id], cls: ef.who === id ? 'chip-on' : 'chip', sel: () => set({ who: id }) })),
          onText: (e) => { const v = e.target.value; set({ text: v, ...(this.state.ef && !this.state.ef.ecatTouched ? { ecat: guessECat(v) } : {}) }); },
          onAmount: (e) => set({ amount: e.target.value }), onDate: (e) => set({ d: e.target.value }),
          recurCls: ef.recur ? 'vis vis-on' : 'vis vis-off', recurOn: !!ef.recur, showRecur: !ef.lockRecur && !ef.editRecur,
          toggleRecur: () => set({ recur: !this.state.ef.recur }),
          dayMinus: () => set({ day: Math.max(1, (this.state.ef.day || 1) - 1) }), dayPlus: () => set({ day: Math.min(28, (this.state.ef.day || 1) + 1) }),
          ckinds: [['plain', L('ثابت كل شهر', 'Monthly')], ['inst', L('قسط', 'Installment')], ['gam', L('جمعية', 'Gam’eya')]].map(([k, n]) => ({ name: n, cls: (ef.ckind || 'plain') === k ? 'chip-on' : 'chip', sel: () => set({ ckind: k, ...(k === 'inst' && !this.state.ef.ecat ? {} : {}), ...(k !== 'plain' && !this.state.ef.start ? { start: todayISO().slice(0, 7) } : {}), ...(k === 'inst' ? { ecat: 'inst' } : {}), ...(k === 'gam' ? { ecat: 'inst' } : {}) }) })),
          isInst: ef.ckind === 'inst', isGam: ef.ckind === 'gam', isCommit: ef.ckind === 'inst' || ef.ckind === 'gam',
          months: ef.months || '', start: ef.start || '', turn: ef.turn || '',
          onMonths: (e) => set({ months: e.target.value }), onStart: (e) => set({ start: e.target.value }), onTurn: (e) => set({ turn: e.target.value }),
          gamPreview: (() => { const m = parseInt(ef.months, 10), a = parseFloat(ef.amount), tr = parseInt(ef.turn, 10); if (ef.ckind !== 'gam' || !m || !ef.start) return ''; const py = addYM(ef.start, (tr || 1) - 1);
            return L('هتقبض ' + (a ? money(a * m) : '') + ' في ' + ymName(py) + ' · آخر قسط ' + ymName(addYM(ef.start, m - 1)), 'Payout ' + (a ? money(a * m) + ' ' : '') + 'in ' + ymName(py)); })(),
          instPreview: (() => { const m = parseInt(ef.months, 10), a = parseFloat(ef.amount); if (ef.ckind !== 'inst' || !m || !ef.start) return ''; return L('الإجمالي ' + (a ? money(a * m) : '—') + ' · آخر قسط ' + ymName(addYM(ef.start, m - 1)), 'Total ' + (a ? money(a * m) : '—') + ' · last ' + ymName(addYM(ef.start, m - 1))); })(),
          isEditRecur: !!ef.editRecur, isPay: !!ef.payMode, saveTxt: ef.editRecur ? L('حفظ التعديل', 'Save changes') : ef.payMode ? L('تأكيد الدفع', 'Confirm payment') : (ef.recur && !ef.paidNow) ? L('إضافة كمصروف ثابت', 'Add as fixed expense') : L('حفظ المصروف', 'Save expense') };
      })(),
      saveExp: () => {
        const commitOf = (ef) => { const k = ef.ckind || 'plain'; if (k === 'plain') return { kind: 'plain' }; const m = parseInt(String(ef.months || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10) || 12;
          return { kind: k, months: m, start: ef.start || todayISO().slice(0, 7), ...(k === 'gam' ? { turn: Math.max(1, Math.min(m, parseInt(ef.turn, 10) || 1)) } : {}) }; };
        const ef = this.state.ef; const amt = parseFloat(String(ef.amount).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        const name = (ef.text || '').trim() || ecName[ef.ecat];
        const day = Math.max(1, Math.min(31, parseInt(ef.day, 10) || 1));
        if (ef.editRecur) { this.setState({ recur: this.state.recur.map((r) => r.id === ef.editRecur ? { ...r, ...commitOf(ef), name, amount: isNaN(amt) || amt <= 0 ? null : amt, ecat: ef.ecat, day, who: ef.who, rem: ef.rem || [] } : r), sheet: null, ef: null }); this.flash(L('تم التعديل', 'Updated')); return; }
        if (ef.recur && !ef.paidNow) {
          if (!ef.day) { this.flash(L('اكتب يوم الاستحقاق', 'Enter the due day')); return; }
          this.setState({ recur: [...(this.state.recur || []), { id: 'rc' + Date.now(), ...commitOf(ef), name, amount: isNaN(amt) || amt <= 0 ? null : amt, ecat: ef.ecat, day, who: ef.who, rem: ef.rem || [], shared: true }], sheet: null, ef: null });
          this.flash(L('أُضيف «' + name + '» كمصروف ثابت — سيظهر يوم ' + num(day) + ' لتأكيد دفعه', 'Added “' + name + '” — it will show on day ' + day + ' to confirm'));
          return;
        }
        if (isNaN(amt) || amt <= 0) { this.flash(L('اكتب المبلغ أولاً', 'Enter the amount first')); return; }
        let recurId = ef.recurId || null; const add = {};
        if (ef.recur) { if (!ef.day) { this.flash(L('اكتب يوم الاستحقاق', 'Enter the due day')); return; } recurId = 'rc' + Date.now(); add.recur = [...(this.state.recur || []), { id: recurId, ...commitOf(ef), name, amount: amt, ecat: ef.ecat, day, who: ef.who, rem: ef.rem || [], shared: true }]; }
        const me = this.myId();
        const entry = { id: 'e' + Date.now(), kind: 'exp', text: name, price: amt, ecat: ef.ecat, d: ef.d || todayISO(), at: Date.now(), by: me, who: ef.who || me, shared: true, ...(recurId ? { recurId } : {}) };
        this.setState({ ...add, log: [...(this.state.log || []), entry], sheet: null, ef: null });
        this.flash(L('سُجّل ' + money(amt) + ' — ' + name, 'Recorded ' + money(amt) + ' — ' + name) + (ef.recur ? L(' (يتكرر شهرياً)', ' (monthly)') : ''));
      },
      delRecur: () => { const id = this.state.ef && this.state.ef.editRecur; if (!id || !window.confirm(L('إيقاف هذا المصروف الثابت؟ (المدفوع سابقاً يبقى محفوظاً)', 'Stop this fixed expense? (past payments stay)'))) return; this.setState({ recur: this.state.recur.filter((r) => r.id !== id), sheet: null, ef: null }); },
      recurRows, hasRecur: recurRows.length > 0,
      todayDues: isHid('shop.spend') ? [] : recurRows.filter((r) => r.unpaid && r.dLeft <= 3).map((r) => ({ ...r, wCls: r.dLeft <= 0 ? 'due-w due-hot' : 'due-w' })),
      hasTodayDues: recurRows.some((r) => r.unpaid && r.dLeft <= 3), recentExp, hasRecentExp: recentExp.length > 0,
      spendSplit: otherSpent > 0 ? L('مشتريات ' + money(shopSpent) + ' · مصروفات أخرى ' + money(otherSpent), 'Shopping ' + money(shopSpent) + ' · Other ' + money(otherSpent)) : '',
      hasSpendSplit: otherSpent > 0,
      clearDone: () => {
        const unpriced = this.state.shop.filter((x) => x.done && !x.price).length;
        if (!this.state.shop.some((x) => x.done && x.price)) { this.flash(L('سجّل أسعار ما اشتريته أولاً ثم أزله', 'Add the prices of bought items first')); return; }
        this.bulkUntil = Date.now() + 2000;
        const keep = (x) => !x.done || !x.price;
        const note = unpriced ? L(' — بقي ' + num(unpriced) + ' بلا سعر', ' — ' + unpriced + ' kept (no price)') : '';
        if (this.fid) {
          const add = {}; this.state.shop.forEach((x) => { if (x.done && x.price) add[x.cat] = (add[x.cat] || 0) + Number(x.price); });
          S.addSpend(this.fid, this.state.auth.uid, monthKey(), add).catch(() => {});
          this.setState({ shop: this.state.shop.filter(keep) });
          this.flash(L('أُزيل ما سُجّل سعره', 'Cleared priced items') + note); return;
        }
        const h = { ...this.state.history };
        this.state.shop.forEach((x) => { if (x.done && x.price) h[x.cat] = (h[x.cat] || 0) + Number(x.price); });
        this.setState({ history: h, shop: this.state.shop.filter(keep) });
        this.flash(L('أُزيل ما سُجّل سعره', 'Cleared priced items') + note);
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
      openMed: () => this.setState({ sheet: 'med', mf: { name: '', dose: '', times: ['09:00'], note: '', who: myId, shared: false, editId: null } }),
      openRec: () => this.setState({ sheet: 'rec', rf: { type: 'visit', title: '', date: '', result: '', who: myId, shared: true, editId: null } }),
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
        const old = f2.editId && this.state.meds.find((y) => y.id === f2.editId);
        const m = { ...(old || { active: true, sd: today }), id: old ? old.id : 'd' + Date.now(), name: nm, dose: (f2.dose || '').trim() || L('جرعة', 'dose'), times: [...f2.times].filter(Boolean).sort(), who: f2.who, shared: f2.shared, note: (f2.note || '').trim() };
        this.setState({ meds: old ? this.state.meds.map((y) => y.id === m.id ? m : y) : [...this.state.meds, m], sheet: null, medInfo: null, tab: 'sched', schedSeg: 'meds', medWho: f2.who });
        this.flash(old ? L('تم تعديل الدواء', 'Medicine updated') : L('تم حفظ الدواء', 'Medicine saved'));
      },
      editMed: () => {
        const m = this.state.meds.find((y) => y.id === this.state.medInfo); if (!m) return;
        this.setState({ sheet: 'med', mf: { name: tx(m.name), dose: tx(m.dose), times: [...m.times], note: tx(m.note), who: m.who, shared: !!m.shared, editId: m.id } });
      },
      deleteMed: () => {
        if (!window.confirm(L('حذف هذا الدواء نهائياً؟ (إن توقفت عنه استخدم «أوقفتُ هذا الدواء» ليبقى في السجل)', 'Delete this medicine permanently? (If you stopped it, use “I stopped this medicine” to keep it in the record)'))) return;
        this.setState({ meds: this.state.meds.filter((y) => y.id !== this.state.medInfo), sheet: null, medInfo: null });
      },
      stopMed: () => {
        const id = this.state.medInfo;
        this.setState({ meds: this.state.meds.map((m) => m.id === id ? { ...m, active: false, ed: todayISO() } : m), sheet: null, medInfo: null });
        this.flash(L('نُقل إلى السجل الطبي', 'Moved to the medical record'));
      },
      rf, rfPh: rf.type === 'lab' ? L('مثلاً: صورة دم كاملة', 'e.g. complete blood count') : rf.type === 'img' ? L('مثلاً: أشعة على الركبة', 'e.g. knee X-ray') : L('مثلاً: كشف باطني', 'e.g. GP visit'),
      rfTypes: ['visit', 'lab', 'img'].map((k) => ({ name: RT[k][0], cls: rf.type === k ? 'chip-on' : 'chip', sel: () => setRf({ type: k }) })),
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
        const old = r.editId && this.state.records.find((y) => y.id === r.editId);
        const rec = { ...(old || {}), id: old ? old.id : 'r' + Date.now(), type: r.type, title: ti, who: r.who, d: r.date || todayISO(), result: (r.result || '').trim(), shared: r.shared, img: r.img || '' };
        this.setState({ records: old ? this.state.records.map((y) => y.id === rec.id ? rec : y) : [rec, ...this.state.records], sheet: null, recView: null, tab: 'sched', schedSeg: 'rec', recType: 'all', recWho: 'all' });
        if (!old && rec.shared && rec.d > todayISO()) this.nudge(L('موعد جديد: ', 'New appointment: ') + ti, longDateS(rec.d) + (WHO[rec.who] ? ' · ' + WHO[rec.who] : ''), true);
        this.flash(rec.d > todayISO() ? L('حُفظ في السجل الطبي وأُضيف إلى المواعيد', 'Saved to the record and added to appointments') : L('تم الحفظ في السجل الطبي', 'Saved to the medical record'));
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

      editingAppt: !!s.form.editId && s.sheet === 'appt' && !!s.form.shared,
      remindEdited: () => { const fm = this.state.form; this.nudge(L('تذكير: ', 'Reminder: ') + fm.title, (fm.when ? longDateS(fm.when) : '') + (WHO[fm.who] ? ' · ' + WHO[fm.who] : '')); },
      vis: (() => {
        const mk = (on, set) => ({ on, off: !on, cls: on ? 'vis vis-on' : 'vis vis-off', toggle: () => set(!on),
          txt: on ? L('ظاهر لكل الأسرة', 'Visible to the family') : L('مخفي عن الأسرة', 'Hidden from the family'),
          sub: on ? L('اضغط على العين لإخفائه', 'Tap the eye to hide it') : L('تراه أنت فقط — اضغط لإظهاره', 'Only you see it — tap to show') });
        return {
          appt: mk(!!f.shared, (v) => this.setForm({ shared: v })),
          med: mk(!!mf.shared, (v) => setMf({ shared: v })),
          rec: mk(!!rf.shared, (v) => setRf({ shared: v })),
          card: mk(!!cf.shared, (v) => setCf({ shared: v }))
        };
      })(),
      fCats, fWho, apptPh: isMedForm ? L('مثلاً: شراب السعال — ٥ مل', 'e.g. cough syrup — 5 ml') : L('مثلاً: تطعيم الشهر الـ١٨', 'e.g. 18-month vaccine'),
      whenLbl: isMedForm ? L('الساعة (يومياً)', 'Time (every day)') : L('التاريخ', 'Date'), whenType: isMedForm ? 'time' : 'date',
      setTitle: (e) => this.setForm({ title: e.target.value }),
      setWhen: (e) => this.setForm({ when: e.target.value }), setTm: (e) => this.setForm({ tm: e.target.value }), showApptTime: !isMedForm, tmLbl: L('الساعة (اختياري)', 'Time (optional)'),
      fSharedCls: f.shared ? 'chip-on' : 'chip', fPrivateCls: f.shared ? 'chip' : 'chip-on',
      setShared: () => this.setForm({ shared: true }), setPrivate: () => this.setForm({ shared: false }),
      saveAppt: () => {
        const fm = this.state.form, title = (fm.title || '').trim();
        if (!title) { this.flash(L('اكتب العنوان أولاً', 'Enter a title first')); return; }
        const when = fmtWhen(fm.when, fm.cat === 'med') || { ar: 'بلا تاريخ', en: 'No date' };
        const old = fm.editId && this.state.appts.find((y) => y.id === fm.editId);
        const a = { ...(old || {}), id: old ? old.id : 'x' + Date.now(), title, who: fm.who, when, d: fm.when || null, tm: (fm.cat !== 'med' && fm.tm) || null, cat: fm.cat, shared: fm.shared, rem: fm.rem || [] };
        this.setState({ appts: old ? this.state.appts.map((y) => y.id === a.id ? a : y) : [a, ...this.state.appts], sheet: null, tab: 'sched', schedSeg: 'appts', cat: 'all', scope: 'all', form: { ...this.state.form, editId: null } });
        this.flash(old ? L('تم تعديل الموعد', 'Appointment updated') : L('تم الحفظ', 'Saved'));
        if (!old && a.shared) this.nudge(L('موعد جديد: ', 'New appointment: ') + title, (a.d ? longDateS(a.d) + (a.tm ? ' · ' + fmtTm(a.tm) : '') : L('بلا تاريخ', 'No date')) + (WHO[a.who] ? ' · ' + WHO[a.who] : ''), true);
      },

      ...(() => {
        const pf = this.myPrefs();
        const TK = ['hero', 'dues', 'todos', 'chores', 'week', 'meds', 'alerts', 'appts', 'shop'];
        const NK = ['today', 'sched', 'cards', 'kitchen', 'shop', 'home'];
        const norm = (saved, def) => { const a = (saved || []).filter((k) => def.includes(k)); def.forEach((k) => { if (!a.includes(k)) a.push(k); }); return a; };
        const to = norm(pf.tOrder, TK), no = norm(pf.nOrder, NK);
        const tord = {}, nord = {}; to.forEach((k, i) => { tord[k] = i + 1; }); no.forEach((k, i) => { nord[k] = i + 1; });
        return { tord, nord, _to: to, _no: no };
      })(),
      show: (() => { const v = (k) => !isHid(k); return {
        sched: v('sched'), cards: v('cards'), kitchen: v('kitchen'), shop: v('shop'), home: v('home'),
        todayHero: v('today.hero'), todayTodos: v('today.todos'), todayChores: v('today.chores'), todayDues: v('today.dues'), todayWeek: v('today.week'), todayMeds: v('today.meds'), todayAlerts: v('today.alerts'), todayAppts: v('today.appts'), todayShop: v('today.shop'),
        shopSpend: v('shop.spend'), shopQuick: v('shop.quick'),
        mShop: v('shop'), mAppt: v('sched.appts'), mRec: v('sched.health'), mTask: v('kitchen'), mMed: v('sched.meds'), mExp: v('shop.spend') }; })(),
      navHold,
      openLayout: () => this.setState({ sheet: 'layout' }), isLayout: s.sheet === 'layout',
      layoutRows: (() => {
        const hide = this.myPrefs().hide || {};
        const G = [
          ['today', L('شاشة اليوم', 'Today'), [['today.dues', L('مستحقات قريبة', 'Coming up')], ['today.hero', L('البطاقة الخضراء (ملخص اليوم)', 'Summary card')], ['today.todos', L('مهامي اليوم', 'My to-dos')], ['today.chores', L('مهام البيت', 'Household tasks')], ['today.week', L('شريط الأسبوع', 'Week strip')], ['today.meds', L('أدوية اليوم', 'Today’s medicines')], ['today.alerts', L('تنبيهات البطاقات', 'Card alerts')], ['today.appts', L('المواعيد القادمة', 'Upcoming')], ['today.shop', L('ملخص المشتريات', 'Shopping summary')]], true],
          ['sched', L('المواعيد', 'Schedule'), [['sched.appts', L('المواعيد والفواتير', 'Appointments & bills')], ['sched.meds', L('الأدوية', 'Medicines')], ['sched.health', L('الصحة والسجل الطبي', 'Health & records')]]],
          ['cards', L('البطاقات', 'Cards'), []],
          ['kitchen', L('المطبخ', 'Kitchen'), []],
          ['shop', L('المشتريات', 'Shopping'), [['shop.spend', L('المصروفات والتقارير', 'Expenses & reports')], ['shop.quick', L('الاختيار السريع', 'Quick pick')]]],
          ['home', L('البيت', 'Home'), [['home.chores', L('مهام البيت', 'Household tasks')], ['home.car', L('العربية', 'Car')], ['home.maint', L('صيانة البيت', 'Home maintenance')], ['home.warranty', L('الضمانات', 'Warranties')], ['home.contacts', L('أرقام مهمة', 'Contacts')]]]
        ];
        const pf2 = this.myPrefs();
        const TK = ['hero', 'dues', 'todos', 'chores', 'week', 'meds', 'alerts', 'appts', 'shop'], NK = ['today', 'sched', 'cards', 'kitchen', 'shop', 'home'];
        const norm = (saved, def) => { const a = (saved || []).filter((k) => def.includes(k)); def.forEach((k) => { if (!a.includes(k)) a.push(k); }); return a; };
        const to = norm(pf2.tOrder, TK), no = norm(pf2.nOrder, NK);
        const move = (arr, k, d, key) => { const a = arr.slice(); const i = a.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; this.setPref({ [key]: a }); };
        G.sort((a, b) => no.indexOf(a[0]) - no.indexOf(b[0]));
        this._dragH = this._dragH || {};
        this._dragH.nav = (ids) => this.setPref({ nOrder: ['today', ...ids.filter((k) => k !== 'today')] });
        this._dragH.today = (ids) => this.setPref({ tOrder: ids });
        const tmap = { 'today.hero': 'hero', 'today.dues': 'dues', 'today.todos': 'todos', 'today.chores': 'chores', 'today.week': 'week', 'today.meds': 'meds', 'today.alerts': 'alerts', 'today.appts': 'appts', 'today.shop': 'shop' };
        G.forEach((g) => { if (g[0] === 'today') { g[2] = g[2].slice().sort((a, b) => to.indexOf(tmap[a[0]]) - to.indexOf(tmap[b[0]])); } });
        return G.map(([k, name, subs, fixed]) => { const on = fixed || !hide[k];
          return { name, on, swCls: fixed ? 'sw sw-on sw-fixed' : on ? 'sw sw-on' : 'sw', fixed: !!fixed, notFixed: !fixed,
            toggle: () => { if (!fixed) this.setHide({ [k]: on }); },
            dk: k !== 'today' ? k : '', gripCls: k !== 'today' ? 'dgrip' : 'dgrip grip-off', subList: k === 'today' ? 'today' : '', canMove: k !== 'today', up: () => move(no, k, -1, 'nOrder'), down: () => move(no, k, 1, 'nOrder'),
            subs: subs.map(([sk, sn]) => { const son = !hide[sk]; const tk = tmap[sk]; return { name: sn, swCls: (son ? 'sw sw-on' : 'sw') + (on ? '' : ' sw-dim'), toggle: () => this.setHide({ [sk]: son }),
              dk: tk || '', gripCls: tk ? 'dgrip' : 'dgrip grip-no', canMove: !!tk, up: () => move(to, tk, -1, 'tOrder'), down: () => move(to, tk, 1, 'tOrder') }; }),
            hasSubs: on && subs.length > 0 }; });
      })(),
      hasHidden: Object.keys(this.myPrefs().hide || {}).length > 0,
      muteCls: this.myPrefs().muteHidden ? 'sw sw-on' : 'sw', muteOn: !!this.myPrefs().muteHidden,
      toggleMute: () => { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: cur.hide || {}, muteHidden: !cur.muteHidden, shared: false }] }); },
      showAll: () => { const cur = this.myPrefs(); this.setState({ prefs: [...(this.state.prefs || []).filter((x) => x.id !== cur.id), { ...cur, hide: {}, shared: false }] }); this.flash(L('عادت كل الأقسام', 'Everything is visible again')); },
      ...(() => {
        const mk = (cur, set, opts) => (opts || REM.map((x) => x[0])).map((k) => { const on = (cur || []).includes(k); return { name: L({ h1: 'قبلها بساعة', h3: 'بـ٣ ساعات', d1: 'بيوم', d2: 'بيومين', d3: 'بـ٣ أيام', w1: 'بأسبوع', w2: 'بأسبوعين', m1: 'بشهر' }[k], { h1: '1 hour', h3: '3 hours', d1: '1 day', d2: '2 days', d3: '3 days', w1: '1 week', w2: '2 weeks', m1: '1 month' }[k]), cls: on ? 'chip-on' : 'chip', sel: () => set(on ? (cur || []).filter((x) => x !== k) : [...(cur || []), k]) }; });
        const dayOpts = ['d1', 'd2', 'd3', 'w1', 'w2', 'm1'];
        return {
          remAppt: mk(s.form.rem, (v) => this.setForm({ rem: v }), s.form.tm ? null : dayOpts),
          remExp: mk(s.ef && s.ef.rem, (v) => this.setState({ ef: { ...this.state.ef, rem: v } }), dayOpts),
          remCard: mk(s.cardForm && s.cardForm.rem, (v) => this.setState({ cardForm: { ...this.state.cardForm, rem: v } }), dayOpts),
          remHf: mk(s.hf && s.hf.rem, (v) => this.setState({ hf: { ...this.state.hf, rem: v } }), dayOpts),
          remDefAppt: s.form.tm ? L('الافتراضي: الساعة ٨ مساء اليوم السابق، وصباح يوم الموعد، وقبله بساعة', 'Default: 8 pm the day before, that morning and 1 hour before') : L('الافتراضي: صباح اليوم السابق وصباح يوم الموعد', 'Default: the morning before and the morning of'),
          remDefExp: L('الافتراضي: الساعة ٨ مساء اليوم السابق وصباح يوم الاستحقاق', 'Default: 8 pm the day before and the due morning'),
          remDefCard: L('الافتراضي: قبل الانتهاء بشهر', 'Default: a month before expiry'),
          remDefMaint: L('الافتراضي: قبلها بـ٣ أيام ويوم موعدها', 'Default: 3 days before and on the day'),
          remDefWarranty: L('الافتراضي: قبل انتهاء الضمان بشهر', 'Default: a month before it ends')
        };
      })(),
      toast: s.toast, hasToast: !!s.toast,
      ...HV, ...HL, ...RP, ...SA, ...DZ, ...TDO, ...CH,
      homeDue: HV.homeDue, hasHomeDue: HV.homeDue.length > 0, hasAnyDue: !isHid('today.dues') && (HV.homeDue.length > 0 || (!isHid('shop.spend') && recurRows.some((r) => r.unpaid && r.dLeft <= 3))),
      navHome: L('البيت', 'Home')
    };
  }
}
