import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

/* ---------- Theme ---------- */
const ThemeCtx = createContext();
const readTheme = () => { try { return localStorage.getItem('mahara-theme') || 'system'; } catch { return 'system'; } };
const readAccent = () => { try { const a = localStorage.getItem('mahara-accent'); return ['aurora', 'sunset', 'emerald', 'royal', 'rose', 'gold'].includes(a) ? a : 'aurora'; } catch { return 'aurora'; } };
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readTheme);
  const [accent, setAccentState] = useState(readAccent);
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const f = (e) => setSysDark(e.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && sysDark);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => { if (accent === 'aurora') delete document.documentElement.dataset.accent; else document.documentElement.dataset.accent = accent; }, [accent]);
  const setAccent = (a) => { setAccentState(a); try { localStorage.setItem('mahara-accent', a); } catch { /* ignore */ } };
  const set = (m) => { setMode(m); try { localStorage.setItem('mahara-theme', m); } catch { /* ignore */ } };
  const toggle = () => set(dark ? 'light' : 'dark');
  return <ThemeCtx.Provider value={{ mode, dark, set, toggle, accent, setAccent }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------- Toast ---------- */
const ToastCtx = createContext();
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef(0);
  const toast = useCallback((msg, kind = 'ok') => {
    clearTimeout(timer.current);
    setT({ msg, kind, k: Date.now() });
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {t && (
        <div key={t.k} role="status" aria-live="polite" className={`toast ${t.kind === 'err' ? 'toast-err' : 'toast-ok'}`}>
          <span className="gicon gicon-sm toast-icon">{t.kind === 'err' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span>
          <span>{t.msg}</span>
          <i className="toast-bar" />
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Data cache (stale-while-revalidate) ---------- */
const cache = new Map();
export const clearFetchCache = () => cache.clear();
/** تحميل مسبق (عند تمرير المؤشر فوق رابط): يملأ الذاكرة فيفتح الانتقال فوراً */
export function prefetch(path) {
  if (!path || cache.has(path) || !getToken()) return;
  api.get(path).then((d) => cache.set(path, d)).catch(() => {});
}

/* ---------- Auth + حسابات محفوظة للتبديل السريع ---------- */
const AuthCtx = createContext();
const AK = 'mahara-accounts';
const readAcc = () => { try { const a = JSON.parse(localStorage.getItem(AK) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const writeAcc = (a) => { try { localStorage.setItem(AK, JSON.stringify(a)); } catch { /* ignore */ } };
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState(readAcc);
  const nav = useNavigate();
  const mutate = useCallback((fn) => setAccounts((list) => { const next = fn(list); writeAcc(next); return next; }), []);
  /* يحفظ الحساب (أو يحدّثه) بعد أي دخول ناجح */
  const save = useCallback((u, token) => mutate((list) => {
    const a = { id: u.id, token, name: u.name, role: u.role, email: u.email };
    return list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? a : x)) : [...list, a];
  }), [mutate]);
  const drop = useCallback((id) => mutate((list) => list.filter((a) => a.id !== id)), [mutate]);
  /* خروج: ينهي الجلسة الحالية ويحذف هذا الحساب من القائمة، وتبقى الحسابات الأخرى */
  const logout = useCallback(() => { const tok = getToken(); mutate((list) => list.filter((a) => a.token !== tok)); setToken(null); clearFetchCache(); setUser(null); }, [mutate]);
  /* فصل الجلسة الحالية دون حذفها من القائمة (لإضافة حساب جديد) */
  const detach = useCallback(() => { setToken(null); clearFetchCache(); setUser(null); }, []);
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) { setReady(true); return; }
    api.get('/me').then((u) => { setUser(u); save(u, getToken()); }).catch(() => setToken(null)).finally(() => setReady(true));
  }, [logout, save]);
  /* تبديل فوري لحساب محفوظ: نتحقق من توكنه أولاً، فإن كان منتهياً يُحذف دون إخراجك من حسابك الحالي */
  const switchTo = useCallback(async (id) => {
    const a = readAcc().find((x) => x.id === id);
    if (!a) return false;
    try {
      const u = await api.getAs('/me', a.token);
      setToken(a.token); clearFetchCache(); setUser(u); save(u, a.token);
      nav('/app', { replace: true });
      return true;
    } catch { drop(id); return false; }
  }, [nav, save, drop]);
  const value = useMemo(() => ({
    user, ready, logout, setUser, accounts, switchTo, drop, detach,
    login: (s) => { clearFetchCache(); setToken(s.token); setUser(s.user); save(s.user, s.token); },
    refresh: () => api.get('/me').then(setUser),
  }), [user, ready, logout, accounts, switchTo, drop, detach, save]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------- data hook ---------- */
/** يعرض النسخة المخزّنة فوراً (إن وُجدت) ثم يحدّثها من الخادم بالخلفية، فلا يظهر تحميل عند التنقل المتكرر. */
export function useFetch(path, deps = []) {
  const [st, setSt] = useState({ path, data: path ? cache.get(path) ?? null : null, error: '', loading: !!path && !cache.has(path) });
  const [n, setN] = useState(0);
  const same = st.path === path;
  const cached = path ? cache.get(path) : undefined;
  const data = same ? st.data : cached ?? null;
  const loading = same ? st.loading : !!path && cached === undefined;
  const error = same ? st.error : '';
  useEffect(() => {
    let live = true;
    if (!path) { setSt({ path, data: null, error: '', loading: false }); return undefined; }
    setSt((s) => ({ path, data: cache.has(path) ? cache.get(path) : s.path === path ? s.data : null, error: '', loading: !cache.has(path) }));
    api.get(path)
      .then((d) => { cache.set(path, d); if (live) setSt({ path, data: d, error: '', loading: false }); })
      .catch((e) => { if (live) setSt((s) => ({ path, data: s.path === path ? s.data : null, error: e.message, loading: false })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n, ...deps]);
  return { data, error, loading, reload: () => setN((x) => x + 1) };
}
