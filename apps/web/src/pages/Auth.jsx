import { lang, t } from '../i18n/index.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Headset, ChevronDown, FlaskConical, GraduationCap, ArrowRight, ShieldCheck } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Tr } from '../translate.jsx';
import { AvatarUpload, Field, Logo, SPECS } from '../ui.jsx';
import { LangSwitch, ThemeButton } from '../Layout.jsx';

/* ---------- Google ---------- */
let gsiPromise;
function loadGsi() {
  if (!gsiPromise) {
    gsiPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => { gsiPromise = undefined; s.remove(); rej(new Error('gsi')); };   // نسمح بإعادة المحاولة بعد انقطاع
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}
export function GoogleButton({ onCredential }) {
  const [cid, setCid] = useState(null);
  const ref = useRef();
  const toast = useToast();
  useEffect(() => { api.get('/config').then((c) => setCid(c.googleClientId || '')).catch(() => setCid('')); }, []);
  // المعالج يتغيّر مع كل رسم (ويتبع نوع الحساب المختار)، فنحفظ أحدث نسخة منه ونرسم الزر مرة واحدة فقط
  const cb = useRef(onCredential);
  cb.current = onCredential;
  useEffect(() => {
    if (!cid) return undefined;
    let live = true;
    loadGsi().then(() => {
      if (!live || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: cid, callback: (r) => cb.current(r.credential), ux_mode: 'popup' });
      // عرض زر Google محدود بين 200 و400 بكسل
      const width = Math.min(400, Math.max(200, ref.current.offsetWidth || 320));
      ref.current.replaceChildren();
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'continue_with', locale: lang === 'en' ? 'en' : 'ar', width });
    }).catch(() => { if (live) toast(t('تعذّر تحميل خدمة Google'), 'err'); });
    return () => { live = false; };
  }, [cid, toast]);
  if (cid === null) return <div className="h-11" />;
  if (!cid) {
    return (
      <button type="button" className="btn w-full py-2.5" onClick={() => toast(t('تسجيل Google غير مفعّل بعد. يفعّله مدير المنصة من صفحة الإعدادات.'), 'err')}>
        <GoogleIcon />{t('المتابعة عبر Google')}
      </button>
    );
  }
  return <div ref={ref} className="flex min-h-[44px] w-full justify-center" />;
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
  );
}

/* ---------- LinkedIn (OpenID Connect) ---------- */
const LI_STATE = 'awtad-li-state', LI_ROLE = 'awtad-li-role';
function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2" /><path fill="#fff" d="M7.1 9.6H4.4V19h2.7V9.6zM5.75 5.2a1.57 1.57 0 1 0 0 3.14 1.57 1.57 0 0 0 0-3.14zM19.6 13.6c0-2.5-1.3-4.2-3.6-4.2-1.2 0-2 .6-2.4 1.2V9.6h-2.7V19h2.7v-5.1c0-1.1.5-1.9 1.6-1.9 1 0 1.5.8 1.5 1.9V19h2.9v-5.4z" /></svg>
  );
}
/** role اختياري: في صفحة التسجيل يُرسَل مع الطلب فيُنشأ الحساب مباشرة بنوعه المختار */
export function LinkedInButton({ role }) {
  const { data: cfg } = useFetch('/config');
  const toast = useToast();
  const start = () => {
    if (!cfg?.linkedinClientId) return toast(t('تسجيل الدخول عبر LinkedIn غير مفعّل بعد.'), 'err');
    const state = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
    try { sessionStorage.setItem(LI_STATE, state); if (role) sessionStorage.setItem(LI_ROLE, role); else sessionStorage.removeItem(LI_ROLE); } catch { /* التخزين محجوب */ }
    const q = new URLSearchParams({ response_type: 'code', client_id: cfg.linkedinClientId, redirect_uri: cfg.linkedinRedirect, state, scope: 'openid profile email' });
    location.href = `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  };
  return <button type="button" className="btn mt-2 w-full py-2.5" onClick={start} disabled={!cfg}><LinkedInIcon />{t('المتابعة عبر LinkedIn')}</button>;
}

/** صفحة العودة من LinkedIn: تتحقق من state ثم تُدخل المستخدم، أو تسأله عن نوع الحساب إن كان جديداً */
export function LinkedInCallback() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [pending, setPending] = useState(null);
  const ran = useRef(false);
  const fail = (msg) => { toast(msg, 'err'); nav('/login', { replace: true }); };
  const done = (s) => { login(s); nav('/app', { replace: true }); };
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const q = new URLSearchParams(location.search);
    let saved = null, role = null;
    try { saved = sessionStorage.getItem(LI_STATE); role = sessionStorage.getItem(LI_ROLE); sessionStorage.removeItem(LI_STATE); sessionStorage.removeItem(LI_ROLE); } catch { /* تجاهل */ }
    if (q.get('error')) return fail(t('أُلغي تسجيل الدخول عبر LinkedIn.'));
    if (!q.get('code') || !saved || q.get('state') !== saved) return fail(t('تعذّر التحقق من طلب LinkedIn، أعد المحاولة.'));
    api.post('/auth/linkedin', { code: q.get('code'), ...(role ? { role } : {}) })
      .then((r) => (r.needsRole ? setPending(r) : done(r)))
      .catch((e) => fail(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (role) => { try { done(await api.post('/auth/linkedin', { ticket: pending.ticket, role })); } catch (e) { fail(e.message); } };
  return (
    <Shell title={t('تسجيل الدخول عبر LinkedIn')} sub={pending ? `${t('أهلاً')} ${pending.name}${t('، اختر نوع حسابك لإكمال التسجيل:')}` : t('جارٍ التحقق من حسابك…')} back={false}>
      {pending ? (
        <div className="grid gap-2">
          <button className="btn btn-p py-3" onClick={() => choose('student')}><GraduationCap size={18} />{t('أنا طالب / خريج / مبرمج')}</button>
          <button className="btn py-3" onClick={() => choose('company')}><Building2 size={18} />{t('أنا صاحب شركة / عمل')}</button>
        </div>
      ) : <div className="splash-bar mx-auto" aria-hidden="true"><span /></div>}
    </Shell>
  );
}

/* ---------- Login form (used on Welcome and /login) ---------- */
export function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [pendingGoogle, setPendingGoogle] = useState(null);
  // على الموبايل تُطوى قائمة الحسابات التجريبية حتى لا تدفن رابط إنشاء الحساب تحتها
  const [demoOpen, setDemoOpen] = useState(() => { try { return matchMedia('(min-width: 640px)').matches; } catch { return true; } });
  const { data: cfg } = useFetch('/config');
  const demo = cfg?.demo || [];
  const go = (s) => { login(s); nav('/app'); };
  const submit = async (e, creds = f) => {
    e?.preventDefault();
    setBusy(true);
    try { go(await api.post('/auth/login', creds)); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  const google = async (credential, role) => {
    try {
      const r = await api.post('/auth/google', { credential, role });
      if (r.needsRole) return setPendingGoogle({ credential, name: r.name });
      go(r);
    } catch (err) { toast(err.message, 'err'); }
  };
  if (pendingGoogle) {
    return (
      <div>
        <p className="mb-3">{t('أهلاً')} {pendingGoogle.name}{t('، اختر نوع حسابك لإكمال التسجيل:')}</p>
        <div className="grid gap-2">
          <button className="btn btn-p py-3" onClick={() => google(pendingGoogle.credential, 'student')}><GraduationCap size={18} />{t('أنا طالب / خريج / مبرمج')}</button>
          <button className="btn py-3" onClick={() => google(pendingGoogle.credential, 'company')}><Building2 size={18} />{t('أنا صاحب شركة / عمل')}</button>
          <button className="btn btn-sm" onClick={() => setPendingGoogle(null)}>{t('رجوع')}</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <form onSubmit={submit}>
        <Field label={t('البريد الإلكتروني')}><input id="login-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" dir="ltr" className="inp text-left" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label={t('كلمة المرور')}><input id="login-pass" type="password" autoComplete="current-password" enterKeyHint="go" dir="ltr" className="inp text-left" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <button className="btn btn-p w-full py-2.5" disabled={busy}>{busy ? t('جارٍ الدخول…') : t('تسجيل الدخول')}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />{t('أو')}<span className="h-px flex-1 bg-line" /></div>
      <GoogleButton onCredential={(c) => google(c)} />
      <LinkedInButton />
      {demo.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" aria-expanded={demoOpen} onClick={() => setDemoOpen((o) => !o)} className="flex min-h-[40px] w-full items-center gap-1.5 text-xs font-bold text-mute">
            <FlaskConical size={13} />{t('جرّب بحساب تجريبي بنقرة واحدة')}
            <span className="ms-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-brand" style={{ background: 'rgb(var(--brand) / .12)' }}>{demo.length}<ChevronDown size={14} className={`transition-transform ${demoOpen ? 'rotate-180' : ''}`} /></span>
          </button>
          {demoOpen && <div className="mt-1 grid gap-1 sm:max-h-56 sm:overflow-y-auto sm:pe-1">
            {demo.map((d) => {
              const I = d.role === 'admin' ? ShieldCheck : d.role === 'company' ? Building2 : GraduationCap;
              return (
                <button key={d.email} type="button" className="switcher-item" disabled={busy} onClick={() => submit(null, { email: d.email, password: d.password })}>
                  <span className={`gicon gicon-sm ${d.role === 'admin' ? 'gicon-v' : d.role === 'company' ? 'gicon-w' : 'gicon-c'}`}><I size={16} /></span>
                  <span className="min-w-0 flex-1 text-start"><span className="block truncate text-sm font-semibold"><Tr>{d.name}</Tr></span><span className="block text-xs text-mute">{t(d.role === 'admin' ? 'مدير المنصة' : d.role === 'company' ? 'شركة' : 'مبدع')}</span></span>
                </button>
              );
            })}
          </div>}
        </div>
      )}
    </div>
  );
}

function Shell({ title, sub, children, back = true }) {
  return (
    <div className="auth-shell flex min-h-full flex-col items-center px-4 py-8">
      <div className="mb-5 flex w-full max-w-md items-center justify-between sm:mb-6">
        <Link to="/" aria-label="أوتاد"><Logo size={36} /></Link>
        <div className="flex gap-2"><ThemeButton /><LangSwitch /></div>
      </div>
      <div className="card auth-card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mb-5 mt-1 text-mute">{sub}</p>
        {children}
      </div>
      {back && <Link to="/" className="auth-back mt-4 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"><ArrowRight size={14} className="ltr:rotate-180" />{t('العودة للصفحة الرئيسية')}</Link>}
      <Link to="/support" className="mt-2 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"><Headset size={14} />{t('تحتاج مساعدة؟ تواصل مع الدعم')}</Link>
    </div>
  );
}

export function LoginPage() {
  return (
    <Shell title={t('تسجيل الدخول')} sub={t('أهلاً بعودتك إلى أوتاد.')}>
      <LoginForm />
      <p className="mt-5 text-center text-sm text-mute">{t('ليس لديك حساب؟')} <Link className="font-semibold text-brand" to="/register">{t('إنشاء حساب جديد')}</Link></p>
    </Shell>
  );
}

/* ---------- Register ---------- */
export function RegisterPage() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [role, setRole] = useState('student');
  const [f, setF] = useState({ name: '', email: '', password: '', avatar: null, spec: 'برمجة', spec_other: '', student_status: 'طالب', skills: '', sector: '', city: '', about: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { login(await api.post('/auth/register', { ...f, role })); nav('/app'); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  const google = async (credential) => {
    try { login(await api.post('/auth/google', { credential, role })); nav('/app'); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <Shell title={t('إنشاء حساب جديد')} sub={t('اختر نوع حسابك وابدأ خلال دقيقة.')}>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button type="button" className={`btn ${role === 'student' ? 'btn-p' : ''}`} onClick={() => setRole('student')}><GraduationCap size={16} />{t('مبدع')}</button>
        <button type="button" className={`btn ${role === 'company' ? 'btn-p' : ''}`} onClick={() => setRole('company')}><Building2 size={16} />{t('شركة')}</button>
      </div>
      <form onSubmit={submit}>
        <Field label={role === 'student' ? t('الصورة الشخصية') : t('شعار الشركة')}>
          <AvatarUpload value={f.avatar} onChange={(v) => set('avatar', v)} label={role === 'student' ? t('رفع صورة') : t('رفع الشعار')} name={f.name || t('؟')} square={role === 'company'} />
        </Field>
        <Field label={role === 'student' ? t('الاسم الكامل') : t('اسم الشركة')}><input id="reg-name" className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label={role === 'company' ? t('البريد الرسمي') : t('البريد الإلكتروني')}><input id="reg-email" type="email" dir="ltr" className="inp text-left" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
        <Field label={t('كلمة المرور')} hint={t('8 أحرف على الأقل')}><input id="reg-pass" type="password" dir="ltr" autoComplete="new-password" className="inp text-left" value={f.password} onChange={(e) => set('password', e.target.value)} minLength={8} maxLength={128} required /></Field>
        {role === 'student' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('التخصص')}><select id="reg-spec" className="inp" value={f.spec} onChange={(e) => set('spec', e.target.value)}>{SPECS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></Field>
              {f.spec === 'أخرى' && <Field label={t('اكتب تخصصك')}><input id="reg-spec-other" className="inp" maxLength={40} value={f.spec_other} onChange={(e) => set('spec_other', e.target.value)} placeholder={t('مثال: تدقيق لغوي')} /></Field>}
              <Field label={t('الحالة')}><select id="reg-status" className="inp" value={f.student_status} onChange={(e) => set('student_status', e.target.value)}><option value="طالب">{t('طالب')}</option><option value="خريج جديد">{t('خريج جديد')}</option><option value="مبدع">{t('مبدع')}</option></select></Field>
            </div>
            <Field label={t('المهارات الأساسية')} hint={t('افصل بينها بفاصلة')}><input id="reg-skills" className="inp" value={f.skills} onChange={(e) => set('skills', e.target.value)} placeholder="React, Figma, AutoCAD" /></Field>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('قطاع العمل')}><input id="reg-sector" className="inp" value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
              <Field label={t('المدينة')}><input id="reg-city" className="inp" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
            </div>
            <Field label={t('نبذة عن الشركة')}><textarea id="reg-about" rows="3" className="inp" value={f.about} onChange={(e) => set('about', e.target.value)} /></Field>
          </>
        )}
        <button className="btn btn-p w-full py-2.5" disabled={busy}>{busy ? t('جارٍ الإنشاء…') : t('إنشاء الحساب')}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />{t('أو')}<span className="h-px flex-1 bg-line" /></div>
      <GoogleButton onCredential={google} />
      <LinkedInButton role={role} />
      <p className="mt-5 text-center text-sm text-mute">{t('لديك حساب؟')} <Link className="font-semibold text-brand" to="/login">{t('تسجيل الدخول')}</Link></p>
    </Shell>
  );
}
