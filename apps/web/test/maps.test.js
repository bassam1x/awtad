import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapKind, mapLinks } from '../src/maps.js';

test('نوع الرابط: Waze وGoogle وغيرهما وفارغ', () => {
  assert.equal(mapKind('https://waze.com/ul?ll=33.31,44.36&navigate=yes'), 'waze');
  assert.equal(mapKind('https://ul.waze.com/ul?ll=1,2'), 'waze');
  assert.equal(mapKind('https://www.google.com/maps/place/x/@33.3,44.4,15z'), 'google');
  assert.equal(mapKind('https://maps.app.goo.gl/AbCd123'), 'google');
  assert.equal(mapKind('https://goo.gl/maps/xyz'), 'google');
  assert.equal(mapKind('https://evil-waze.com.attacker.io/ul'), 'other');   // لا يُخدع بالنطاق المشابه
  assert.equal(mapKind('https://example.com/place'), 'other');
  assert.equal(mapKind('not a url'), 'other');
  assert.equal(mapKind(''), '');
});

test('رابط Waze: يُستخدم كما هو، ويُبنى Google من إحداثياته', () => {
  const l = mapLinks('https://waze.com/ul?ll=33.3152,44.3661&navigate=yes', 'بغداد');
  assert.equal(l.waze, 'https://waze.com/ul?ll=33.3152,44.3661&navigate=yes');
  assert.equal(l.google, 'https://www.google.com/maps/search/?api=1&query=33.3152,44.3661');
  assert.equal(l.other, '');
});

test('رابط Google بإحداثيات: يُبنى Waze منها', () => {
  const l = mapLinks('https://www.google.com/maps/place/Baghdad/@33.3152,44.3661,15z/data=!3d33.3152!4d44.3661', '');
  assert.equal(l.google.startsWith('https://www.google.com/maps/place/'), true);
  assert.equal(l.waze, 'https://waze.com/ul?ll=33.3152,44.3661&navigate=yes');
});

test('رابط مختصر بلا إحداثيات: Google يبقى، وWaze يُبنى من العنوان', () => {
  const l = mapLinks('https://maps.app.goo.gl/AbCd123', 'الكرادة، شارع 62، بغداد');
  assert.equal(l.google, 'https://maps.app.goo.gl/AbCd123');
  assert.equal(l.waze, `https://waze.com/ul?q=${encodeURIComponent('الكرادة، شارع 62، بغداد')}&navigate=yes`);
});

test('بلا رابط: الأزرار من العنوان فقط، وبلا عنوان لا شيء', () => {
  const l = mapLinks('', 'البصرة، العشار');
  assert.ok(l.google.includes('query=') && l.waze.includes('q='));
  const none = mapLinks('', '  ');
  assert.deepEqual([none.google, none.waze, none.other], ['', '', '']);
});

test('رابط غير معروف: يُفتح كما هو ويُبنى الباقي من العنوان، وترميز % التالف لا يكسر', () => {
  const l = mapLinks('https://example.com/my%place', 'أربيل');
  assert.equal(l.other, 'https://example.com/my%place');
  assert.ok(l.waze.includes('q='));
});
