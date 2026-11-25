import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleError, inAppBrowser } from '../src/google.js';

test('متصفحات التطبيقات المضمّنة تُكتشف، والمتصفحات العادية لا', () => {
  assert.ok(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0'));
  assert.ok(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130 Mobile Safari/537.36'));
  assert.ok(inAppBrowser('Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/480.0]'));
  assert.ok(!inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'));
  assert.ok(!inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'));
});

test('إلغاء المستخدم صامت، وباقي الأخطاء لها رسالة', () => {
  assert.equal(googleError('auth/popup-closed-by-user'), '');
  assert.equal(googleError('auth/cancelled-popup-request'), '');
  for (const code of ['auth/popup-blocked', 'auth/network-request-failed', 'auth/unauthorized-domain', undefined]) assert.ok(googleError(code).length > 0, String(code));
});
