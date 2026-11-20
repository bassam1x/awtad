import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_FILE = path.join(os.tmpdir(), `awtad-url-${Date.now()}.db`);
const { cleanUrl, db } = await import('../src/db.js');

test('تنظيف رابط Neon: حذف channel_binding والإبقاء على sslmode وكلمة المرور المرمّزة', async () => {
  const u = cleanUrl('postgresql://neondb_owner:p%40ss@ep-x-pooler.c-4.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  assert.equal(u, 'postgresql://neondb_owner:p%40ss@ep-x-pooler.c-4.us-west-2.aws.neon.tech/neondb?sslmode=require');
  assert.equal(cleanUrl('not a url'), 'not a url');
  await db.close();
});