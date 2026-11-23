// Native features on Android via Capacitor, with browser fallbacks.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const isNative = Capacitor.isNativePlatform();

export async function setupNative() {
  if (!isNative) return;
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    try {
      const ex = await LocalNotifications.checkExactNotificationSetting();
      if (ex && ex.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
    } catch (e) {}
    await LocalNotifications.createChannel({ id: 'timers', name: 'مؤقتات المطبخ', importance: 5, visibility: 1, vibration: true });
    await LocalNotifications.createChannel({ id: 'meds', name: 'مواعيد الأدوية', importance: 5, visibility: 1, vibration: true });
    await LocalNotifications.createChannel({ id: 'reminders', name: 'التذكيرات', importance: 4, visibility: 1, vibration: true });
  } catch (e) { console.warn('notifications setup', e); }
}

export async function speak(text, lang) {
  if (isNative) {
    try { await TextToSpeech.speak({ text, lang: lang === 'ar' ? 'ar-EG' : 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0 }); return; } catch (e) {}
  }
  try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'ar' ? 'ar-EG' : 'en-US'; window.speechSynthesis.speak(u); } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {}
}

// ---- notification ids ----
const hash = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x) % 90000; };
export const timerIds = (timerId) => [100000 + hash(String(timerId)), 200000 + hash(String(timerId))];

export async function scheduleTimer(t, texts) {
  if (!isNative) return;
  const [warnId, doneId] = timerIds(t.id);
  const list = [];
  const warnAt = t.endAt - 60000;
  if (warnAt > Date.now() + 2000) list.push({ id: warnId, title: texts.warnTitle, body: texts.warnBody, channelId: 'timers', schedule: { at: new Date(warnAt), allowWhileIdle: true } });
  list.push({ id: doneId, title: texts.doneTitle, body: texts.doneBody, channelId: 'timers', schedule: { at: new Date(t.endAt), allowWhileIdle: true } });
  try { await LocalNotifications.schedule({ notifications: list }); } catch (e) { console.warn(e); }
}
export async function cancelTimer(id) {
  if (!isNative) return;
  try { await LocalNotifications.cancel({ notifications: timerIds(id).map((i) => ({ id: i })) }); } catch (e) {}
}

// Daily medicine reminders, appointment and card-expiry reminders: rebuilt whenever the data changes.
let lastSig = '';
export async function syncReminders(list) {
  if (!isNative) return;
  const sig = JSON.stringify(list);
  if (sig === lastSig) return;
  lastSig = sig;
  try {
    const pending = await LocalNotifications.getPending();
    const old = (pending.notifications || []).filter((n) => n.id >= 300000).map((n) => ({ id: n.id }));
    if (old.length) await LocalNotifications.cancel({ notifications: old });
    const now = Date.now();
    const notes = list.filter((n) => n.repeatDaily || (n.at && n.at > now)).map((n, i) => ({
      id: 300000 + i, title: n.title, body: n.body, channelId: n.channel,
      schedule: n.repeatDaily ? { on: { hour: n.hour, minute: n.minute }, allowWhileIdle: true } : { at: new Date(n.at), allowWhileIdle: true }
    }));
    if (notes.length) await LocalNotifications.schedule({ notifications: notes.slice(0, 60) });
  } catch (e) { console.warn('reminders', e); }
}

export async function biometricUnlock(reason, cancelTitle) {
  if (!isNative) return true;
  try {
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable && !info.deviceIsSecure) return true; // no lock set on the phone
    await BiometricAuth.authenticate({ reason, cancelTitle, allowDeviceCredential: true, androidTitle: reason });
    return true;
  } catch (e) { return false; }
}

// Shrink a picked photo so it fits comfortably in local storage.
export function readImage(file, maxSide = 1100) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(null);
      img.src = r.result;
    };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
