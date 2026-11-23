import { t } from '../i18n/index.js';
import { Tr } from '../translate.jsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ExternalLink, MapPin, Mail } from '../icons.jsx';
import { useFetch } from '../context.jsx';
import { Avatar, ErrorBox, Spinner, Stars, fmt , curLabel, MapLinks, specText } from '../ui.jsx';

export function ProfileBody({ p }) {
  if (p.role === 'company') {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4"><Avatar u={p} size={72} square /><div><h2 className="text-xl font-bold">{p.name}</h2><div className="text-mute"><Tr>{p.sector}</Tr> · <Tr>{p.city}</Tr></div></div></div>
        <p className="mb-4">{p.about || t('لا توجد نبذة.')}</p>
        {p.address && <div className="mb-2 flex items-start gap-2"><MapPin size={18} className="mt-1" /><Tr>{p.address}</Tr></div>}
        {(p.map_url || p.address) && <MapLinks url={p.map_url} address={`${p.address || ''} ${p.city || ''}`.trim()} />}
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
          <div className="text-mute">{specText(p)} · {t(p.student_status)}</div>
          {p.works?.length > 0 && <div className="flex items-center gap-2"><Stars v={p.avg} /><span className="text-sm">{p.avg} {t('من')} {p.works.length} {t('أعمال')}</span></div>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">{p.badges?.map((b) => <span key={b} className="chip chip-g"><BadgeCheck size={13} />{t(b)}</span>)}</div>
      <p className="mb-5">{p.bio || t('لم تُضف نبذة بعد.')}</p>
      <h3 className="mb-2 font-bold">{t('المهارات')}</h3>
      <div className="mb-5 flex flex-wrap gap-2">
        {p.skills?.map((k) => <span key={k.id} className="chip chip-b"><Tr>{k.name}</Tr> · {t(k.level)}</span>)}
        {!p.skills?.length && <span className="text-mute">{t('لا مهارات بعد')}</span>}
      </div>
      <h3 className="mb-2 font-bold">{t('سجل الأعمال المنجزة')}</h3>
      <div className="mb-5 grid gap-2">
        {p.works?.map((w) => (
          <div key={w.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap justify-between gap-2"><b><Tr>{w.title}</Tr></b><Stars v={w.rating} size={14} /></div>
            <div className="text-sm text-mute"><Tr>{w.company_name}</Tr> · <span className="money">{fmt(w.amount)} {curLabel(w.cur)}</span></div>
            <div className="mt-1 text-sm">«<Tr>{t(w.comment)}</Tr>»</div>
          </div>
        ))}
        {!p.works?.length && <span className="text-mute">{t('لا أعمال منجزة بعد.')}</span>}
      </div>
      <h3 className="mb-2 font-bold">{t('معرض أعمال خارجي')}</h3>
      <div className="flex flex-wrap gap-2">
        {p.portfolio?.map((x) => (x.url ? <a key={x.id} className="chip chip-b" href={x.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /><Tr>{x.title}</Tr></a> : <span key={x.id} className="chip"><Tr>{x.title}</Tr></span>))}
        {!p.portfolio?.length && <span className="text-mute">{t('لا روابط بعد')}</span>}
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
      <button className="btn mb-4" onClick={() => nav(-1)}><ArrowRight size={16} className="ltr:rotate-180" />{t('رجوع')}</button>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : <div className="card p-6"><ProfileBody p={data} /></div>}
      <Link to="/app" className="sr-only">{t('الرئيسية')}</Link>
    </div>
  );
}
