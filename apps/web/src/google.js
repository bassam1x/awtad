/* تسجيل الدخول عبر Google من خلال Firebase Authentication. تُحمَّل مكتبة Firebase عند الحاجة فقط (حزمة منفصلة)،
   ونستعملها لشيء واحد: نافذة Google ← رمز هوية يتحقق منه خادمنا. الجلسة بعدها هي جلسة المنصة المعتادة. */

let ready;
/** يجهّز المكتبة ويعيد دالة تفتح نافذة Google وترجع رمز الهوية. يُستدعى مبكراً حتى تُفتح النافذة فور الضغط (وإلا منعها المتصفح). */
export function loadGoogle(cfg, language = 'ar') {
  ready ||= Promise.all([import('@firebase/app'), import('@firebase/auth')]).then(([A, F]) => {
    const app = A.getApps()[0] || A.initializeApp(cfg);
    // لا نحفظ جلسة Firebase في المتصفح: يكفينا الرمز لمرة واحدة
    const auth = F.initializeAuth(app, { persistence: F.inMemoryPersistence, popupRedirectResolver: F.browserPopupRedirectResolver });
    auth.languageCode = language === 'en' ? 'en' : 'ar';
    const provider = new F.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return async () => {
      const result = await F.signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      F.signOut(auth).catch(() => {});
      return token;
    };
  }).catch((e) => { ready = undefined; throw e; });   // نسمح بإعادة المحاولة بعد انقطاع
  return ready;
}

/** متصفحات التطبيقات المضمّنة (إنستغرام، فيسبوك...) ترفض Google تسجيل الدخول من داخلها. */
export const inAppBrowser = (ua = globalThis.navigator?.userAgent || '') => /Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|musical_ly|BytedanceWebview|\bLine\/|; wv\)/i.test(ua);

/** رسالة مفهومة لكل خطأ؛ نص فارغ يعني أن المستخدم ألغى بنفسه فلا نزعجه. */
export function googleError(code) {
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(code)) return '';
  if (code === 'auth/popup-blocked') return 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.';
  if (code === 'auth/network-request-failed') return 'تعذّر الاتصال بخدمة Google، حاول بعد قليل';
  if (['auth/web-storage-unsupported', 'auth/operation-not-supported-in-this-environment'].includes(code)) return 'متصفحك لا يدعم الدخول عبر Google. افتح المنصة في Chrome أو Safari.';
  return 'تعذّر تسجيل الدخول عبر Google، أعد المحاولة';
}
