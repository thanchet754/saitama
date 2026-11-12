// ==============================================================
// WORKOUT VIDEOS -> SUPABASE STORAGE
// Every recording is uploaded automatically to the private bucket
// "saitama-videos" in 8 MB parts (the project caps files at 50 MB).
// Until the upload finishes the video waits in IndexedDB, so it survives
// going offline, a reload or closing the app, and resumes part by part.
// ==============================================================
const VIDEO_BUCKET = 'saitama-videos';
const VIDEO_TABLE = 'saitama_videos';
const VIDEO_PART = 8 * 1024 * 1024;

const VideoSync = (() => {
    let dbp = null;
    let busy = false;
    let pendingCount = 0;
    const progress = {}; // clientId -> { done, total, state: 'queued'|'uploading'|'done'|'offline'|'error' }

    // ---------- IndexedDB queue ----------
    function db() {
        if (!dbp) {
            dbp = new Promise((resolve, reject) => {
                const req = indexedDB.open('saitama-videos', 1);
                req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'key' });
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        return dbp;
    }
    async function tx(mode, fn) {
        const d = await db();
        return new Promise((resolve, reject) => {
            const t = d.transaction('pending', mode);
            const out = fn(t.objectStore('pending'));
            t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
            t.onerror = () => reject(t.error);
        });
    }
    const putItem = (item) => tx('readwrite', s => s.put(item));
    const delItem = (key) => tx('readwrite', s => s.delete(key));
    const allItems = () => tx('readonly', s => s.getAll());

    async function refreshCount() {
        try { pendingCount = sbUserId ? (await allItems()).filter(i => i.uid === sbUserId).length : 0; } catch (e) { pendingCount = 0; }
        renderList();
    }

    // ---------- upload ----------
    const partPath = (uid, clientId, i) => `${uid}/${clientId}/part-${String(i).padStart(3, '0')}`;

    async function queue(blob, meta) {
        if (!sbUserId) return;
        const item = { key: `${sbUserId}:${meta.clientId}`, uid: sbUserId, blob, meta: { ...meta, size: blob.size }, done: 0 };
        progress[meta.clientId] = { done: 0, total: Math.max(1, Math.ceil(blob.size / VIDEO_PART)), state: 'queued' };
        renderStatus();
        try { await putItem(item); } catch (e) { console.warn('Video queue (IndexedDB) unavailable, uploading from memory', e); memoryQueue.push(item); }
        await refreshCount();
        uploadPending();
    }
    const memoryQueue = [];

    async function uploadOne(item) {
        const { uid, blob, meta } = item;
        const total = Math.max(1, Math.ceil(blob.size / VIDEO_PART));
        const p = progress[meta.clientId] = { done: item.done || 0, total, state: 'uploading' };
        renderStatus();
        for (let i = item.done || 0; i < total; i++) {
            if (uid !== sbUserId) throw new Error('user changed');
            const part = blob.slice(i * VIDEO_PART, Math.min(blob.size, (i + 1) * VIDEO_PART));
            const { error } = await sb.storage.from(VIDEO_BUCKET)
                .upload(partPath(uid, meta.clientId, i), part, { upsert: true, contentType: 'application/octet-stream' });
            if (error) throw error;
            item.done = p.done = i + 1;
            renderStatus();
            try { await putItem(item); } catch (e) {}
        }
        const { error } = await sb.from(VIDEO_TABLE).upsert({
            user_id: uid, client_id: meta.clientId, file_name: meta.fileName, exercise: meta.exercise,
            mime: meta.mime, size_bytes: blob.size, parts: total, duration_s: meta.durationS, recorded_at: meta.recordedAt
        }, { onConflict: 'user_id,client_id' });
        if (error) throw error;
        p.state = 'done';
        try { await delItem(item.key); } catch (e) {}
        const mi = memoryQueue.indexOf(item);
        if (mi >= 0) memoryQueue.splice(mi, 1);
    }

    async function uploadPending() {
        if (busy || !sb || !sbUserId) return;
        busy = true;
        try {
            let items = [];
            try { items = await allItems(); } catch (e) {}
            items = items.concat(memoryQueue).filter(i => i.uid === sbUserId);
            for (const item of items) {
                if (!navigator.onLine) { progress[item.meta.clientId] = { ...(progress[item.meta.clientId] || {}), state: 'offline' }; continue; }
                try {
                    await uploadOne(item);
                } catch (e) {
                    console.warn('Video upload paused, will retry', e);
                    progress[item.meta.clientId] = { ...(progress[item.meta.clientId] || {}), state: navigator.onLine ? 'error' : 'offline' };
                }
                renderStatus();
            }
        } finally {
            busy = false;
            await refreshCount();
            loadList();
        }
    }

    // ---------- status text in the preview dialog ----------
    function renderStatus() {
        const el = $('rec-cloud');
        if (!el) return;
        const id = typeof recPreviewClientId !== 'undefined' ? recPreviewClientId : null;
        const p = id && progress[id];
        el.className = 'rec-cloud';
        if (!id) { el.innerHTML = ''; return; }
        if (!p) { el.innerHTML = '<i class="fa-solid fa-cloud"></i> Đã lưu trên đám mây'; el.classList.add('done'); return; }
        if (p.state === 'done') { el.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đã lưu lên đám mây'; el.classList.add('done'); }
        else if (p.state === 'offline') { el.innerHTML = '<i class="fa-solid fa-wifi"></i> Đang offline · video sẽ tự tải lên khi có mạng'; el.classList.add('wait'); }
        else if (p.state === 'error') { el.innerHTML = '<i class="fa-solid fa-rotate"></i> Tải lên bị gián đoạn · sẽ tự thử lại'; el.classList.add('wait'); }
        else { el.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đang lưu lên đám mây... ${Math.round(p.done / p.total * 100)}%`; }
    }

    // ---------- cloud video list ----------
    let list = [];
    async function loadList() {
        if (!sb || !sbUserId || !navigator.onLine) { renderList(); return; }
        const uid = sbUserId;
        const { data, error } = await sb.from(VIDEO_TABLE).select('client_id, file_name, exercise, mime, size_bytes, parts, duration_s, recorded_at')
            .order('recorded_at', { ascending: false }).limit(30);
        if (!error && uid === sbUserId) list = data;
        renderList();
    }

    function renderList() {
        const el = $('video-list');
        if (!el) return;
        const badge = $('video-sync');
        badge.hidden = !pendingCount;
        badge.className = 'sync-status local';
        badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>${pendingCount} chờ tải lên</span>`;
        if (!sbUserId) { el.innerHTML = '<li class="history-empty">Đăng nhập để xem video.</li>'; return; }
        if (!list.length) { el.innerHTML = '<li class="history-empty">Chưa có video. Mỗi buổi tập sẽ tự được quay và lưu ở đây.</li>'; return; }
        el.innerHTML = list.map(v => {
            const d = new Date(v.recorded_at);
            const when = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
            const name = (EXERCISES[v.exercise] && EXERCISES[v.exercise].name) || 'Buổi tập';
            return `<li class="video-item">
                <button class="video-play" onclick="playCloudVideo(${v.client_id})" aria-label="Xem video">
                    <span class="h-name"><i class="fa-solid fa-circle-play"></i> ${name}</span>
                    <span class="h-date">${when} · ${formatTime(v.duration_s || 0)} · ${(v.size_bytes / 1048576).toFixed(1)} MB</span>
                </button>
                <button class="video-del" onclick="deleteCloudVideo(${v.client_id})" aria-label="Xóa video" title="Xóa video"><i class="fa-solid fa-trash-can"></i></button>
            </li>`;
        }).join('');
    }

    async function play(clientId) {
        const v = list.find(x => Number(x.client_id) === clientId);
        if (!v || !sb) return;
        showToast('Đang tải video từ đám mây...', 'info');
        try {
            const parts = [];
            for (let i = 0; i < v.parts; i++) {
                const { data, error } = await sb.storage.from(VIDEO_BUCKET).download(partPath(sbUserId, clientId, i));
                if (error) throw error;
                parts.push(data);
            }
            openRecPreview(new Blob(parts, { type: v.mime }), v.file_name, { clientId });
        } catch (e) {
            console.warn('Video download failed', e);
            showToast('Không tải được video. Kiểm tra mạng rồi thử lại.', 'error');
        }
    }

    async function remove(clientId) {
        const v = list.find(x => Number(x.client_id) === clientId);
        if (!v || !sb || !confirm('Xóa video này khỏi đám mây?')) return;
        const paths = Array.from({ length: v.parts }, (_, i) => partPath(sbUserId, clientId, i));
        const { error: e1 } = await sb.storage.from(VIDEO_BUCKET).remove(paths);
        const { error: e2 } = await sb.from(VIDEO_TABLE).delete().eq('client_id', clientId);
        if (e1 || e2) { showToast('Không xóa được video, thử lại sau.', 'error'); return; }
        list = list.filter(x => Number(x.client_id) !== clientId);
        renderList();
        showToast('Đã xóa video.', 'info');
    }

    function onUserChanged() {
        list = [];
        refreshCount();
        if (sbUserId) { loadList(); uploadPending(); }
    }

    return {
        queue, uploadPending, renderStatus, onUserChanged, play, remove, loadList,
        get pendingCount() { return pendingCount; }
    };
})();
window.VideoSync = VideoSync;
window.playCloudVideo = (id) => VideoSync.play(id);
window.deleteCloudVideo = (id) => VideoSync.remove(id);
VideoSync.onUserChanged(); // auth may have resolved before this file loaded
