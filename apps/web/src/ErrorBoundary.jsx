import { t } from './i18n/index.js';
import { Component } from 'react';
import { reloadOnceIfStale } from './staleReload.js';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); reloadOnceIfStale(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="mb-2 text-xl font-bold">{t('حدث خطأ غير متوقع')}</h1>
          <p className="mb-4 text-mute">{t('أعد تحميل الصفحة، وإن استمر الخطأ حاول لاحقاً.')}</p>
          <button className="btn btn-p" onClick={() => location.reload()}>{t('إعادة التحميل')}</button>
        </div>
      </div>
    );
  }
}
