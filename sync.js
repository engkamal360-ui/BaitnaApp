// Family sharing over Firebase (Auth by email + Firestore). Inactive when firebase-config.js is empty.
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, collection, doc, query, where, onSnapshot,
  setDoc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp
} from 'firebase/firestore';
import CONFIG from './firebase-config.js';

export const enabled = !!(CONFIG && CONFIG.apiKey && CONFIG.projectId);
export const KINDS = ['shop', 'appts', 'meds', 'records', 'cards'];
let auth = null, db = null;
if (enabled) {
  const app = initializeApp(CONFIG);
  auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
  try { db = initializeFirestore(app, { localCache: persistentLocalCache() }); }
  catch (e) { db = initializeFirestore(app, {}); }
}
const low = (e) => (e || '').trim().toLowerCase();
const clean = (o) => JSON.parse(JSON.stringify(o));

export const watchAuth = (cb) => (enabled ? onAuthStateChanged(auth, cb) : () => {});
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, low(email), pw);
export async function signUp(email, pw, name) {
  const c = await createUserWithEmailAndPassword(auth, low(email), pw);
  if (name) await updateProfile(c.user, { displayName: name });
  return c.user;
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, low(email));
export const logOut = () => signOut(auth);

// ---- family ----
// every family whose member list contains this email (own family + pending invitations)
export function watchFamilies(email, cb) {
  const q = query(collection(db, 'families'), where('memberEmails', 'array-contains', low(email)));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (err) => { console.warn('families', err); cb([], err); });
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export async function ensureInviteCode(fam, uid) {
  if (fam.inviteCode) return fam.inviteCode;
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  await setDoc(doc(db, 'invites', code), { fid: fam.id, by: uid, created: serverTimestamp() });
  await updateDoc(doc(db, 'families', fam.id), { inviteCode: code });
  return code;
}
export async function joinWithCode(code, email) {
  const snap = await getDoc(doc(db, 'invites', normCode(code)));
  if (!snap.exists()) throw { code: 'invite/not-found' };
  const fid = snap.data().fid;
  await updateDoc(doc(db, 'families', fid), { memberEmails: arrayUnion(low(email)) });
  return fid;
}
export async function createFamily(user, famName, myName) {
  const ref = doc(collection(db, 'families'));
  await setDoc(ref, {
    name: famName, owner: user.uid, memberEmails: [low(user.email)],
    people: [{ id: user.uid, name: myName || user.email.split('@')[0], email: low(user.email) }],
    dependents: [], budget: 8000, created: serverTimestamp()
  });
  return ref.id;
}
export const updateFamily = (fid, patch) => updateDoc(doc(db, 'families', fid), clean(patch));
export const inviteEmail = (fid, email) => updateDoc(doc(db, 'families', fid), { memberEmails: arrayUnion(low(email)) });
export const removeEmail = (fid, email) => updateDoc(doc(db, 'families', fid), { memberEmails: arrayRemove(low(email)) });
export async function leaveFamily(fam, uid, email) {
  await updateDoc(doc(db, 'families', fam.id), { people: (fam.people || []).filter((p) => p.id !== uid), memberEmails: arrayRemove(low(email)) });
}

// ---- shared + personal items: a member sees shared items and their own personal ones ----
export function watchKind(fid, uid, kind, cb) {
  const col = collection(db, 'families', fid, kind);
  let shared = new Map(), own = new Map();
  const emit = () => cb([...new Map([...shared, ...own]).values()]);
  const toMap = (s) => new Map(s.docs.map((d) => [d.id, { ...d.data(), id: d.data().id ?? d.id }]));
  const u1 = onSnapshot(query(col, where('shared', '==', true)), (s) => { shared = toMap(s); emit(); }, (e) => console.warn(kind, e));
  const u2 = onSnapshot(query(col, where('owner', '==', uid)), (s) => { own = toMap(s); emit(); }, (e) => console.warn(kind, e));
  return () => { u1(); u2(); };
}
export const putItem = (fid, kind, item) => setDoc(doc(db, 'families', fid, kind, String(item.id)), clean(item));
export const delItem = (fid, kind, id) => deleteDoc(doc(db, 'families', fid, kind, String(id)));

// ---- monthly spending totals (shared) ----
export function watchSpend(fid, month, cb) {
  return onSnapshot(doc(db, 'families', fid, 'spend', month), (d) => {
    const o = d.exists() ? d.data() : {};
    const totals = {}; Object.keys(o).forEach((k) => { if (typeof o[k] === 'number') totals[k] = o[k]; });
    cb(totals);
  }, (e) => console.warn('spend', e));
}
export function addSpend(fid, uid, month, byCat) {
  const patch = { shared: true, owner: uid };
  Object.entries(byCat).forEach(([k, v]) => { if (v) patch[k] = increment(v); });
  return setDoc(doc(db, 'families', fid, 'spend', month), patch, { merge: true });
}

export function authError(e, ar) {
  const c = (e && e.code) || '';
  const M = {
    'auth/invalid-email': ['البريد الإلكتروني غير صحيح', 'Invalid email'],
    'auth/missing-password': ['اكتب كلمة المرور', 'Enter a password'],
    'auth/weak-password': ['كلمة المرور ضعيفة: ٦ أحرف على الأقل', 'Password must be at least 6 characters'],
    'auth/email-already-in-use': ['هذا البريد مسجل بالفعل، سجّل الدخول', 'Email already registered — sign in'],
    'auth/invalid-credential': ['البريد أو كلمة المرور غير صحيحة', 'Wrong email or password'],
    'auth/user-not-found': ['لا يوجد حساب بهذا البريد', 'No account with this email'],
    'auth/wrong-password': ['كلمة المرور غير صحيحة', 'Wrong password'],
    'auth/network-request-failed': ['لا يوجد اتصال بالإنترنت', 'No internet connection'],
    'auth/too-many-requests': ['محاولات كثيرة، حاول بعد قليل', 'Too many attempts, try later'],
    'invite/not-found': ['الكود غير صحيح', 'Invalid code'],
    'permission-denied': ['غير مسموح: تأكد من الكود', 'Not allowed — check the code']
  };
  return (M[c] || ['حدث خطأ، حاول مرة أخرى', 'Something went wrong, try again'])[ar ? 0 : 1];
}
