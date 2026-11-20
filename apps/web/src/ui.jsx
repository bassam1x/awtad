import { Link, useLocation } from 'react-router-dom';
import { locale, t } from './i18n/index.js';
import { prefetch } from './context.jsx';
import { routeIcon } from './routeIcons.js';
import { tr, useTrVersion } from './translate.jsx';
import { useEffect, useState } from 'react';
import { Star, X, Upload, Clock, CheckCircle2, XCircle, Loader2, Inbox, AlertCircle } from 'lucide-react';

export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
export const SPECS = ['برمجة', 'تصميم', 'هندسة'];
export const dateAr = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

/* ---------- Brand ---------- */
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#0EA5A4" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="url(#mg)" />
      <rect className="logo-bar b1" x="13" y="38" width="9" height="13" rx="4.5" fill="#fff" opacity=".7" />
      <rect className="logo-bar b2" x="27.5" y="28" width="9" height="23" rx="4.5" fill="#fff" opacity=".85" />
      <rect className="logo-bar b3" x="42" y="18" width="9" height="33" rx="4.5" fill="#fff" />
      <circle className="logo-dot" cx="46.5" cy="11" r="3.6" fill="#10B981" />
    </svg>
  );
}
export function Logo({ size = 36, text = true }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {text && <span className="font-bold tracking-tight" style={{ fontSize: size * 0.6 }}>{t('مهارة')}</span>}
    </span>
  );
}

/* ---------- Basic ---------- */
const COLORS = ['#2563EB', '#0EA5A4', '#7C3AED', '#D97706', '#DB2777', '#059669', '#475569'];
const colorOf = (id) => COLORS[Math.abs(Number(id) || 0) % COLORS.length];
export function Avatar({ u, size = 40, square }) {
  useTrVersion();
  if (!u) return null;
  const name = u.name || u.company_name || u.student_name || t('؟');
  const initial = (square ? tr(name) : name).trim()[0];
  const img = u.avatar || u.company_avatar || u.student_avatar || u.other_avatar;
  const r = square ? Math.round(size * 0.24) : size / 2;
  if (img) return <img src={img} alt={name} width={size} height={size} className="shrink-0 border border-line object-cover" style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <div aria-label={name} className="shrink-0 flex items-center justify-center font-bold text-white" style={{ width: size, height: size, borderRadius: r, background: colorOf(u.id || u.company_id || u.other_id), fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}
export function Stars({ v, onChange, size = 16 }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-500" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} onClick={onChange ? () => onChange(i) : undefined} className={onChange ? 'cursor-pointer' : ''} style={{ opacity: i <= Math.round(v) ? 1 : 0.28 }}>
          <Star size={size} fill="currentColor" />
        </span>
      ))}
    </span>
  );
}
export function StatusChip({ status }) {
  if (status === 'pending') return <span className="chip chip-w"><Clock size={13} />{t('قيد المراجعة')}</span>;
  if (status === 'accepted') return <span className="chip chip-g"><CheckCircle2 size={13} />{t('مقبول')}</span>;
  if (status === 'rejected') return <span className="chip chip-r"><XCircle size={13} />{t('مرفوض')}</span>;
  return null;
}
export function Spinner() {
  return (
    <div role="status" aria-busy="true" aria-label={t('جارٍ التحميل…')} className="page-in">
      <div className="mb-6 flex items-center gap-3"><div className="sk h-12 w-12" /><div className="grid gap-2"><div className="sk h-5 w-48" /><div className="sk h-3 w-72 max-w-[60vw]" /></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk h-36" />)}</div>
    </div>
  );
}
export function Empty({ children }) {
  return (
    <div className="card no-lift p-10 text-center text-mute">
      <span className="gicon gicon-lg gicon-float gicon-v mx-auto mb-3"><Inbox size={24} /></span>
      <div>{children}</div>
    </div>
  );
}
export function ErrorBox({ children }) {
  return (
    <div role="alert" className="card no-lift p-6 text-center text-bad">
      <span className="gicon gicon-lg gicon-r mx-auto mb-3"><AlertCircle size={24} /></span>
      <div>{children}</div>
    </div>
  );
}
export function PageHeader({ title, sub, children }) {
  const [Icon, tone] = routeIcon(useLocation().pathname);
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`gicon gicon-lg page-head-icon ${tone}`}><Icon size={24} /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          {sub && <p className="mt-1 text-mute">{sub}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
/** عدّاد يرتفع من الصفر إلى القيمة عند الظهور */
export function CountUp({ v }) {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
  const [x, setX] = useState(0);
  useEffect(() => {
    if (n === null) return undefined;
    let raf; const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 900); setX(n * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  if (n === null) return v;
  const d = Number.isInteger(n) ? 0 : 1;
  return Number(x.toFixed(d)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
/** تبويب مُنزلق للتنقل بين قسمين (مثل الوظائف ⇄ المشاريع) مع تحميل مسبق عند المرور بالمؤشر */
export function SegTabs({ items, active }) {
  const i = Math.max(0, items.findIndex((x) => x.to === active));
  return (
    <nav className="seg no-lift" data-i={i} aria-label={t('التبديل بين الأقسام')}>
      {items.map(({ to, label, icon: I, pre }) => (
        <Link key={to} to={to} replace aria-current={to === active ? 'page' : undefined} onMouseEnter={() => prefetch(pre)} onFocus={() => prefetch(pre)}>
          <I size={17} />{label}
        </Link>
      ))}
    </nav>
  );
}
export function StatCard({ icon: I, label, value, tone = 'b', hint }) {
  const t = { b: '', g: 'gicon-g', w: 'gicon-w', r: 'gicon-r' }[tone];
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`gicon gicon-live ${t}`}><I size={20} /></span>
      <div className="min-w-0"><div className="text-2xl font-bold leading-tight"><CountUp v={value} /></div><div className="text-sm text-mute">{label}</div>{hint}</div>
    </div>
  );
}
export function Field({ label, children, hint }) {
  return <div className="mb-3"><label className="lbl">{label}</label>{children}{hint && <div className="mt-1 text-xs text-mute">{hint}</div>}</div>;
}
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`card modal-in w-full p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn btn-sm" onClick={onClose} aria-label={t('إغلاق')} data-tip={t('إغلاق')}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- image upload (resized client-side) ---------- */
export function fileToAvatar(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error(t('اختر ملف صورة')));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error(t('تعذّر قراءة الصورة')));
    img.src = url;
  });
}
export function AvatarUpload({ value, onChange, label = t('رفع صورة'), name = t('؟'), square }) {
  const pick = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { onChange(await fileToAvatar(f)); } catch { /* ignored */ }
    e.target.value = '';
  };
  return (
    <div className="flex items-center gap-3">
      <Avatar u={{ id: 1, name, avatar: value }} size={64} square={square} />
      <label className="btn cursor-pointer"><Upload size={16} />{label}<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {value && <button type="button" className="btn btn-d btn-sm" onClick={() => onChange(null)}>إزالة</button>}
    </div>
  );
}

/* ---------- posting helpers ---------- */
export const postingChips = (p) => (p.kind === 'job' ? [t(p.type), t(p.shift), t('{n} ساعات يومياً', { n: p.hours })] : [t('مشروع تعاوني'), t('{n} أيام للتسليم', { n: p.days })]);

/* ---------- dashboard pieces ---------- */
export function Banner({ title, sub, children }) {
  return (
    <div className="banner-anim mb-6 rounded-2xl p-6 text-white shadow-card sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 max-w-xl text-white/85">{sub}</p>}
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function BarList({ title, rows, color = 'bg-brand' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm"><span>{r.label}</span><b>{r.value}</b></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-app"><div className={`h-full rounded-full ${r.color || color}`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </div>
        ))}
        {!rows.length && <span className="text-sm text-mute">{t('لا بيانات بعد.')}</span>}
      </div>
    </div>
  );
}
