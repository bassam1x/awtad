import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

/* مُرسِل Gmail عبر Apps Script: الطلب الصحيح، ومعالجة الأخطاء (بلا شبكة) */
process.env.MAIL_SCRIPT_URL = 'https://script.google.com/macros/s/TEST/exec';
process.env.MAIL_SCRIPT_SECRET = 'relay-secret';
process.env.BREVO_API_KEY = ''; process.env.MAIL_FROM = '';
const { sendMail, mailEnabled } = await import('../src/mailer.js');

const realFetch = globalThis.fetch; const calls = [];
before(() => { globalThis.fetch = async (url, opt) => { calls.push({ url, opt }); return globalThis.__next(url, opt); }; });
after(() => { globalThis.fetch = realFetch; });
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('Gmail relay: مفعّل بالرابط والسرّ، ويرسل JSON فيه السرّ والمستلم', async () => {
  assert.equal(mailEnabled(), true);
  globalThis.__next = async () => reply(200, { ok: true });
  assert.equal(await sendMail({ to: 'a@b.co', subject: 'S', text: 'T', html: '<p>H</p>' }), true);
  const { url, opt } = calls.at(-1);
  assert.equal(url, 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(opt.method, 'POST'); assert.equal(opt.redirect, 'follow');
  const b = JSON.parse(opt.body);
  assert.equal(b.secret, 'relay-secret'); assert.equal(b.to, 'a@b.co'); assert.equal(b.subject, 'S'); assert.equal(b.html, '<p>H</p>');
});

test('Gmail relay: رد {ok:false} أو غير JSON أو خطأ HTTP يرمي خطأً واضحاً', async () => {
  globalThis.__next = async () => reply(200, { ok: false, error: 'unauthorized' });
  await assert.rejects(sendMail({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /unauthorized/);
  globalThis.__next = async () => ({ ok: true, status: 200, json: async () => { throw new Error('html page'); } });
  await assert.rejects(sendMail({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /Gmail relay/);
  globalThis.__next = async () => reply(500, null);
  await assert.rejects(sendMail({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /Gmail relay 500/);
});
