import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db, setWriteHook } from './db.js';
import { makeStore, pack } from './backup-store.js';

/* جدولة حفظ لقطات القاعدة: بعد أي كتابة ننتظر لحظات (لتجميع الكتابات) ثم نرفع لقطة واحدة.
   عند الفشل نعيد المحاولة، وعند إيقاف الخدمة (SIGTERM) نرفع آخر لقطة قبل الإغلاق. */
const DEBOUNCE = Number(process.env.BACKUP_DEBOUNCE_MS) || 8000;
const RETRY = 30000;

let made = null, dirty = false, timer = null, running = null, lastOk = 0, lastError = null;

/** لقطة متسقة من القاعدة (تشمل محتوى WAL) كملف ثنائي */
export function snapshot() {
  const tmp = path.join(os.tmpdir(), `awtad-${process.pid}-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  try { return fs.readFileSync(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

async function runOnce() {
  timer = null;
  if (!dirty) return;
  dirty = false;
  running = (async () => {
    try { await made.store.put(pack(snapshot(), made.secret)); lastOk = Date.now(); lastError = null; }
    catch (e) { lastError = e.message; dirty = true; console.error('فشل حفظ النسخة الاحتياطية:', e.message); }
  })();
  await running;
  running = null;
  if (dirty && !timer) timer = setTimeout(runOnce, lastError ? RETRY : DEBOUNCE);
}

export function markDirty() {
  if (!made) return;
  dirty = true;
  if (!timer && !running) timer = setTimeout(runOnce, DEBOUNCE);
}

/** يرفع أي تغييرات معلّقة فوراً (عند الإغلاق أو بطلب يدوي) */
export async function flush() {
  if (!made) return;
  if (timer) { clearTimeout(timer); timer = null; }
  if (running) await running;
  if (dirty) await runOnce();
}

export function startBackups() {
  made = makeStore();
  if (!made) {
    console.log('الحفظ الخارجي غير مفعّل: على الخدمة المجانية تُفقد البيانات عند إعادة التشغيل. فعّله بـ BACKUP_GITHUB_REPO و BACKUP_GITHUB_TOKEN.');
    return false;
  }
  setWriteHook(markDirty);
  markDirty(); // لقطة أولى بعد الإقلاع
  console.log(`الحفظ الخارجي مفعّل (${made.store.kind}).`);
  return true;
}

export const backupStatus = () => ({ enabled: !!made, lastOkAt: lastOk ? new Date(lastOk).toISOString() : null, failing: !!lastError });
