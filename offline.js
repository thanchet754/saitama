// Offline mode: service worker, "offline" banner, and upload of everything
// saved on this device as soon as the connection comes back.

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW register failed', e));
    });
}

// Profile edits made offline are marked dirty and pushed later
const profileDirtyKey = () => `aiPoseFitness.profileDirty.${sbUserId}`;
function setProfileDirty(on) {
    try { on ? localStorage.setItem(profileDirtyKey(), '1') : localStorage.removeItem(profileDirtyKey()); } catch (e) {}
}
function isProfileDirty() {
    try { return !!sbUserId && localStorage.getItem(profileDirtyKey()) === '1'; } catch (e) { return false; }
}

async function syncProfileIfDirty() {
    if (!sb || !sbUserId || !isProfileDirty()) return;
    const p = loadLocalProfile();
    if (!p) { setProfileDirty(false); return; }
    const { error } = await sb.from(PROFILE_TABLE).upsert({ user_id: sbUserId, profile: p, updated_at: new Date().toISOString() });
    if (!error) setProfileDirty(false);
}

function pendingCount() {
    if (!sbUserId) return 0;
    const h = loadHistory().filter(x => !x.synced).length;
    const a = loadActCache().filter(x => !x.synced && x.route).length;
    const v = window.VideoSync ? VideoSync.pendingCount : 0;
    return h + a + v + (isProfileDirty() ? 1 : 0);
}

function renderOfflineBar() {
    const bar = $('offline-bar');
    if (!bar) return;
    const offline = !navigator.onLine;
    document.body.classList.toggle('is-offline', offline);
    bar.hidden = !offline;
    if (offline) {
        const n = pendingCount();
        $('offline-text').textContent = n
            ? `Đang offline · ${n} mục lưu trên máy, sẽ tự tải lên khi có mạng`
            : 'Đang offline · dữ liệu được lưu trên máy, sẽ tự tải lên khi có mạng';
    }
}

let syncing = false;
async function syncAllNow(announce) {
    if (syncing || !navigator.onLine || !sb || !sbUserId) return;
    syncing = true;
    const before = pendingCount();
    if (announce) showToast(before ? `Đã có mạng · đang tải ${before} mục lên...` : 'Đã có mạng trở lại.', 'info');
    try {
        await Promise.allSettled([syncHistory(), syncActivities(), syncProfileIfDirty(), window.VideoSync ? VideoSync.uploadPending().then(() => VideoSync.forwardPending()) : null]);
    } finally {
        syncing = false;
    }
    const after = pendingCount();
    if (before > 0) {
        if (after === 0) showToast(`Đã tải lên ${before} mục.`, 'info');
        else if (after < before) showToast(`Đã tải lên ${before - after} mục, còn ${after} mục chờ.`, 'warn');
    }
}

window.addEventListener('offline', () => {
    renderOfflineBar();
    showToast('Mất mạng · app vẫn chạy, dữ liệu lưu trên máy.', 'warn');
});
window.addEventListener('online', () => {
    renderOfflineBar();
    // small delay: the network is often not really usable the instant the event fires
    setTimeout(() => syncAllNow(true), 1500);
});
// Keep the banner counter fresh while offline; retry leftovers while online
setInterval(() => { if (!navigator.onLine) renderOfflineBar(); }, 5000);
setInterval(() => { if (navigator.onLine && pendingCount() > 0) syncAllNow(false); }, 60000);
document.addEventListener('DOMContentLoaded', renderOfflineBar);
renderOfflineBar();
