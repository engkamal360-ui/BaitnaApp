// Gemini via Firebase AI Logic (free "Gemini Developer API"). Used to read receipts and to understand dictated shopping lists.
// PRIVACY: this module must never receive anything from the Cards section (numbers, IBANs, photos). Only receipts, product names, dictated text and family first names are sent.
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { fbApp, enabled } from './sync.js';
import CONFIG from './firebase-config.js';

export const aiAvailable = enabled;
const MODELS = [CONFIG.aiModel, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].filter(Boolean);
let workingModel = null;

async function run(parts) {
  if (!enabled) throw new Error('ai-off');
  const ai = getAI(fbApp, { backend: new GoogleAIBackend() });
  let lastErr = null;
  for (const name of (workingModel ? [workingModel] : MODELS)) {
    try {
      const model = getGenerativeModel(ai, { model: name, generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } });
      const res = await model.generateContent(parts);
      workingModel = name;
      const txt = res.response.text().replace(/^```(json)?|```$/g, '').trim();
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      if (!/not found|404|unsupported|is not available|deprecated/i.test(m)) break; // only fall through when the model name is the problem
    }
  }
  throw lastErr;
}

const UNITS = 'kg, g, bag, pack, box, bottle, tray, loaf, piece, l';
const CATS = 'super (supermarket/groceries), veg (fruit & vegetables), meat (butcher & poultry), fish, spice (spice shop), pharm (pharmacy), clean (cleaning)';

export async function readReceipt(dataUrl, knownNames) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const prompt = `You read Egyptian/Arabic or English shop receipts. Extract every purchased line item.
Return JSON: {"store": string|null, "date": "YYYY-MM-DD"|null, "items": [{"name": short Arabic product name, "qty": number|null, "unit": one of [${UNITS}]|null, "price": total paid for that line as a number, "cat": one of [${CATS}]}], "total": number|null}.
Use the line total (after discounts) as price. Skip taxes, bags fees and totals as items. Prefer these existing product names when they match: ${knownNames.slice(0, 80).join('، ')}.`;
  return run([prompt, { inlineData: { data: b64, mimeType: mime } }]);
}

export async function parseList(text, knownNames) {
  const prompt = `The user dictated (Egyptian Arabic or English) a list of things to buy. Split it into items.
Return JSON: {"items": [{"name": short Arabic product name, "qty": number|null, "unit": one of [${UNITS}]|null, "cat": one of [${CATS}], "note": extra detail like brand or size or null}]}.
"نص"=0.5, "ربع"=0.25, "كيلو ونص"=1.5. Prefer these existing product names when they match: ${knownNames.slice(0, 80).join('، ')}.
Text: """${text}"""`;
  return run([prompt]);
}

// One spoken/typed sentence → a list of actions across the whole app (shopping, appointments, medicines, medical record, kitchen timers).
export async function parseCommand(text, ctx) {
  const prompt = `You are the assistant of a family organizer app. The user spoke (Egyptian Arabic or English). Turn what they said into actions.
Today is ${ctx.today} (${ctx.weekday}). Family members (id: name): ${ctx.people.map((p) => p.id + ': ' + p.name).join(' | ')}. The speaker's id is "${ctx.me}".
Return JSON: {"actions": [ ... ]} where each action is ONE of:
- {"type":"shop","name": short Arabic product name,"qty":number|null,"unit": one of [${UNITS}]|null,"cat": one of [${CATS}],"note":string|null}
- {"type":"appt","title": short Arabic title like "كشف عند د. أحمد (أسنان)","date":"YYYY-MM-DD"|null,"time":"HH:MM" 24h|null,"cat":"appt"|"vax"|"bill","who": member id|null,"note":string|null}
- {"type":"med","name":string,"dose":string|null,"times":["HH:MM",...],"who": member id|null}
- {"type":"rec","kind":"visit"|"lab"|"img","title":string,"date":"YYYY-MM-DD"|null,"result":string|null,"who": member id|null}  (only for things that ALREADY happened, e.g. test results)
- {"type":"timer","name":string,"minutes":number}
- {"type":"exp","name": short Arabic label like "إيجار الشقة","amount":number,"ecat": one of [rent, elec, water, gas, net, school, car, health, inst, other],"date":"YYYY-MM-DD"|null,"who": member id|null}  (money ALREADY paid for non-grocery things: rent, bills, school fees, fuel, subscriptions)
Rules: resolve relative dates (بكرة/غداً = tomorrow, بعد بكرة, يوم الخميس = the next Thursday, الأسبوع الجاي...) to real dates. "الساعة ٥" with no AM/PM for a doctor or outing means 17:00 unless "الصبح/صباحاً". "بالليل"/"مساءً" = PM. Bills and renewals use cat "bill"; vaccinations use "vax". Medicine "كل ٨ ساعات" → three times starting 08:00; "مرتين" → 09:00 and 21:00; "مرة" → 09:00. A doctor booking in the future is "appt", not "rec". Use "who" only when a member is named or clearly implied (ابني/مراتي/أنا). Several things in one sentence → several actions.
Prefer these existing product names when they match: ${ctx.knownNames.slice(0, 60).join('، ')}.
Text: """${text}"""`;
  return run([prompt]);
}

// Read a car odometer photo → { km }
export async function readOdometer(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const prompt = `This is a photo of a car dashboard. Read the ODOMETER (total distance, usually the longest number, often labelled ODO). Ignore the trip meter (TRIP A/B), speed, RPM, fuel, clock and temperature.
Return JSON: {"km": number|null, "unit": "km"|"mi"|null, "confidence": "high"|"low"}. Use null if you cannot read it clearly.`;
  return run([prompt, { inlineData: { data: b64, mimeType: mime } }]);
}
