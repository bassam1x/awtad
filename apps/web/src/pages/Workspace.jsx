import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, PackageCheck, BadgeDollarSign, Send } from 'lucide-react';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Empty, Field, Modal, PageHeader, Spinner, Stars, fmt } from '../ui.jsx';

const STEPS = ['قيد التنفيذ', 'تم التسليم', 'تم استلام المبلغ'];

export default function Workspace() {
  const { user } = useAuth();
  const { appId } = useParams();
  const { data: convs, loading } = useFetch(user.role === 'admin' ? null : '/conversations');
  if (user.role === 'admin') return <Navigate to="/app" replace />;
  if (loading) return <Spinner />;
  const cur = convs.find((c) => String(c.id) === appId) || (appId ? null : convs[0]);
  return (
    <div>
      <PageHeader title="مساحة العمل" sub="محادثاتك مع الشركات والمبدعين بعد قبول الطلبات، ومتابعة تسليم المشاريع." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="card h-fit p-2">
          {convs.map((c) => (
            <Link key={c.id} to={`/app/workspace/${c.id}`} className={`flex items-center gap-3 rounded-xl p-2 ${cur?.id === c.id ? 'bg-soft' : 'hover:bg-app'}`}>
              <Avatar u={{ id: c.other_id, name: c.other_name, avatar: c.other_avatar }} size={40} square={user.role === 'student'} />
              <div className="min-w-0"><div className="truncate font-semibold">{c.other_name}</div><div className="truncate text-xs text-mute">{c.title}</div></div>
            </Link>
          ))}
          {!convs.length && <div className="p-4 text-sm text-mute">تظهر المحادثات هنا بعد قبول أي طلب.</div>}
        </div>
        {cur ? <Chat key={cur.id} id={cur.id} /> : <Empty>اختر محادثة من القائمة.</Empty>}
      </div>
    </div>
  );
}

function Chat({ id }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: a, reload: reloadApp, loading } = useFetch(`/applications/${id}`);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [approve, setApprove] = useState(false);
  const box = useRef();
  const load = () => api.get(`/applications/${id}/messages`).then(setMsgs).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [id]); // eslint-disable-line
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs.length]);
  if (loading || !a) return <Spinner />;
  const isS = user.role === 'student';
  const si = a.stage === 'progress' ? 0 : a.stage === 'delivered' ? 1 : 2;
  const send = async () => {
    if (!text.trim()) return;
    try { await api.post(`/applications/${id}/messages`, { text }); setText(''); load(); } catch (e) { toast(e.message, 'err'); }
  };
  const deliver = async () => { try { await api.post(`/applications/${id}/deliver`); toast('تم تسليم العمل'); reloadApp(); load(); } catch (e) { toast(e.message, 'err'); } };
  const who = (sid) => (sid === a.student_id ? a.student : a.company);
  return (
    <div className="card flex min-h-[520px] min-w-0 flex-col p-4">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <div className="flex"><Avatar u={a.company} size={40} square /><span className="-mr-2"><Avatar u={a.student} size={40} /></span></div>
        <div className="min-w-0"><div className="truncate font-bold">{a.posting_title}</div><div className="text-sm text-mute">{a.company.name} و{a.student.name}</div></div>
      </div>
      {a.kind === 'project' && (
        <div className="mb-4">
          <div className="mb-3 flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-1.5 last:flex-none">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${i <= si ? 'bg-good text-white' : 'bg-line text-mute'}`}>{i < si || si === 2 ? <Check size={14} /> : i + 1}</span>
                <span className={`text-xs font-semibold sm:text-sm ${i <= si ? '' : 'text-mute'}`}>{s}</span>
                {i < 2 && <div className={`h-0.5 flex-1 ${i < si ? 'bg-good' : 'bg-line'}`} />}
              </div>
            ))}
          </div>
          {a.stage === 'progress' && isS && <button className="btn btn-p" onClick={deliver}><PackageCheck size={16} />تسليم العمل</button>}
          {a.stage === 'progress' && !isS && <span className="chip">بانتظار تسليم المبدع</span>}
          {a.stage === 'delivered' && isS && <span className="chip chip-w">بانتظار اعتماد الشركة</span>}
          {a.stage === 'delivered' && !isS && <button className="btn btn-g" onClick={() => setApprove(true)}><BadgeDollarSign size={16} />اعتماد التسليم وتحويل {fmt(a.pay)} {a.cur}</button>}
          {a.stage === 'paid' && <span className="chip chip-g">اكتمل المشروع وحُوّل المبلغ إلى المحفظة</span>}
        </div>
      )}
      <div ref={box} className="grid max-h-[380px] flex-1 content-start gap-2 overflow-y-auto pb-2">
        {msgs.map((m) => {
          if (!m.sender_id) return <div key={m.id} className="py-1 text-center text-xs text-mute">{m.text}</div>;
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row' : 'flex-row-reverse'} justify-end`}>
              <div className={`max-w-[75%] rounded-2xl border border-line px-3 py-1.5 ${mine ? 'bg-brand text-white dark:text-slate-900' : 'bg-app'}`}>{m.text}</div>
              <Avatar u={who(m.sender_id)} size={28} square={who(m.sender_id)?.role === 'company'} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 border-t border-line pt-3">
        <input id="chat-in" className="inp" placeholder="اكتب رسالة..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn-p" onClick={send} aria-label="إرسال"><Send size={16} /></button>
      </div>
      {approve && <Approve a={a} onClose={() => setApprove(false)} done={() => { setApprove(false); reloadApp(); load(); }} />}
    </div>
  );
}

function Approve({ a, onClose, done }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const go = async () => {
    try { await api.post(`/applications/${a.id}/approve`, { rating, comment }); toast('تم تحويل المبلغ إلى المحفظة'); done(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="اعتماد التسليم والدفع" onClose={onClose}>
      <p className="mb-3">سيُحوَّل <b className="money">{fmt(a.pay)} {a.cur}</b> إلى محفظة المبدع ويُضاف العمل مع تقييمك إلى ملفه.</p>
      <Field label="التقييم"><Stars v={rating} onChange={setRating} size={26} /></Field>
      <Field label="تعليقك"><textarea id="ap-comment" rows="3" className="inp" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="كيف كان التعامل والتسليم؟" /></Field>
      <button className="btn btn-g w-full" onClick={go}>اعتماد وتحويل المبلغ</button>
    </Modal>
  );
}
