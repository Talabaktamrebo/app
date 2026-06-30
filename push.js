/* ============================================================
   طلبك تم — إشعارات Push (إعلانات جديدة: المميّزة والتخفيضات)
   يتطلّب: مفتاح VAPID العام أدناه + دالة Edge «notify-new-ad» + جدول push_subscriptions
   ============================================================ */
(function () {
  'use strict';

  // ⚠️ ضع هنا «المفتاح العام VAPID» (Public Key) — وَلِّده بالأمر:  npx web-push generate-vapid-keys
  var VAPID_PUBLIC_KEY = 'BCxgakQGKveZ-VrjCDDjidvv2-fgsatkbj7IJrxE3x9Q1nDxkd9p4ReJlumuJPtEF-vg1eStHLp00qnPa_XCoAk';

  function supported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // حفظ الاشتراك في Supabase (جدول push_subscriptions)
  async function saveSubscription(sub) {
    try {
      var j = sub.toJSON();
      if (!j || !j.keys) return;
      await supabaseClient.from('push_subscriptions').upsert({
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth
      }, { onConflict: 'endpoint' });
    } catch (e) { console.warn('[push] save failed', e); }
  }

  async function removeSubscription(endpoint) {
    try { await supabaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint); } catch (e) {}
  }

  // تفعيل الإشعارات (يُستدعى من زر القائمة)
  async function enablePush() {
    if (!supported()) { (window.uiAlert || window.alert)('متصفّحك لا يدعم الإشعارات. على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً.', { type: 'info', title: 'غير مدعوم' }); return false; }
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.indexOf('ضع_') === 0) { console.warn('[push] VAPID_PUBLIC_KEY غير مضبوط'); (window.uiAlert || window.alert)('الإشعارات غير مهيّأة بعد. (مفتاح VAPID غير مضبوط)', { type: 'error', title: 'تنبيه' }); return false; }
    try {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') { (window.uiToast || function(){}) ('لم يتم تفعيل الإشعارات', 'info'); updateBtn(); return false; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await saveSubscription(sub);
      try { localStorage.setItem('tam_push_on', '1'); } catch (e) {}
      (window.uiToast || function(){}) ('تم تفعيل إشعارات الإعلانات الجديدة ✓', 'success');
      updateBtn();
      return true;
    } catch (e) {
      console.error('[push] enable failed', e);
      (window.uiAlert || window.alert)('تعذّر تفعيل الإشعارات حالياً. حاول مرّة أخرى.', { type: 'error', title: 'تنبيه' });
      return false;
    }
  }

  async function disablePush() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe(); }
      try { localStorage.removeItem('tam_push_on'); } catch (e) {}
      (window.uiToast || function(){}) ('تم إيقاف الإشعارات', 'info');
      updateBtn();
    } catch (e) { console.warn('[push] disable failed', e); }
  }

  async function isOn() {
    if (!supported() || Notification.permission !== 'granted') return false;
    try { var reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch (e) { return false; }
  }

  window._acTogglePush = async function () {
    if (await isOn()) disablePush(); else enablePush();
  };

  // تحديث نص/حالة زر القائمة
  async function updateBtn() {
    var lbl = document.getElementById('pushMenuLbl'); if (!lbl) return;
    if (!supported()) { lbl.textContent = 'الإشعارات غير مدعومة'; return; }
    lbl.textContent = (await isOn()) ? 'إيقاف إشعارات الإعلانات' : 'تفعيل إشعارات الإعلانات الجديدة';
  }
  window._acRefreshPushBtn = updateBtn;

  // مسح النقطة الحمراء عن أيقونة التطبيق عند فتحه
  function clearBadge() { try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); } catch (e) {} }

  // ===== طلب تفعيل احترافي (Soft Prompt) =====
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  function injectPromptStyles() {
    if (document.getElementById('tamPushStyle')) return;
    var s = document.createElement('style'); s.id = 'tamPushStyle';
    s.textContent = ''
      + '.tam-pp{position:fixed;left:12px;right:12px;bottom:84px;z-index:9500;max-width:440px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.28);padding:15px 16px;direction:rtl;font-family:inherit;display:flex;gap:13px;align-items:flex-start;border:1px solid #f0f0f0;transform:translateY(24px);opacity:0;transition:transform .35s cubic-bezier(.25,.8,.25,1),opacity .35s}'
      + '.tam-pp.show{transform:none;opacity:1}'
      + '.tam-pp-ic{width:46px;height:46px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#F6921E,#E07D0A);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(246,146,30,.4)}'
      + '.tam-pp-ic svg{width:24px;height:24px;color:#fff}'
      + '.tam-pp-b{flex:1;min-width:0}.tam-pp-b b{display:block;font-size:14.5px;font-weight:800;color:#0f172a;margin-bottom:3px}'
      + '.tam-pp-b p{margin:0 0 11px;font-size:12.5px;color:#64748b;line-height:1.6}'
      + '.tam-pp-btns{display:flex;gap:8px}.tam-pp-btns button{border:0;border-radius:11px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;padding:10px 14px}'
      + '.tam-pp-yes{background:#F6921E;color:#fff;flex:1}.tam-pp-no{background:#f1f5f9;color:#64748b}'
      + '.tam-pp-x{position:absolute;top:7px;left:11px;background:none;border:0;color:#cbd5e1;font-size:17px;cursor:pointer;line-height:1}';
    document.head.appendChild(s);
  }
  function snooze() { try { localStorage.setItem('tam_push_prompt', 'snooze:' + Date.now()); } catch (e) {} }
  function hidePrompt() { var p = document.getElementById('tamPushPrompt'); if (p) { p.classList.remove('show'); setTimeout(function () { p.remove(); }, 350); } }
  function showPrompt() {
    if (document.getElementById('tamPushPrompt')) return;
    injectPromptStyles();
    var p = document.createElement('div'); p.id = 'tamPushPrompt'; p.className = 'tam-pp';
    p.innerHTML = '<button class="tam-pp-x" aria-label="إغلاق">✕</button>'
      + '<div class="tam-pp-ic">' + BELL + '</div>'
      + '<div class="tam-pp-b"><b>فعّل إشعارات الإعلانات الجديدة</b>'
      + '<p>ليصلك تنبيه فوري عند كل إعلان مميّز أو عليه خصم — حتى والتطبيق مغلق.</p>'
      + '<div class="tam-pp-btns"><button class="tam-pp-yes">تفعيل الإشعارات</button><button class="tam-pp-no">لاحقاً</button></div></div>';
    document.body.appendChild(p);
    requestAnimationFrame(function () { p.classList.add('show'); });
    p.querySelector('.tam-pp-yes').onclick = async function () { hidePrompt(); var ok = await enablePush(); if (!ok) snooze(); };
    p.querySelector('.tam-pp-no').onclick = function () { snooze(); hidePrompt(); };
    p.querySelector('.tam-pp-x').onclick = function () { snooze(); hidePrompt(); };
  }
  function maybeShowPrompt() {
    if (!supported() || Notification.permission !== 'default') return;   // مُنح/رُفض مسبقاً → لا إزعاج
    try {
      var v = localStorage.getItem('tam_push_prompt');
      if (v && v.indexOf('snooze:') === 0) { var t = Number(v.split(':')[1]) || 0; if (Date.now() - t < 3 * 864e5) return; } // أعد الطلب بعد 3 أيام
    } catch (e) {}
    showPrompt();
  }

  // امسح الشارة عند فتح/إظهار التطبيق
  window.addEventListener('focus', clearBadge);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') clearBadge(); });

  window.addEventListener('load', function () {
    clearBadge();
    setTimeout(async function () {
      updateBtn();
      try {
        if (localStorage.getItem('tam_push_on') === '1' && await isOn()) {
          var reg = await navigator.serviceWorker.ready;
          var sub = await reg.pushManager.getSubscription();
          if (sub) saveSubscription(sub);
        }
      } catch (e) {}
      maybeShowPrompt();   // طلب التفعيل الاحترافي بعد ثوانٍ من الفتح
    }, 3000);
  });
})();
