import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown, FlaskConical, GraduationCap, LogIn, ShieldCheck, UserPlus, X } from './icons.jsx';
import { api } from './api.js';
import { useAuth, useFetch, useToast } from './context.jsx';
import { t } from './i18n/index.js';
import { Tr } from './translate.jsx';

const ROLE = {
  admin: [ShieldCheck, 'مدير المنصة', 'gicon-v'],
  student: [GraduationCap, 'مبدع', 'gicon-c'],
  company: [Building2, 'شركة', 'gicon-w'],
};

/** تبديل سريع بين الحسابات (مدير، شركة، مبدع) لمعاينة المنصة من الداخل.
 *  الحسابات تُحفظ تلقائياً عند الدخول إليها، فتبدّل بنقرة دون إعادة كتابة كلمة المرور. */
export default function AccountSwitcher() {
  const { user, accounts, switchTo, drop, detach, login, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data: cfg } = useFetch('/config');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null); // null أو { email, password }
  const [busy, setBusy] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const go = async (id) => {
    if (id === user.id) return setOpen(false);
    setBusy(String(id));
    const ok = await switchTo(id);
    setBusy('');
    if (ok) setOpen(false); else toast(t('انتهت صلاحية هذا الحساب، سجّل الدخول إليه من جديد'), 'err');
  };
  const demoLogin = async (d) => {
    setBusy(d.email);
    try { login(await api.post('/auth/login', { email: d.email, password: d.password })); nav('/app', { replace: true }); setOpen(false); } catch (e) { toast(e.message, 'err'); }
    setBusy('');
  };
  const addAccount = async (e) => {
    e.preventDefault(); setBusy('add');
    try { login(await api.post('/auth/login', form)); setForm(null); nav('/app', { replace: true }); setOpen(false); } catch (err) { toast(err.message, 'err'); }
    setBusy('');
  };
  const createNew = () => { detach(); setOpen(false); nav('/register'); };
  const savedEmails = new Set(accounts.map((a) => a.email));
  const demo = (cfg?.demo || []).filter((d) => !savedEmails.has(d.email));

  return (
    <div ref={box}>
      <button type="button" className="ibtn" aria-expanded={open} aria-label={t('تبديل الحساب')} data-tip={t('تبديل الحساب')} onClick={() => setOpen((v) => !v)}>
        <ChevronsUpDown size={18} />
      </button>
      {open && (
        <div role="menu" className="switcher">
          <div className="switcher-title">{t('الحسابات المحفوظة')}</div>
          <ul className="grid gap-1">
            {accounts.map((a) => {
              const [I, label, tone] = ROLE[a.role] || ROLE.student;
              const cur = a.id === user.id;
              return (
                <li key={a.id} className="switcher-row">
                  <button type="button" role="menuitem" className={`switcher-item ${cur ? 'is-cur' : ''}`} disabled={busy === String(a.id)} onClick={() => go(a.id)}>
                    <span className={`gicon gicon-sm ${tone}`}><I size={16} /></span>
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block truncate text-sm font-semibold">{a.name}</span>
                      <span className="block truncate text-xs text-mute">{t(label)}{a.email ? ` · ${a.email}` : ''}</span>
                    </span>
                    {cur && <Check size={16} className="text-good" />}
                  </button>
                  <button type="button" className="switcher-x" aria-label={t('نسيان هذا الحساب')} title={t('نسيان هذا الحساب')} onClick={() => (cur ? logout() : drop(a.id))}><X size={14} /></button>
                </li>
              );
            })}
          </ul>

          {demo.length > 0 && (
            <>
              <div className="switcher-title mt-3 flex items-center gap-1"><FlaskConical size={13} />{t('حسابات تجريبية')}</div>
              <div className="grid gap-1">
                {demo.map((d) => {
                  const [I, label, tone] = ROLE[d.role];
                  return (
                    <button key={d.email} type="button" className="switcher-item" disabled={busy === d.email} onClick={() => demoLogin(d)}>
                      <span className={`gicon gicon-sm ${tone}`}><I size={16} /></span>
                      <span className="min-w-0 flex-1 text-start"><span className="block truncate text-sm font-semibold"><Tr>{d.name || t(label)}</Tr></span><span className="block text-xs text-mute">{t(label)}</span></span>
                      <LogIn size={15} className="text-mute" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-3 border-t border-line pt-3">
            {form ? (
              <form onSubmit={addAccount} className="grid gap-2">
                <input className="inp" type="email" dir="ltr" required autoFocus autoComplete="username" placeholder={t('البريد الإلكتروني')} aria-label={t('البريد الإلكتروني')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="inp" type="password" dir="ltr" required autoComplete="current-password" placeholder={t('كلمة المرور')} aria-label={t('كلمة المرور')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn btn-p btn-sm flex-1" disabled={busy === 'add'}>{t('تسجيل الدخول')}</button>
                  <button type="button" className="btn btn-sm" onClick={() => setForm(null)}>{t('إلغاء')}</button>
                </div>
              </form>
            ) : (
              <div className="grid gap-1">
                <button type="button" className="switcher-item" onClick={() => setForm({ email: '', password: '' })}>
                  <span className="gicon gicon-sm gicon-g"><LogIn size={16} /></span><span className="flex-1 text-start text-sm font-semibold">{t('إضافة حساب موجود')}</span>
                </button>
                <button type="button" className="switcher-item" onClick={createNew}>
                  <span className="gicon gicon-sm gicon-p"><UserPlus size={16} /></span><span className="flex-1 text-start text-sm font-semibold">{t('إنشاء حساب جديد')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
