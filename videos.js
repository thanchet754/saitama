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
            mime: meta.mime, size_bytes: blob.size, parts: total, duration_s: meta.durationS, recorded_at: meta.recordedAt,
            session_id: meta.sessionId || meta.clientId, segment: meta.segment || 1, is_last: meta.isLast !== false,
            caption: meta.caption || null
        }, { onConflict: 'user_id,client_id' });
        if (error) throw error;
        p.state = 'done';
        forward(meta.clientId); // Telegram (server side; frees Supabase storage once delivered)
        try { await delItem(item.key); } catch (e) {}
        const mi = memoryQueue.indexOf(item);
        if (mi >= 0) memoryQueue.splice(mi, 1);
    }

    let rerun = false;
    async function uploadPending() {
        if (!sb || !sbUserId) return;
        if (busy) { rerun = true; return; }
        busy = true;
        rerun = false;
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
            if (rerun) setTimeout(uploadPending, 100);
        }
    }

    // ---------- Telegram ----------
    const TG_BOT = 'saitama_ngoc_workout_bot';
    let tgLinked = null; // null = unknown, false / { tg_name }
    let tgGroup = null;  // shared group set with /setgroup: { group_title }
    const sending = new Set();

    async function forward(clientId) {
        if (!sb || !sbUserId || !navigator.onLine || sending.has(clientId)) return;
        sending.add(clientId);
        try {
            const { data, error } = await sb.functions.invoke('saitama-telegram-send', { body: { client_id: clientId } });
            if (error) console.warn('Telegram forward failed, will retry', error);
            else if (data && data.status === 'no_link') tgLinked = false;
        } catch (e) {
            console.warn('Telegram forward failed, will retry', e);
        } finally {
            sending.delete(clientId);
            loadList();
        }
    }

    // retry anything uploaded but not delivered yet (offline, not linked yet, temporary errors)
    async function forwardPending() {
        if (!sb || !sbUserId || !navigator.onLine || !(tgLinked || tgGroup)) return;
        const { data } = await sb.from(VIDEO_TABLE).select('client_id')
            .in('telegram_status', ['pending', 'no_link', 'error']).eq('storage_deleted', false)
            .order('recorded_at').limit(20);
        for (const r of data || []) await forward(Number(r.client_id));
    }

    async function checkLink() {
        if (!sb || !sbUserId || !navigator.onLine) return;
        const { data } = await sb.from('saitama_telegram_links').select('tg_name, linked_at').maybeSingle();
        tgLinked = data || false;
        const { data: cfg } = await sb.from('saitama_telegram_config').select('group_chat_id, group_title').maybeSingle();
        tgGroup = cfg && cfg.group_chat_id ? cfg : null;
        renderTgButton();
    }

    function renderTgButton() {
        const b = $('tg-connect');
        if (!b) return;
        b.hidden = !sbUserId;
        b.classList.toggle('linked', !!(tgLinked || tgGroup));
        const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        b.title = tgGroup ? 'Mọi video đang gửi vào nhóm Telegram chung' : '';
        b.innerHTML = tgGroup
            ? `<i class="fa-brands fa-telegram"></i> <span>Nhóm: ${esc(tgGroup.group_title)}</span>`
            : tgLinked
            ? `<i class="fa-brands fa-telegram"></i> <span>Đã kết nối</span>`
            : `<i class="fa-brands fa-telegram"></i> <span>Kết nối Telegram</span>`;
    }

    let linkPoll = null;
    async function connectTelegram() {
        if (!sb || !sbUserId) return;
        if (tgLinked) {
            if (confirm(`Video đang gửi về Telegram${tgLinked.tg_name ? ' của ' + tgLinked.tg_name : ''}. Ngắt kết nối?`)) {
                await sb.from('saitama_telegram_links').delete().eq('user_id', sbUserId);
                tgLinked = false;
                renderTgButton();
            }
            return;
        }
        const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
        // open Telegram right away (still inside the tap, so it isn't blocked as a pop-up)
        const url = `https://t.me/${TG_BOT}?start=${code}`;
        if (NativeApp.isNative && NativeApp.Browser) NativeApp.Browser.open({ url });
        else window.open(url, '_blank', 'noopener');
        const { error } = await sb.from('saitama_telegram_codes').insert({ code, user_id: sbUserId });
        if (error) { showToast('Không tạo được mã kết nối, thử lại sau.', 'error'); return; }
        showToast('Bấm "Start" trong Telegram để hoàn tất kết nối.', 'info');
        // wait for the bot to confirm (up to 3 minutes)
        clearInterval(linkPoll);
        let tries = 0;
        linkPoll = setInterval(async () => {
            if (++tries > 60) { clearInterval(linkPoll); return; }
            await checkLink();
            if (tgLinked) {
                clearInterval(linkPoll);
                if (!tgGroup) showToast('Muốn gửi vào nhóm chung: thêm bot vào nhóm rồi gõ /setgroup trong nhóm.', 'info');
                showToast('Đã kết nối Telegram! Video sẽ tự gửi về đó.', 'info');
                forwardPending();
            }
        }, 3000);
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

    // ---------- cloud video list (one entry per workout session) ----------
    let list = [];
    async function loadList() {
        if (!sb || !sbUserId || !navigator.onLine) { renderList(); return; }
        const uid = sbUserId;
        const { data, error } = await sb.from(VIDEO_TABLE)
            .select('client_id, session_id, segment, file_name, exercise, mime, size_bytes, parts, duration_s, recorded_at, telegram_status, storage_deleted')
            .order('recorded_at', { ascending: false }).limit(60);
        if (!error && uid === sbUserId) list = data;
        renderList();
    }

    function sessions() {
        const map = new Map();
        list.forEach(v => {
            const k = String(v.session_id || v.client_id);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(v);
        });
        return [...map.entries()].map(([id, segs]) => ({ id, segs: segs.sort((a, b) => a.segment - b.segment) }))
            .sort((a, b) => new Date(b.segs[0].recorded_at) - new Date(a.segs[0].recorded_at));
    }

    function statusOf(segs) {
        if (segs.every(v => v.telegram_status === 'sent')) return { cls: 'sent', html: '<i class="fa-brands fa-telegram"></i> Đã gửi Telegram' };
        if (segs.some(v => v.telegram_status === 'too_large')) return { cls: 'warn', html: '<i class="fa-solid fa-triangle-exclamation"></i> Quá 50 MB, giữ trên đám mây' };
        if (!tgLinked && !tgGroup) return { cls: 'cloud', html: '<i class="fa-solid fa-cloud"></i> Trên đám mây · chưa kết nối Telegram' };
        return { cls: 'wait', html: '<i class="fa-solid fa-paper-plane"></i> Đang gửi Telegram...' };
    }

    function renderList() {
        const el = $('video-list');
        if (!el) return;
        renderTgButton();
        const badge = $('video-sync');
        badge.hidden = !pendingCount;
        badge.className = 'sync-status local';
        badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>${pendingCount} chờ tải lên</span>`;
        if (!sbUserId) { el.innerHTML = '<li class="history-empty">Đăng nhập để xem video.</li>'; return; }
        const ss = sessions();
        if (!ss.length) { el.innerHTML = '<li class="history-empty">Chưa có video. Mỗi buổi tập sẽ tự được quay và lưu ở đây.</li>'; return; }
        el.innerHTML = ss.map(({ id, segs }) => {
            const v = segs[0];
            const d = new Date(v.recorded_at);
            const when = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
            const name = (EXERCISES[v.exercise] && EXERCISES[v.exercise].name) || 'Buổi tập';
            const dur = segs.reduce((t, x) => t + (x.duration_s || 0), 0);
            const st = statusOf(segs);
            return `<li class="video-item">
                <button class="video-play" onclick="playCloudVideo('${id}')" aria-label="Xem video">
                    <span class="h-name"><i class="fa-solid fa-circle-play"></i> ${name}${segs.length > 1 ? ` · ${segs.length} phần` : ''}</span>
                    <span class="h-date">${when} · ${formatTime(dur)}</span>
                    <span class="video-st ${st.cls}">${st.html}</span>
                </button>
                <button class="video-del" onclick="deleteCloudVideo('${id}')" aria-label="Xóa video" title="Xóa video"><i class="fa-solid fa-trash-can"></i></button>
            </li>`;
        }).join('');
    }

    function openTelegram() {
        const url = `https://t.me/${TG_BOT}`;
        if (NativeApp.isNative && NativeApp.Browser) NativeApp.Browser.open({ url });
        else window.open(url, '_blank', 'noopener');
    }

    async function play(sessionId) {
        const s0 = sessions().find(x => x.id === String(sessionId));
        if (!s0 || !sb) return;
        const avail = s0.segs.filter(v => !v.storage_deleted);
        if (!avail.length) { openTelegram(); return; } // delivered to Telegram, watch it there
        showToast('Đang tải video từ đám mây...', 'info');
        try {
            const parts = [];
            for (const v of avail) {
                const blobs = [];
                for (let i = 0; i < v.parts; i++) {
                    const { data, error } = await sb.storage.from(VIDEO_BUCKET).download(partPath(sbUserId, v.client_id, i));
                    if (error) throw error;
                    blobs.push(data);
                }
                parts.push({ blob: new Blob(blobs, { type: v.mime }), fileName: v.file_name, clientId: Number(v.client_id), index: v.segment });
            }
            openRecPreview(parts[0].blob, parts[0].fileName, { clientId: parts[0].clientId, parts });
        } catch (e) {
            console.warn('Video download failed', e);
            showToast('Không tải được video. Kiểm tra mạng rồi thử lại.', 'error');
        }
    }

    async function remove(sessionId) {
        const s0 = sessions().find(x => x.id === String(sessionId));
        if (!s0 || !sb) return;
        const sent = s0.segs.some(v => v.telegram_status === 'sent');
        if (!confirm(sent ? 'Xóa video khỏi app? (Bản trên Telegram vẫn còn, xóa trong Telegram nếu muốn.)' : 'Xóa video này khỏi đám mây?')) return;
        const paths = [];
        s0.segs.filter(v => !v.storage_deleted).forEach(v => { for (let i = 0; i < v.parts; i++) paths.push(partPath(sbUserId, v.client_id, i)); });
        const { error: e1 } = paths.length ? await sb.storage.from(VIDEO_BUCKET).remove(paths) : { error: null };
        const { error: e2 } = await sb.from(VIDEO_TABLE).delete().in('client_id', s0.segs.map(v => v.client_id));
        if (e1 || e2) { showToast('Không xóa được video, thử lại sau.', 'error'); return; }
        list = list.filter(v => !s0.segs.includes(v));
        renderList();
        showToast('Đã xóa video.', 'info');
    }

    function onUserChanged() {
        list = [];
        tgLinked = null;
        refreshCount();
        if (sbUserId) {
            loadList();
            uploadPending();
            checkLink().then(forwardPending);
        } else renderTgButton();
    }

    return {
        queue, uploadPending, renderStatus, onUserChanged, play, remove, loadList, connectTelegram, forwardPending,
        get pendingCount() { return pendingCount; }
    };
})();
window.VideoSync = VideoSync;
window.playCloudVideo = (id) => VideoSync.play(id);
window.connectTelegram = () => VideoSync.connectTelegram();
window.deleteCloudVideo = (id) => VideoSync.remove(id);
VideoSync.onUserChanged(); // auth may have resolved before this file loaded
