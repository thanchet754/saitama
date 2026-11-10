// ==============================================================
// NATIVE BRIDGE - only active inside the "Saitama" Android app
// (Capacitor shell that loads this website). On a normal browser
// every helper falls back to the regular Web APIs.
// ==============================================================
const NativeApp = (() => {
    const cap = window.Capacitor;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    const plugin = (name) => (isNative && typeof cap.registerPlugin === 'function' ? cap.registerPlugin(name) : null);

    const api = {
        isNative,
        BackgroundGeolocation: plugin('BackgroundGeolocation'),
        KeepAwake: plugin('KeepAwake'),
        Filesystem: plugin('Filesystem'),
        Share: plugin('Share'),
        App: plugin('App'),
        Browser: plugin('Browser'),
        LocalNotifications: plugin('LocalNotifications'),
        TextToSpeech: plugin('TextToSpeech'),
        build: null
    };

    // ---- speech ----
    api.speak = (text, rate = 1.1) => {
        if (isNative && api.TextToSpeech) {
            api.TextToSpeech.stop().catch(() => {});
            api.TextToSpeech.speak({ text: String(text), lang: 'vi-VN', rate, pitch: 1.0, volume: 1.0, category: 'playback' })
                .catch(e => console.warn('TTS failed', e));
            return true;
        }
        return false; // caller uses Web Speech API
    };

    // ---- keep screen on ----
    api.keepAwake = (on) => {
        if (!isNative || !api.KeepAwake) return false;
        (on ? api.KeepAwake.keepAwake() : api.KeepAwake.allowSleep()).catch(() => {});
        return true;
    };

    // ---- save a Blob: write to app cache, then open the Android share sheet
    //      ("Lưu vào Files / Drive / Zalo / Gallery...") ----
    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });

    api.saveAndShare = async (blob, filename, title) => {
        if (!isNative || !api.Filesystem || !api.Share) return false;
        try {
            const data = await blobToBase64(blob);
            const res = await api.Filesystem.writeFile({ path: filename, data, directory: 'CACHE' });
            await api.Share.share({ title: title || filename, files: [res.uri], dialogTitle: 'Lưu hoặc chia sẻ' });
        } catch (e) {
            if (!/cancel/i.test(String(e && e.message))) {
                console.warn('Native save failed', e);
                if (window.showToast) showToast('Không lưu được file: ' + (e.message || e), 'error');
            }
        }
        return true;
    };

    // ---- Android notification permission (needed for the GPS tracking notification) ----
    api.ensureNotificationPermission = async () => {
        if (!isNative || !api.LocalNotifications) return;
        try {
            const p = await api.LocalNotifications.checkPermissions();
            if (p.display !== 'granted') await api.LocalNotifications.requestPermissions();
        } catch (e) { console.warn('Notification permission', e); }
    };

    return api;
})();

// ---- native-only setup: back button, version check ----
(function initNativeShell() {
    if (!NativeApp.isNative) return;
    document.documentElement.classList.add('is-native-app');

    document.addEventListener('DOMContentLoaded', async () => {
        // Back button: close an open dialog first, never kill an activity in progress
        if (NativeApp.App) {
            NativeApp.App.addListener('backButton', ({ canGoBack }) => {
                const recModal = document.getElementById('rec-modal');
                const actModal = document.getElementById('act-modal');
                if (recModal && !recModal.hidden) { closeRecModal(); return; }
                // Back while training = leave the full-screen workout
                if (document.body.classList.contains('workout-on')) { toggleCamera(); return; }
                if (actModal && !actModal.hidden) {
                    if (typeof modalMode !== 'undefined' && modalMode === 'finish') return; // must choose Save / Discard
                    closeActModal();
                    return;
                }
                if (canGoBack) { history.back(); return; }
                NativeApp.App.minimizeApp(); // keep GPS recording alive in the background
            });
        }

        // Native shell version: only a native change ever needs a new APK
        try {
            const info = await NativeApp.App.getInfo();
            NativeApp.build = Number(info.build) || 0;
            const footer = document.querySelector('.app-footer');
            if (footer) footer.insertAdjacentHTML('beforeend', `<br><span class="app-build">Ứng dụng Android · bản ${info.version} (build ${info.build})</span>`);

            const res = await fetch('/app-version.json', { cache: 'no-store' });
            const all = await res.json();
            const cfg = all[window.Capacitor.getPlatform()] || {};
            if (NativeApp.build && cfg.minBuild && NativeApp.build < cfg.minBuild) {
                const bar = document.getElementById('app-update');
                document.getElementById('app-update-text').textContent = cfg.message || all.message || 'Có bản ứng dụng mới cần cài đặt.';
                bar.hidden = false;
                document.getElementById('app-update-btn').onclick = () => NativeApp.Browser.open({ url: cfg.url });
            }
        } catch (e) {
            console.warn('Version check failed', e);
        }
    });
})();
