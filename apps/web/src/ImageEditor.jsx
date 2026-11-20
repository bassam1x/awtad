import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Check, RefreshCw } from 'lucide-react';
import { t } from './i18n/index.js';
import { Modal } from './ui.jsx';

/* محرّر الصورة: قصّ وتحريك وتكبير وتدوير واختيار الحجم النهائي، ثم يُرجع الصورة جاهزة للحفظ في الحساب. */
const V = 280;                       // حجم منطقة المعاينة بالبكسل
const MAX_SRC = 1600;                // أكبر ضلع للصورة المصدر أثناء التحرير (لتوفير الذاكرة)
const SIZES = [128, 256, 512];       // الأحجام النهائية الممكنة (بكسل)
const MAX_CHARS = 650000;            // حدّ الخادم 700000 حرف
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t('تعذّر قراءة الصورة')));
    img.src = url;
  });
}

/** يرسم الصورة (بعد التصغير والتدوير) على Canvas مصدر */
function makeSource(img, rot) {
  const k = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * k)), sh = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = rot % 2 ? sh : sw; c.height = rot % 2 ? sw : sh;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 2);
  g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return c;
}

export default function ImageEditor({ source, square, onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [failed, setFailed] = useState(false);
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(256);
  const view = useRef(null), canvas = useRef(null), prev = useRef(null), drag = useRef(null);

  useEffect(() => {
    let url = null, dead = false;
    const href = typeof source === 'string' ? source : (url = URL.createObjectURL(source));
    loadImage(href).then((i) => { if (!dead) setImg(i); }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [source]);

  const src = useMemo(() => (img ? makeSource(img, rot) : null), [img, rot]);

  /** أبعاد الصورة المعروضة بحسب التكبير، وحدود التحريك حتى لا يظهر فراغ */
  const geo = useCallback((z) => {
    if (!src) return { dw: V, dh: V, mx: 0, my: 0 };
    const s = Math.max(V / src.width, V / src.height) * z;
    const dw = src.width * s, dh = src.height * s;
    return { dw, dh, mx: Math.max(0, (dw - V) / 2), my: Math.max(0, (dh - V) / 2) };
  }, [src]);
  const fit = useCallback((o, z) => { const g = geo(z); return { x: clamp(o.x, -g.mx, g.mx), y: clamp(o.y, -g.my, g.my) }; }, [geo]);

  useEffect(() => { setOff({ x: 0, y: 0 }); }, [rot]);
  useEffect(() => { setOff((o) => fit(o, zoom)); }, [zoom, fit]);

  /** رسم المعاينة الكبيرة والصغيرة */
  useEffect(() => {
    if (!src) return;
    const g = geo(zoom);
    const paint = (cv, px) => {
      if (!cv) return;
      const dpr = px === V ? Math.min(2, window.devicePixelRatio || 1) : 2;
      cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr);
      const ctx = cv.getContext('2d'); const f = (px / V) * dpr;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, (V / 2 + off.x - g.dw / 2) * f, (V / 2 + off.y - g.dh / 2) * f, g.dw * f, g.dh * f);
    };
    paint(canvas.current, V); paint(prev.current, 64);
  }, [src, zoom, off, geo]);

  /** عجلة الماوس للتكبير (غير passive لمنع تمرير الصفحة) */
  useEffect(() => {
    const el = view.current; if (!el) return undefined;
    const f = (e) => { e.preventDefault(); setZoom((z) => clamp(Math.round(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08) * 100) / 100, 1, 4)); };
    el.addEventListener('wheel', f, { passive: false });
    return () => el.removeEventListener('wheel', f);
  }, [src]);

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, o: off }; };
  const move = (e) => { const d = drag.current; if (d) setOff(fit({ x: d.o.x + e.clientX - d.x, y: d.o.y + e.clientY - d.y }, zoom)); };
  const up = () => { drag.current = null; };
  const key = (e) => {
    const st = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (st) { e.preventDefault(); setOff((o) => fit({ x: o.x + st[0], y: o.y + st[1] }, zoom)); }
    else if (e.key === '+' || e.key === '=') setZoom((z) => clamp(Math.round((z + 0.1) * 100) / 100, 1, 4));
    else if (e.key === '-') setZoom((z) => clamp(Math.round((z - 0.1) * 100) / 100, 1, 4));
  };
  const reset = () => { setRot(0); setZoom(1); setOff({ x: 0, y: 0 }); };

  const apply = () => {
    if (!src) return;
    const g = geo(zoom), f = size / V;
    const out = document.createElement('canvas'); out.width = size; out.height = size;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (V / 2 + off.x - g.dw / 2) * f, (V / 2 + off.y - g.dh / 2) * f, g.dw * f, g.dh * f);
    let q = 0.9, data = out.toDataURL('image/jpeg', q);
    while (data.length > MAX_CHARS && q > 0.4) { q -= 0.1; data = out.toDataURL('image/jpeg', q); }
    onDone(data);
  };

  const mask = { borderRadius: square ? 20 : '50%', boxShadow: '0 0 0 400px rgb(2 6 23 / .58)', border: '2px solid rgb(255 255 255 / .9)' };

  return (
    <Modal title={t('تعديل الصورة')} onClose={onCancel}>
      {failed && <p className="mb-3 rounded-xl bg-badsoft p-3 text-sm text-bad">{t('تعذّر قراءة الصورة')}</p>}
      <div className="grid place-items-center">
        <div
          ref={view} tabIndex={0} role="group" aria-label={t('منطقة قصّ الصورة')}
          className="relative touch-none select-none overflow-hidden rounded-2xl bg-slate-900/80 outline-none ring-1 ring-white/20 focus-visible:ring-2 focus-visible:ring-brand"
          style={{ width: V, height: V, cursor: drag.current ? 'grabbing' : 'grab', maxWidth: '100%' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
        >
          <canvas ref={canvas} style={{ width: V, height: V, display: 'block' }} />
          <div className="pointer-events-none absolute inset-0" style={mask} />
        </div>
        <p className="mt-2 text-center text-xs text-mute">{t('اسحب الصورة لتحريكها، وكبّرها بالمقبض أو بعجلة الماوس.')}</p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className="ibtn" onClick={() => setZoom((z) => clamp(Math.round((z - 0.2) * 100) / 100, 1, 4))} aria-label={t('تصغير')} data-tip={t('تصغير')}><ZoomOut size={18} /></button>
          <input type="range" className="flex-1" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t('التكبير')} />
          <button type="button" className="ibtn" onClick={() => setZoom((z) => clamp(Math.round((z + 0.2) * 100) / 100, 1, 4))} aria-label={t('تكبير')} data-tip={t('تكبير')}><ZoomIn size={18} /></button>
          <span className="w-12 text-end text-sm font-semibold tabular-nums" dir="ltr">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setRot((r) => (r + 3) % 4)}><RotateCcw size={15} />{t('تدوير لليسار')}</button>
          <button type="button" className="btn btn-sm" onClick={() => setRot((r) => (r + 1) % 4)}><RotateCw size={15} />{t('تدوير لليمين')}</button>
          <button type="button" className="btn btn-sm" onClick={reset}><RefreshCw size={15} />{t('إعادة الضبط')}</button>
        </div>

        <div>
          <div className="lbl">{t('الحجم النهائي')}</div>
          <div className="flex flex-wrap items-center gap-2">
            {SIZES.map((s) => (
              <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} className={`btn btn-sm ${size === s ? 'btn-p' : ''}`}>
                <span dir="ltr">{s} × {s}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 text-xs text-mute">{t('الحجم الأكبر أوضح لكنه أثقل.')}</div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line/70 p-3">
          <canvas ref={prev} style={{ width: 64, height: 64, borderRadius: square ? 14 : '50%' }} />
          <div className="text-sm text-mute">{t('هكذا ستظهر صورتك للآخرين.')}</div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>{t('إلغاء')}</button>
        <button type="button" className="btn btn-p" onClick={apply} disabled={!src}><Check size={16} />{t('تطبيق')}</button>
      </div>
    </Modal>
  );
}
