import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { AuthProvider, ThemeProvider, ToastProvider } from './context.jsx';
import './index.css';

// توهّج يتبع المؤشر فوق البطاقات
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest?.('.card');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

// تموّج عند الضغط على الأزرار الرئيسية
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest?.('.btn-p, .btn-g');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'rip'; s.style.left = `${e.clientX - r.left}px`; s.style.top = `${e.clientY - r.top}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
