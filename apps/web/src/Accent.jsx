import { useEffect, useRef, useState } from 'react';
import { Palette } from './icons.jsx';
import { useTheme } from './context.jsx';
import { t } from './i18n/index.js';

const ACCENTS = [
  ['aurora', t('الأزرق'), '#1e40af,#93b0ff,#8dd3c7'], ['sunset', t('الغروب'), '#c2410c,#fab27d,#f5a0be'], ['emerald', t('الزمرد'), '#047857,#78cdaa,#82c3d7'],
  ['royal', t('الملكي'), '#5b21b6,#b9a5f5,#919bf0'], ['rose', t('الوردي'), '#be185d,#f5a0b4,#f096be'], ['gold', t('الذهبي'), '#a16207,#f0c878,#ebaf78'],
];

/** شبكة اختيار لون المنصة (في صفحة الحساب وفي قائمة الشريط الجانبي). */
export function AccentGrid() {
  const { accent, setAccent } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACCENTS.map(([k, l, g]) => (
        <button key={k} type="button" aria-pressed={accent === k} className={`btn flex-col !gap-1.5 ${accent === k ? 'ring-2 ring-brand' : ''}`} onClick={() => setAccent(k)}>
          <span className="h-5 w-full rounded-lg" style={{ background: `linear-gradient(90deg, ${g})` }} />{l}
        </button>
      ))}
    </div>
  );
}

/** أيقونة ألوان المنصة بجانب زر المظهر. القائمة تُرسم نسبةً إلى أقرب عنصر relative (صف الأزرار) وتفتح فوقه. */
export function AccentButton() {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} className="flex">
      <button type="button" className="btn" aria-expanded={open} aria-label={t('ألوان المنصة')} data-tip={t('ألوان المنصة')} onClick={() => setOpen((v) => !v)}>
        <Palette size={16} />
      </button>
      {/* خلفية معتمة: الضبابية لا تعمل داخل الشريط الجانبي الزجاجي فيظهر نص القائمة من خلف الألوان */}
      {open && (
        <div role="group" aria-label={t('ألوان المنصة')} className="switcher" style={{ background: 'rgb(var(--card))' }}>
          <div className="switcher-title">{t('ألوان المنصة')}</div>
          <AccentGrid />
        </div>
      )}
    </div>
  );
}
