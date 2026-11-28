// End-to-end encryption for the Cards section.
// A family PIN → PBKDF2 (310k, SHA-256) → AES-GCM-256 key. Only the encrypted blob ever leaves the phone;
// Firebase (and anyone with server access) sees ciphertext. The key is kept on this device as a
// non-extractable CryptoKey in IndexedDB, so the PIN is asked once per device.
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

export const SECRET = ['num', 'iban', 'acct', 'front', 'back'];
export const supported = () => !!(window.crypto && crypto.subtle && window.indexedDB);
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(salt), iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  return 'v1.' + b64(iv) + '.' + b64(ct);
}
export async function decrypt(key, s) {
  const [v, iv, ct] = String(s).split('.');
  if (v !== 'v1') throw new Error('bad-format');
  return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))));
}
export const makeCheck = (key) => encrypt(key, { ok: 'baitna' });
export async function verify(key, check) { try { return (await decrypt(key, check)).ok === 'baitna'; } catch (e) { return false; } }

// card <-> stored form
export async function sealCard(key, card) {
  const sec = {}, rest = {};
  Object.keys(card).forEach((k) => { if (k === '_locked') return; if (SECRET.includes(k)) { if (card[k]) sec[k] = card[k]; } else rest[k] = card[k]; });
  delete rest.enc;
  return { ...rest, enc: await encrypt(key, sec) };
}
export async function openCard(key, stored) {
  const { enc, ...rest } = stored;
  return { ...rest, ...(await decrypt(key, enc)) };
}

// --- key storage (IndexedDB, non-extractable) ---
const db = () => new Promise((res, rej) => { const r = indexedDB.open('baitna-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('k', mode); const q = fn(t.objectStore('k')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
export const saveKey = (id, key) => tx('readwrite', (st) => st.put(key, id)).catch(() => {});
export const loadKey = (id) => tx('readonly', (st) => st.get(id)).catch(() => null);
export const dropKey = (id) => tx('readwrite', (st) => st.delete(id)).catch(() => {});
