import { useEffect, useRef, useState } from 'react';
import { WifiOff, ServerCrash, RefreshCw } from 'lucide-react';
import { lang, t } from './i18n/index.js';
import { getToken } from './api.js';
import { useAuth } from './context.jsx';

/* شاشة البداية: شعار أوتاد باختفاء/ظهور متحرّك، وتحته حالة التحميل.
   - تظهر أول فتح في الجلسة لمدة قصيرة ثابتة، وبعدها تختفي بنعومة حين يجهز الحساب.
   - إن بطؤ الخادم (يستيقظ) تظهر رسالة توضح ذلك.
   - إن لم يوجد اتصال، تظهر حالة «لا يوجد اتصال» مع إعادة محاولة تلقائية وزر يدوي. */
const SEEN = 'awtad-splash';
const MIN_MS = 2300;   // أقل مدة لعرض الحركة كاملة أول مرة
const SLOW_MS = 6000;  // بعدها نخبر المستخدم أن الخادم بطيء
const LATE_MS = 700;   // في المرات التالية لا نظهرها إلا إن تأخر التحميل

const seen = () => { try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; } };
const mark = () => { try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ } };

export default function Splash() {
  const { ready, offline, retry } = useAuth();
  const first = useRef(!seen()).current;
  const [minDone, setMinDone] = useState(!first);
  const [late, setLate] = useState(false);
  const [slow, setSlow] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const hasToken = useRef(!!getToken()).current;

  useEffect(() => {
    const a = first ? setTimeout(() => setMinDone(true), MIN_MS) : 0;
    const b = setTimeout(() => setLate(true), LATE_MS);
    const c = setTimeout(() => setSlow(true), SLOW_MS);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [first]);

  const done = ready && minDone && online !== false;
  useEffect(() => {
    if (!done) return undefined;
    mark(); setLeaving(true);
    const id = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(id);
  }, [done]);

  if (gone) return null;
  if (!first && !late && !leaving) return null;

  const noNet = online === false;
  const problem = noNet || (offline && !ready);
  let status = hasToken ? t('نتحقق من حسابك…') : t('جارٍ تجهيز المنصة…');
  if (slow && !ready) status = t('الخادم يستيقظ، وقد يستغرق ذلك حتى دقيقة.');

  return (
    <div className={`splash ${leaving ? 'splash-out' : ''}`} role="status" aria-live="polite" aria-busy={!done}>
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-core">
        <div className="splash-mark" aria-hidden="true">
          <span className="splash-ring" /><span className="splash-ring r2" />
          <svg width="108" height="166" viewBox="0 0 34 52" style={{ overflow: 'visible' }}>
            <rect className="sp-bar b1" x="0" y="36" width="8" height="14" rx="4" />
            <rect className="sp-bar b2" x="13" y="24" width="8" height="26" rx="4" />
            <rect className="sp-bar b3" x="26" y="10" width="8" height="40" rx="4" />
            <circle className="sp-dot" cx="30" cy="3.2" r="3.2" />
          </svg>
        </div>
        <div className="splash-name">{t('أوتاد')}</div>
        <div className="splash-sub" dir="ltr">{lang === 'en' ? 'أوتاد' : 'AWTAD'}</div>

        <div className="splash-status">
          {problem ? (
            <div className="splash-problem">
              <span className="splash-pico">{noNet ? <WifiOff size={22} /> : <ServerCrash size={22} />}</span>
              <div className="font-bold">{noNet ? t('لا يوجد اتصال بالإنترنت') : t('تعذّر الوصول إلى الخادم')}</div>
              <p className="mt-1 text-sm text-mute">{noNet ? t('تأكد من الشبكة، وسنعيد المحاولة تلقائياً.') : t('الخدمة غير متاحة الآن. سنعيد المحاولة تلقائياً.')}</p>
              <button type="button" className="btn btn-p mt-3" onClick={retry}><RefreshCw size={16} />{t('إعادة المحاولة')}</button>
            </div>
          ) : (
            <>
              <div className="splash-bar" aria-hidden="true"><span /></div>
              <p className="splash-msg">{status}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
