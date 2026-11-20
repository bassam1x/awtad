import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

/* ---------- Theme ---------- */
const ThemeCtx = createContext();
const readTheme = () => { try { return localStorage.getItem('mahara-theme') || 'system'; } catch { return 'system'; } };
const readAccent = () => { try { const a = localStorage.getItem('mahara-accent'); return ['aurora', 'sunset', 'emerald'].includes(a) ? a : 'aurora'; } catch { return 'aurora'; } };
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
  const toast = useCallback((msg, kind = 'ok') => {
    setT({ msg, kind, k: Date.now() });
    setTimeout(() => setT((x) => (x && Date.now() - x.k >= 2800 ? null : x)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {t && (
        <div role="status" className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-5 py-3 font-semibold shadow-lg ${t.kind === 'err' ? 'bg-bad text-white' : 'bg-ink text-app'}`}>
          {t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Auth ---------- */
const AuthCtx = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) { setReady(true); return; }
    api.get('/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, [logout]);
  const value = useMemo(() => ({
    user, ready, logout, setUser,
    login: (s) => { setToken(s.token); setUser(s.user); },
    refresh: () => api.get('/me').then(setUser),
  }), [user, ready, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------- data hook ---------- */
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    if (!path) { setLoading(false); return undefined; }
    setLoading(true);
    api.get(path).then((d) => { if (live) { setData(d); setError(''); } })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n, ...deps]);
  return { data, error, loading, reload: () => setN((x) => x + 1), setData };
}
