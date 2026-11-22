import { t } from '../i18n/index.js';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, KeyRound, Trash2, Link2 } from '../icons.jsx';
import { api, setToken } from '../api.js';
import { useAuth, useToast, useTheme } from '../context.jsx';
import { AvatarUpload, Field, MapKindHint, PageHeader, SPECS } from '../ui.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const { mode, set: setMode, accent, setAccent } = useTheme();
  const nav = useNavigate();
  const isS = user.role === 'student', isC = user.role === 'company';
  const [f, setF] = useState({
    name: user.name, email: user.email, phone: user.phone || '', avatar: user.avatar,
    spec: user.spec, student_status: user.student_status, bio: user.bio,
    sector: user.sector, city: user.city, about: user.about, address: user.address, map_url: user.map_url, contact_email: user.contact_email,
  });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { setUser(await api.put('/me', f)); toast(t('تم حفظ التغييرات')); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  /** الصورة تُحفظ في الحساب فور اعتمادها، دون انتظار زر حفظ بقية الحقول */
  const saveAvatar = async (v) => {
    set('avatar', v);
    try { setUser(await api.put('/me', { avatar: v })); toast(t('تم حفظ الصورة في حسابك')); } catch (err) { toast(err.message, 'err'); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { const r = await api.put('/me/password', pw); if (r.token) setToken(r.token); setPw({ current: '', next: '' }); toast(t('تم تحديث كلمة المرور')); } catch (err) { toast(err.message, 'err'); }
  };
  const del = async () => { try { await api.del('/me'); logout(); nav('/'); } catch (err) { toast(err.message, 'err'); } };

  return (
    <div>
      <PageHeader title={isC ? t('ملف الشركة وإعدادات الحساب') : t('إعدادات الحساب')} sub={t('عدّل بياناتك الشخصية. التغييرات تظهر فوراً في كل أنحاء المنصة.')}>
        {user.role !== 'admin' && <Link to={`/app/people/${user.id}`} className="btn">{t('عرض ملفي كما يراه الآخرون')}</Link>}
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <form onSubmit={save} className="card p-5">
          <Field label={isC ? t('شعار الشركة') : t('الصورة الشخصية')}>
            <AvatarUpload value={f.avatar} onChange={saveAvatar} label={t('تغيير الصورة')} name={f.name} square={isC} />
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label={isC ? t('اسم الشركة') : t('الاسم')}><input id="pf-name" className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
            <Field label={t('رقم الهاتف')}><input id="pf-phone" dir="ltr" className="inp text-left" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label={t('البريد الإلكتروني (لتسجيل الدخول)')}><input id="pf-email" type="email" dir="ltr" className="inp text-left" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
            {isS && (
              <>
                <Field label={t('التخصص')}><select id="pf-spec" className="inp" value={f.spec} onChange={(e) => set('spec', e.target.value)}>{SPECS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></Field>
                <Field label={t('الحالة')}><select id="pf-status" className="inp" value={f.student_status} onChange={(e) => set('student_status', e.target.value)}><option value="طالب">{t('طالب')}</option><option value="خريج جديد">{t('خريج جديد')}</option></select></Field>
              </>
            )}
            {isC && (
              <>
                <Field label={t('قطاع العمل')}><input id="pf-sector" className="inp" value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
                <Field label={t('المدينة')}><input id="pf-city" className="inp" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label={t('البريد الرسمي للتواصل')}><input id="pf-cemail" type="email" dir="ltr" className="inp text-left" value={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></Field>
              </>
            )}
          </div>
          {isS && <Field label={t('النبذة التعريفية')}><textarea id="pf-bio" rows="4" className="inp" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>}
          {isC && (
            <>
              <Field label={t('نبذة عن الشركة')}><textarea id="pf-about" rows="3" className="inp" value={f.about} onChange={(e) => set('about', e.target.value)} /></Field>
              <Field label={t('العنوان النصي الافتراضي')} hint={t('يُستخدم في كل وظيفة لا تحدد عنواناً خاصاً بها.')}><input id="pf-addr" className="inp" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
              <Field label={t('رابط موقع الشركة: Google Maps أو Waze')} hint={<span className="flex flex-wrap items-center gap-2">{t('يُستخدم لفرصك التي لا تحدد لها رابطاً خاصاً.')}<MapKindHint url={f.map_url} /></span>}><input id="pf-map" dir="ltr" className="inp text-left" inputMode="url" placeholder="https://waze.com/ul?..." value={f.map_url} onChange={(e) => set('map_url', e.target.value)} /></Field>
            </>
          )}
          <button className="btn btn-p" disabled={busy}><Save size={16} />{busy ? t('جارٍ الحفظ…') : t('حفظ التغييرات')}</button>
        </form>

        <div className="grid h-fit gap-5">
          <form onSubmit={changePw} className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><KeyRound size={18} />{user.has_password ? t('تغيير كلمة المرور') : t('تعيين كلمة مرور')}</h2>
            {!!user.has_google && <p className="mb-3 flex items-center gap-1 text-sm text-mute"><Link2 size={14} />{t('حسابك مرتبط بـ Google.')}</p>}
            {!!user.has_password && <Field label={t('كلمة المرور الحالية')}><input id="pw-cur" type="password" dir="ltr" className="inp text-left" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>}
            <Field label={t('كلمة المرور الجديدة')}><input id="pw-new" type="password" dir="ltr" className="inp text-left" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
            <button className="btn w-full">{t('تحديث')}</button>
          </form>

          <div className="card p-5">
            <h2 className="mb-3 font-bold">{t('المظهر')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {[['light', t('نهاري')], ['dark', t('ليلي')], ['system', t('تلقائي')]].map(([k, l]) => <button key={k} type="button" className={`btn ${mode === k ? 'btn-p' : ''}`} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-mute">{t('ألوان المنصة')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {[['aurora', t('الأزرق'), '#1e40af,#93b0ff,#8dd3c7'], ['sunset', t('الغروب'), '#c2410c,#fab27d,#f5a0be'], ['emerald', t('الزمرد'), '#047857,#78cdaa,#82c3d7'], ['royal', t('الملكي'), '#5b21b6,#b9a5f5,#919bf0'], ['rose', t('الوردي'), '#be185d,#f5a0b4,#f096be'], ['gold', t('الذهبي'), '#a16207,#f0c878,#ebaf78']].map(([k, l, g]) => (
                <button key={k} type="button" aria-pressed={accent === k} className={`btn flex-col !gap-1.5 ${accent === k ? 'ring-2 ring-brand' : ''}`} onClick={() => setAccent(k)}>
                  <span className="h-5 w-full rounded-lg" style={{ background: `linear-gradient(90deg, ${g})` }} />{l}
                </button>
              ))}
            </div>
          </div>

          {user.role !== 'admin' && (
            <div className="card border-bad/40 p-5">
              <h2 className="mb-2 font-bold text-bad">{t('حذف الحساب')}</h2>
              <p className="mb-3 text-sm text-mute">{t('يحذف حسابك وكل بياناته نهائياً، ولا يمكن التراجع.')}</p>
              {confirmDel ? (
                <div className="flex gap-2"><button className="btn btn-d" onClick={del}><Trash2 size={16} />{t('نعم، احذف نهائياً')}</button><button className="btn" onClick={() => setConfirmDel(false)}>{t('تراجع')}</button></div>
              ) : <button className="btn btn-d" onClick={() => setConfirmDel(true)}>{t('حذف حسابي')}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
