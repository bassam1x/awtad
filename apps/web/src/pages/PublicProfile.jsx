import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ExternalLink, MapPin, Mail } from 'lucide-react';
import { useFetch } from '../context.jsx';
import { Avatar, ErrorBox, Spinner, Stars, fmt } from '../ui.jsx';

export function ProfileBody({ p }) {
  if (p.role === 'company') {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4"><Avatar u={p} size={72} square /><div><h2 className="text-xl font-bold">{p.name}</h2><div className="text-mute">{p.sector} · {p.city}</div></div></div>
        <p className="mb-4">{p.about || 'لا توجد نبذة.'}</p>
        {p.address && <div className="mb-2 flex items-start gap-2"><MapPin size={18} className="mt-1" />{p.address}</div>}
        {p.map_url && <a className="btn" href={p.map_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />الموقع على خرائط جوجل</a>}
        {p.contact_email && <div className="mt-3 flex items-center gap-2 text-mute"><Mail size={16} /><span dir="ltr">{p.contact_email}</span></div>}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Avatar u={p} size={72} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{p.name}</h2>
          <div className="text-mute">{p.spec} · {p.student_status}</div>
          {p.works?.length > 0 && <div className="flex items-center gap-2"><Stars v={p.avg} /><span className="text-sm">{p.avg} من {p.works.length} أعمال</span></div>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">{p.badges?.map((b) => <span key={b} className="chip chip-g"><BadgeCheck size={13} />{b}</span>)}</div>
      <p className="mb-5">{p.bio || 'لم تُضف نبذة بعد.'}</p>
      <h3 className="mb-2 font-bold">المهارات</h3>
      <div className="mb-5 flex flex-wrap gap-2">
        {p.skills?.map((k) => <span key={k.id} className="chip chip-b">{k.name} · {k.level}</span>)}
        {!p.skills?.length && <span className="text-mute">لا مهارات بعد</span>}
      </div>
      <h3 className="mb-2 font-bold">سجل الأعمال المنجزة</h3>
      <div className="mb-5 grid gap-2">
        {p.works?.map((w) => (
          <div key={w.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap justify-between gap-2"><b>{w.title}</b><Stars v={w.rating} size={14} /></div>
            <div className="text-sm text-mute">{w.company_name} · <span className="money">{fmt(w.amount)} {w.cur}</span></div>
            <div className="mt-1 text-sm">«{w.comment}»</div>
          </div>
        ))}
        {!p.works?.length && <span className="text-mute">لا أعمال منجزة بعد.</span>}
      </div>
      <h3 className="mb-2 font-bold">معرض أعمال خارجي</h3>
      <div className="flex flex-wrap gap-2">
        {p.portfolio?.map((x) => (x.url ? <a key={x.id} className="chip chip-b" href={x.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} />{x.title}</a> : <span key={x.id} className="chip">{x.title}</span>))}
        {!p.portfolio?.length && <span className="text-mute">لا روابط بعد</span>}
      </div>
    </div>
  );
}

export default function PublicProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = useFetch(`/people/${id}`);
  return (
    <div>
      <button className="btn mb-4" onClick={() => nav(-1)}><ArrowRight size={16} />رجوع</button>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : <div className="card p-6"><ProfileBody p={data} /></div>}
      <Link to="/app" className="sr-only">الرئيسية</Link>
    </div>
  );
}
