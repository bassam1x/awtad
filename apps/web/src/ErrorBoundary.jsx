import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="mb-2 text-xl font-bold">حدث خطأ غير متوقع</h1>
          <p className="mb-4 text-mute">أعد تحميل الصفحة، وإن استمر الخطأ حاول لاحقاً.</p>
          <button className="btn btn-p" onClick={() => location.reload()}>إعادة التحميل</button>
        </div>
      </div>
    );
  }
}
