import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Briefcase, CalendarDays, Clock, ExternalLink, FolderKanban, Layers, Map as MapIcon, MapPin, Send, Sprout, Sun, Square, CheckSquare, Trash2, Users, Pencil } from 'lucide-react';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, ErrorBox, Field, Modal, Spinner, StatusChip, fmt } from '../ui.jsx';

function Row({ icon: I, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <I size={16} className="mt-1 shrink-0" />
      <div><div className="text-xs text-mute">{label}</div><div className="font-semibold">{value}</div></div>
    </div>
  );
}

export default function Opportunity() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data: p, loading, error, reload } = useFetch(`/postings/${id}`);
  const [applying, setApplying] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const owner = user.role === 'company' && p.company.id === user.id;
  const remove = async () => { try { await api.del(`/postings/${p.id}`); toast('أُزيل المنشور'); nav(-1); } catch (e) { toast(e.message, 'err'); } };
  const toggle = async () => { try { await api.patch(`/postings/${p.id}`, { status: p.status === 'open' ? 'closed' : 'open' }); reload(); } catch (e) { toast(e.message, 'err'); } };
  const app = p.my_application;
  return (
    <div>
      <button className="btn mb-4" onClick={() => nav(-1)}><ArrowRight size={16} />عودة</button>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="card min-w-0 p-5">
          <div className="mb-4 flex items-start gap-3">
            <Avatar u={p.company} size={60} square />
            <div>
              <h1 className="text-2xl font-bold leading-snug">{p.title}</h1>
              <Link to={`/app/people/${p.company.id}`} className="text-mute hover:text-brand">{p.company.name} · {p.company.sector}</Link>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="chip chip-g"><Sprout size={14} />مناسب للخريجين الجدد والطلاب</span>
            {p.status === 'closed' && <span className="chip chip-r">مغلق</span>}
          </div>
          <p className="mb-5">{p.description}</p>
          <h3 className="mb-2 font-bold">المتطلبات (مهارات وأدوات)</h3>
          <div className="mb-5 flex flex-wrap gap-2">{p.reqs.map((r) => <span key={r} className="chip chip-b">{r}</span>)}</div>
          <h3 className="mb-2 font-bold">الموقع</h3>
          <div className="mb-3 flex items-start gap-2"><MapPin size={18} className="mt-1" />{p.address || 'غير محدد'}</div>
          {p.map_url && (
            <>
              <a href={p.map_url} target="_blank" rel="noopener noreferrer" className="btn btn-p w-full"><MapIcon size={18} />عرض موقع الشركة على خرائط جوجل (Google Maps)</a>
              <a href={p.map_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-gradient-to-l from-goodsoft to-soft p-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white dark:text-slate-900"><MapPin size={20} /></span>
                <div className="min-w-0"><div className="font-semibold">{p.company.name}</div><div className="text-sm text-mute">{p.address}</div></div>
                <ExternalLink size={16} className="mr-auto" />
              </a>
            </>
          )}
        </div>
        <aside className="card h-fit p-5 lg:sticky lg:top-6">
          <div className="money text-3xl">{fmt(p.pay)} <span className="text-base">{p.cur}</span></div>
          <div className="mb-4 text-mute">{p.kind === 'job' ? 'راتب شهري ثابت' : 'مبلغ المشروع يُحوَّل لمحفظتك عند الاعتماد'}</div>
          <div className="mb-5 grid gap-3 text-sm">
            {p.kind === 'job' ? (
              <>
                <Row icon={Briefcase} label="نوع العمل" value={p.type} />
                <Row icon={Sun} label="الفترة" value={p.shift} />
                <Row icon={Clock} label="ساعات العمل" value={`${p.hours} ساعات يومياً`} />
                <Row icon={CalendarDays} label="الأوقات" value={p.schedule} />
              </>
            ) : (
              <>
                <Row icon={FolderKanban} label="النوع" value="مشروع تعاوني" />
                <Row icon={CalendarDays} label="مدة التسليم" value={`${p.days} أيام`} />
              </>
            )}
            <Row icon={Layers} label="التخصص" value={p.spec} />
          </div>
          {user.role === 'student' && (app ? (
            <div className="text-center">
              <StatusChip status={app.status} />
              {app.status === 'accepted' && <Link to={`/app/workspace/${app.id}`} className="btn btn-g mt-3 w-full">فتح المحادثة</Link>}
            </div>
          ) : p.status === 'open' ? <button className="btn btn-p w-full" onClick={() => setApplying(true)}><Send size={16} />التقديم الآن</button> : <div className="text-center text-mute">التقديم مغلق</div>)}
          {owner && (
            <div className="grid gap-2">
              <Link to={`/app/applicants?posting=${p.id}`} className="btn btn-p"><Users size={16} />عرض المتقدمين</Link>
              <Link to={`/app/my-postings/${p.id}/edit`} className="btn"><Pencil size={16} />تعديل المنشور</Link>
              <button className="btn" onClick={toggle}>{p.status === 'open' ? 'إغلاق باب التقديم' : 'إعادة فتح التقديم'}</button>
              <button className="btn btn-d" onClick={remove}><Trash2 size={16} />حذف المنشور</button>
            </div>
          )}
          {user.role === 'admin' && <button className="btn btn-d w-full" onClick={remove}><Trash2 size={16} />حذف المنشور (إدارة)</button>}
        </aside>
      </div>
      {applying && <Apply p={p} onClose={() => setApplying(false)} done={() => { setApplying(false); reload(); }} />}
    </div>
  );
}

function Apply({ p, onClose, done }) {
  const { user } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [pick, setPick] = useState([]);
  const opts = [...(user.works || []).map((w) => w.title), ...(user.portfolio || []).map((x) => x.title)];
  const tog = (t) => setPick((x) => (x.includes(t) ? x.filter((y) => y !== t) : x.length < 2 ? [...x, t] : x));
  const submit = async () => {
    try { await api.post(`/postings/${p.id}/apply`, { message, projects: pick }); toast('أُرسل طلبك بنجاح'); done(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title={`التقديم على: ${p.title}`} onClose={onClose}>
      <Field label="رسالة قصيرة للشركة"><textarea id="ap-msg" rows="3" className="inp" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="عرّف بنفسك ولماذا هذه الفرصة مناسبة لك" /></Field>
      <label className="lbl">اختر مشروعين من معرض أعمالك ({pick.length}/2)</label>
      <div className="mb-4 grid gap-2">
        {opts.map((t, i) => (
          <button key={i + t} type="button" onClick={() => tog(t)} className={`btn justify-start ${pick.includes(t) ? 'border-brand bg-soft' : ''}`}>
            {pick.includes(t) ? <CheckSquare size={16} /> : <Square size={16} />}{t}
          </button>
        ))}
        {!opts.length && <span className="text-mute">أضف مشاريع من صفحة «ملفي المهني» لتظهر هنا.</span>}
      </div>
      <button className="btn btn-p w-full" onClick={submit}>إرسال الطلب</button>
    </Modal>
  );
}
