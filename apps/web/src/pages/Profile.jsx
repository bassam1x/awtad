import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, KeyRound, Trash2, Link2 } from 'lucide-react';
import { api, setToken } from '../api.js';
import { useAuth, useToast, useTheme } from '../context.jsx';
import { AvatarUpload, Field, PageHeader, SPECS } from '../ui.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const { mode, set: setMode } = useTheme();
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
    try { setUser(await api.put('/me', f)); toast('تم حفظ التغييرات'); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { const r = await api.put('/me/password', pw); if (r.token) setToken(r.token); setPw({ current: '', next: '' }); toast('تم تحديث كلمة المرور'); } catch (err) { toast(err.message, 'err'); }
  };
  const del = async () => { try { await api.del('/me'); logout(); nav('/'); } catch (err) { toast(err.message, 'err'); } };

  return (
    <div>
      <PageHeader title={isC ? 'ملف الشركة وإعدادات الحساب' : 'إعدادات الحساب'} sub="عدّل بياناتك الشخصية. التغييرات تظهر فوراً في كل أنحاء المنصة.">
        {user.role !== 'admin' && <Link to={`/app/people/${user.id}`} className="btn">عرض ملفي كما يراه الآخرون</Link>}
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <form onSubmit={save} className="card p-5">
          <Field label={isC ? 'شعار الشركة' : 'الصورة الشخصية'}>
            <AvatarUpload value={f.avatar} onChange={(v) => set('avatar', v)} label="تغيير الصورة" name={f.name} square={isC} />
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label={isC ? 'اسم الشركة' : 'الاسم'}><input id="pf-name" className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
            <Field label="رقم الهاتف"><input id="pf-phone" dir="ltr" className="inp text-left" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="البريد الإلكتروني (لتسجيل الدخول)"><input id="pf-email" type="email" dir="ltr" className="inp text-left" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
            {isS && (
              <>
                <Field label="التخصص"><select id="pf-spec" className="inp" value={f.spec} onChange={(e) => set('spec', e.target.value)}>{SPECS.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="الحالة"><select id="pf-status" className="inp" value={f.student_status} onChange={(e) => set('student_status', e.target.value)}><option>طالب</option><option>خريج جديد</option></select></Field>
              </>
            )}
            {isC && (
              <>
                <Field label="قطاع العمل"><input id="pf-sector" className="inp" value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
                <Field label="المدينة"><input id="pf-city" className="inp" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label="البريد الرسمي للتواصل"><input id="pf-cemail" type="email" dir="ltr" className="inp text-left" value={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></Field>
              </>
            )}
          </div>
          {isS && <Field label="النبذة التعريفية"><textarea id="pf-bio" rows="4" className="inp" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>}
          {isC && (
            <>
              <Field label="نبذة عن الشركة"><textarea id="pf-about" rows="3" className="inp" value={f.about} onChange={(e) => set('about', e.target.value)} /></Field>
              <Field label="العنوان النصي الافتراضي" hint="يُستخدم في كل وظيفة لا تحدد عنواناً خاصاً بها."><input id="pf-addr" className="inp" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
              <Field label="رابط Google Maps الافتراضي"><input id="pf-map" dir="ltr" className="inp text-left" value={f.map_url} onChange={(e) => set('map_url', e.target.value)} /></Field>
            </>
          )}
          <button className="btn btn-p" disabled={busy}><Save size={16} />{busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</button>
        </form>

        <div className="grid h-fit gap-5">
          <form onSubmit={changePw} className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><KeyRound size={18} />{user.has_password ? 'تغيير كلمة المرور' : 'تعيين كلمة مرور'}</h2>
            {user.has_google && <p className="mb-3 flex items-center gap-1 text-sm text-mute"><Link2 size={14} />حسابك مرتبط بـ Google.</p>}
            {user.has_password && <Field label="كلمة المرور الحالية"><input id="pw-cur" type="password" dir="ltr" className="inp text-left" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>}
            <Field label="كلمة المرور الجديدة"><input id="pw-new" type="password" dir="ltr" className="inp text-left" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
            <button className="btn w-full">تحديث</button>
          </form>

          <div className="card p-5">
            <h2 className="mb-3 font-bold">المظهر</h2>
            <div className="grid grid-cols-3 gap-2">
              {[['light', 'نهاري'], ['dark', 'ليلي'], ['system', 'تلقائي']].map(([k, l]) => <button key={k} type="button" className={`btn ${mode === k ? 'btn-p' : ''}`} onClick={() => setMode(k)}>{l}</button>)}
            </div>
          </div>

          {user.role !== 'admin' && (
            <div className="card border-bad/40 p-5">
              <h2 className="mb-2 font-bold text-bad">حذف الحساب</h2>
              <p className="mb-3 text-sm text-mute">يحذف حسابك وكل بياناته نهائياً، ولا يمكن التراجع.</p>
              {confirmDel ? (
                <div className="flex gap-2"><button className="btn btn-d" onClick={del}><Trash2 size={16} />نعم، احذف نهائياً</button><button className="btn" onClick={() => setConfirmDel(false)}>تراجع</button></div>
              ) : <button className="btn btn-d" onClick={() => setConfirmDel(true)}>حذف حسابي</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
