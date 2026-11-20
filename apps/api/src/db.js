import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { MIGRATE, SCHEMA } from './schema.js';

/* طبقة قاعدة البيانات: PostgreSQL.
   - الإنتاج: DATABASE_URL (مثلاً Neon) عبر مكتبة pg.
   - التطوير والاختبارات: PGlite (PostgreSQL حقيقي داخل العملية، يُحفظ في ملفات محلية) بلا أي إعداد.
   الواجهة غير متزامنة: all/get/run/tx، وتكتب الاستعلامات بعلامات «؟» فتُحوَّل إلى $1,$2... */

const als = new AsyncLocalStorage();
const ID_TABLES = new Set(['users', 'skills', 'portfolio', 'postings', 'applications', 'messages', 'works', 'wallet_tx', 'invites']);
/* مدخلات غير صالحة لنوع العمود (مثل رقم تعريف غير رقمي في الرابط): نعاملها «لا نتيجة» كما كان سلوك SQLite، لا خطأ 500 */
const SOFT_ERRORS = new Set(['22P02', '22003', '22001']);

/** يحوّل علامات ? إلى $1,$2... خارج النصوص المقتبسة */
export function toPg(sql) {
  let n = 0, out = '', quote = null;
  for (const ch of sql) {
    if (quote) { out += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    out += ch === '?' ? `$${++n}` : ch;
  }
  return out;
}

/** Neon يعرض الرابط مع channel_binding=require وهو غير مدعوم عبر الـ pooler؛ نحذفه ونُبقي sslmode */
export function cleanUrl(u) {
  try { const x = new URL(u); x.searchParams.delete('channel_binding'); return x.toString(); } catch { return u; }
}

async function open() {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg');
    pg.types.setTypeParser(20, (v) => parseInt(v, 10));   // bigint (COUNT/SUM) كأرقام
    pg.types.setTypeParser(1700, (v) => parseFloat(v));   // numeric
    const pool = new pg.Pool({ connectionString: cleanUrl(config.databaseUrl), max: Number(process.env.PG_POOL_MAX) || 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 });
    pool.on('error', (e) => console.error('خطأ في اتصال قاعدة البيانات:', e.message));
    return {
      kind: 'postgres',
      query: (client, text, params) => (client || pool).query(text, params),
      exec: (text) => pool.query(text),
      async transaction(fn) {
        const c = await pool.connect();
        try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
        catch (e) { try { await c.query('ROLLBACK'); } catch { /* الاتصال قد يكون مقطوعاً */ } throw e; }
        finally { c.release(); }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = config.pgliteDir;
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const pl = new PGlite(dir, { parsers: { 20: (v) => parseInt(v, 10), 1700: (v) => parseFloat(v) } });
  await pl.waitReady;
  return {
    kind: 'pglite',
    query: (client, text, params) => (client || pl).query(text, params),
    exec: (text) => pl.exec(text),
    transaction: (fn) => pl.transaction(fn),
    close: () => pl.close(),
  };
}

const backend = await open();
await backend.exec(SCHEMA);
await backend.exec(MIGRATE);

export const db = { kind: backend.kind, exec: (sql) => backend.exec(sql), close: () => backend.close() };

async function q(sql, params) {
  let text = toPg(sql);
  const ins = /^\s*insert\s+into\s+([a-z_]+)/i.exec(text);
  if (ins && ID_TABLES.has(ins[1].toLowerCase()) && !/\breturning\b/i.test(text)) text += ' RETURNING id';
  const ctx = als.getStore();
  try {
    return await backend.query(ctx?.client, text, params.map((p) => (p === undefined ? null : p)));
  } catch (e) {
    if (!ctx && SOFT_ERRORS.has(e.code)) return { rows: [], rowCount: 0 };
    throw e;
  }
}

export const all = async (sql, ...p) => (await q(sql, p)).rows;
export const get = async (sql, ...p) => (await q(sql, p)).rows[0];
/** ينفّذ أمر كتابة. lastInsertRowid متوفر لـ INSERT على الجداول ذات id */
export const run = async (sql, ...p) => {
  const r = await q(sql, p);
  return { changes: r.rowCount ?? r.affectedRows ?? 0, lastInsertRowid: r.rows?.[0]?.id };
};
export const tx = (fn) => (als.getStore() ? fn() : backend.transaction((client) => als.run({ client }, fn)));
