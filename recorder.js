// ==============================================================
// WORKOUT VIDEO RECORDER
// Records camera + skeleton + a stamp with device name, GPS, place, time
// ==============================================================
const REC_SETTINGS_KEY = 'aiPoseFitness.recSettings';

let isRecording = false;
let recClientId = 0;          // id of the recording (= its start time)
let recDurationMs = 0;
let recPreviewClientId = null; // video shown in the preview dialog
let mediaRecorder = null;
let recChunks = [];
let recCanvas = null;
let recCtx = null;
let recStartTs = 0;
let recMime = '';
let recTimerInterval = null;
let recBlob = null;
let recFileName = '';
let recObjectUrl = null;

let detectedDeviceName = '';
let geoWatchId = null;
const geo = { status: 'off', lat: null, lon: null, acc: null, place: '' };
let lastGeocode = { ts: 0, lat: null, lon: null };

const recSettings = (() => {
    const defaults = { deviceName: '', gps: true, address: true };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(REC_SETTINGS_KEY) || '{}') }; } catch (e) { return defaults; }
})();

function saveRecSettings() {
    try { localStorage.setItem(REC_SETTINGS_KEY, JSON.stringify(recSettings)); } catch (e) {}
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(text, type = 'info') {
    const el = $('toast');
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ---------- Device name ----------
async function detectDeviceName() {
    const ua = navigator.userAgent;
    let model = '';
    try {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            const d = await navigator.userAgentData.getHighEntropyValues(['model', 'platform']);
            if (d.model) model = d.model;
        }
    } catch (e) {}
    if (!model) {
        const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
        if (m && m[1].trim() !== 'K') model = m[1].trim();
    }
    if (!model && /iPhone/.test(ua)) model = 'iPhone';
    if (!model && (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))) model = 'iPad';

    const os = /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS'
        : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'macOS'
        : /CrOS/.test(ua) ? 'ChromeOS'
        : /Linux/.test(ua) ? 'Linux' : '';
    const browser = /Edg\//.test(ua) ? 'Edge'
        : /OPR\//.test(ua) ? 'Opera'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
        : /CriOS|Chrome\//.test(ua) ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari' : '';

    return [model, os, browser].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ') || 'Thiết bị không xác định';
}

const currentDeviceName = () => (recSettings.deviceName || '').trim() || detectedDeviceName;

// ---------- GPS & place name ----------
function startGeo() {
    geo.status = 'off';
    geo.lat = geo.lon = geo.acc = null;
    if (!recSettings.gps) return;
    if (!navigator.geolocation) { geo.status = 'unsupported'; return; }
    geo.status = 'pending';
    geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            geo.status = 'ok';
            geo.lat = pos.coords.latitude;
            geo.lon = pos.coords.longitude;
            geo.acc = Math.round(pos.coords.accuracy);
            maybeReverseGeocode();
        },
        (err) => { geo.status = err.code === 1 ? 'denied' : 'error'; },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
}

function stopGeo() {
    if (geoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

async function maybeReverseGeocode() {
    if (!recSettings.address || geo.lat === null) return;
    const now = Date.now();
    const moved = lastGeocode.lat === null ? Infinity : distanceMeters(lastGeocode.lat, lastGeocode.lon, geo.lat, geo.lon);
    if (moved < 300 && now - lastGeocode.ts < 120000) return;
    lastGeocode = { ts: now, lat: geo.lat, lon: geo.lon };
    try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${geo.lat}&longitude=${geo.lon}&localityLanguage=vi`;
        const d = await (await fetch(url)).json();
        const parts = [d.locality, d.city, d.principalSubdivision, d.countryName]
            .filter((v, i, arr) => v && arr.indexOf(v) === i);
        geo.place = parts.join(', ');
    } catch (e) {
        console.warn('Reverse geocode failed', e);
    }
}

function gpsText() {
    switch (geo.status) {
        case 'ok': return `${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)} (±${geo.acc} m)`;
        case 'pending': return 'Đang lấy vị trí...';
        case 'denied': return 'Không được cấp quyền vị trí';
        case 'unsupported': return 'Thiết bị không hỗ trợ GPS';
        case 'error': return 'Không lấy được vị trí';
        default: return 'Tắt';
    }
}

// ---------- Recording ----------
function pickMimeType() {
    const types = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

window.toggleRecording = async function () {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
};

// Called automatically every time training starts (recording is mandatory).
// The session is recorded as a chain of ~2.5 min segments: each one is a complete,
// playable file small enough for Telegram (bots accept <= 50 MB).
const REC_SEGMENT_MS = 150000;
let recStream = null;
let recSegIndex = 0;
let recSegTimer = null;
let recSession = []; // finished segments of the current session: { blob, fileName, clientId, index }

async function startRecording() {
    if (isRecording || !isCameraActive) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
        showToast('Thiết bị này không hỗ trợ quay video, buổi tập vẫn được đếm bình thường.', 'warn');
        return;
    }

    recMime = pickMimeType();
    if (!detectedDeviceName) detectedDeviceName = await detectDeviceName();
    if (isRecording || !isCameraActive) return; // stopped / started meanwhile

    // Recording canvas keeps a fixed size even if the camera is flipped/rotated
    recCanvas = document.createElement('canvas');
    recCanvas.width = Math.round((canvasEl.width || 720) / 2) * 2;
    recCanvas.height = Math.round((canvasEl.height || 960) / 2) * 2;
    recCtx = recCanvas.getContext('2d');
    recStartTs = performance.now();
    composeRecordingFrame(true);

    recStream = recCanvas.captureStream(30);
    recSegIndex = 0;
    recSession = [];
    recClientId = Date.now();
    startSegment();
    recSegTimer = setInterval(rotateSegment, REC_SEGMENT_MS);

    isRecording = true;
    recStartTs = performance.now();
    startGeo();

    const btn = $('btn-record');
    btn.classList.add('recording');
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>Dừng quay</span>';
    $('rec-indicator').hidden = false;
    updateRecTimer();
    recTimerInterval = setInterval(updateRecTimer, 500);
}

function startSegment() {
    let rec;
    try {
        rec = new MediaRecorder(recStream, recMime ? { mimeType: recMime, videoBitsPerSecond: 1800000 } : undefined);
    } catch (e) {
        rec = new MediaRecorder(recStream);
    }
    recMime = rec.mimeType || recMime || 'video/webm';
    const seg = { index: ++recSegIndex, chunks: [], startedAt: Date.now(), startPerf: performance.now(), durationMs: 0, last: false };
    rec._seg = seg;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) seg.chunks.push(e.data); };
    rec.onstop = () => finalizeSegment(seg);
    rec.start(1000);
    mediaRecorder = rec;
}

// Start the next file first, then close the previous one (no gap in between)
function rotateSegment() {
    if (!isRecording || !mediaRecorder) return;
    const old = mediaRecorder;
    startSegment();
    old._seg.durationMs = performance.now() - old._seg.startPerf;
    try { old.stop(); } catch (e) {}
}

function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    recDurationMs = performance.now() - recStartTs;
    clearInterval(recTimerInterval);
    clearInterval(recSegTimer);
    stopGeo();
    if (mediaRecorder) {
        mediaRecorder._seg.last = true;
        mediaRecorder._seg.durationMs = performance.now() - mediaRecorder._seg.startPerf;
        try { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch (e) {}
    }
    const btn = $('btn-record');
    btn.classList.remove('recording');
    btn.innerHTML = '<i class="fa-solid fa-circle-dot"></i> <span>Quay video</span>';
    $('rec-indicator').hidden = true;
}

function recElapsedSec() {
    return Math.floor((performance.now() - recStartTs) / 1000);
}

function updateRecTimer() {
    $('rec-time').textContent = formatTime(recElapsedSec());
}

function finalizeSegment(seg) {
    const sessionId = recClientId;
    if (seg.chunks.length) {
        const type = recMime.split(';')[0];
        const blob = new Blob(seg.chunks, { type });
        seg.chunks = [];
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const d = new Date(seg.startedAt);
        const pad = (n) => String(n).padStart(2, '0');
        const ex = EXERCISES[currentExercise];
        const slug = ex.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const multi = seg.index > 1 || !seg.last;
        const fileName = `ai-pose-${slug}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${multi ? '-phan' + seg.index : ''}.${ext}`;
        const durationS = Math.round(seg.durationMs / 1000);
        const clientId = sessionId + seg.index; // unique per segment, ordered within the session

        const lines = [
            `🏋️ ${ex.name} · ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
            `⏱ ${formatTime(durationS)}${multi ? ` · Phần ${seg.index}${seg.last ? ' (cuối)' : ''}` : ''}${repCount > 0 ? ` · ${repCount} ${ex.mode === 'hold' ? 'giây' : 'rep'}` : ''}`,
            `📱 ${recSettings.deviceName || detectedDeviceName || ''}`
        ];
        if (geo.place) lines.push(`📍 ${geo.place}`);

        // 1) always upload (queued on this device until it succeeds), then forwarded to Telegram
        if (window.VideoSync) {
            VideoSync.queue(blob, {
                clientId, sessionId, segment: seg.index, isLast: seg.last, caption: lines.join('\n'),
                fileName, mime: type, exercise: currentExercise, durationS, recordedAt: d.toISOString()
            });
        }
        recSession.push({ blob, fileName, clientId, index: seg.index });
    }
    // 2) at the end of the session ask whether to keep a copy on this device
    if (seg.last) {
        const parts = recSession.sort((x, y) => x.index - y.index);
        recSession = [];
        if (!parts.length) { showToast('Không có dữ liệu video. Hãy thử quay lại.', 'error'); return; }
        openRecPreview(parts[0].blob, parts[0].fileName, { clientId: parts[0].clientId, parts });
    }
}

// Show a video in the preview dialog (new recording or one loaded from the cloud)
function openRecPreview(blob, fileName, opts = {}) {
    recBlob = blob;
    recFileName = fileName;
    const type = blob.type || 'video/mp4';
    if (recObjectUrl) URL.revokeObjectURL(recObjectUrl);
    recObjectUrl = URL.createObjectURL(blob);

    $('rec-preview').src = recObjectUrl;
    const dl = $('rec-download');
    dl.href = recObjectUrl;
    dl.download = fileName;
    const sizeMb = (blob.size / 1048576).toFixed(1);
    $('rec-meta').textContent = `${fileName} · ${sizeMb} MB`;
    recPreviewClientId = opts.clientId || null;
    if (window.VideoSync) VideoSync.renderStatus();
    if (opts.parts !== undefined) recPreviewParts = opts.parts || [];
    const chips = $('rec-parts');
    chips.hidden = recPreviewParts.length < 2;
    chips.innerHTML = recPreviewParts.map((p, i) =>
        `<button class="${p.clientId === recPreviewClientId ? 'active' : ''}" onclick="showRecPart(${i})">Phần ${i + 1}</button>`).join('');

    let canShareFile = NativeApp.isNative;
    try { canShareFile = canShareFile || !!(navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type })] })); } catch (e) {}
    $('rec-share').hidden = !canShareFile;

    $('rec-modal').hidden = false;
    document.body.classList.add('modal-open');
}

let recPreviewParts = [];
window.showRecPart = function (i) {
    const p = recPreviewParts[i];
    if (p) openRecPreview(p.blob, p.fileName, { clientId: p.clientId });
};

window.closeRecModal = function () {
    recPreviewParts = [];
    recPreviewClientId = null;
    $('rec-modal').hidden = true;
    document.body.classList.remove('modal-open');
    $('rec-preview').pause();
};

window.shareRecording = async function () {
    if (!recBlob) return;
    if (NativeApp.isNative) { await NativeApp.saveAndShare(recBlob, recFileName, 'Video buổi tập'); return; }
    try {
        const file = new File([recBlob], recFileName, { type: recBlob.type });
        await navigator.share({ files: [file], title: 'Video buổi tập - AI Pose Tracker' });
    } catch (e) {
        if (e.name !== 'AbortError') showToast('Không chia sẻ được. Hãy tải video về rồi chia sẻ.', 'error');
    }
};

// ---------- Drawing the stamp onto the recording ----------
function fillRoundRect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
}

function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}

function composeRecordingFrame(force) {
    if (!isRecording && !force) return;
    if (!recCtx) return;
    const ctx = recCtx;
    const W = recCanvas.width, H = recCanvas.height;
    const s = Math.min(W, H) / 720; // scale for any resolution

    // Camera + skeleton (cover-fit if the camera changed shape)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const sw = canvasEl.width, sh = canvasEl.height;
    if (sw && sh) {
        const scale = Math.max(W / sw, H / sh);
        const dw = sw * scale, dh = sh * scale;
        ctx.drawImage(canvasEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    const cfg = EXERCISES[currentExercise];
    const pad = 18 * s;
    ctx.textBaseline = 'alphabetic';

    // Top-left: rep counter
    const cardW = 170 * s, cardH = 104 * s;
    fillRoundRect(ctx, pad, pad, cardW, cardH, 16 * s, 'rgba(28, 16, 22,0.78)');
    ctx.fillStyle = '#FF5C34';
    ctx.font = `900 ${13 * s}px Outfit, sans-serif`;
    ctx.fillText(cfg.mode === 'hold' ? 'SỐ GIÂY' : 'SỐ LẦN (REPS)', pad + 16 * s, pad + 26 * s);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${58 * s}px Outfit, sans-serif`;
    ctx.fillText(String(repCount), pad + 16 * s, pad + 86 * s);

    // Top-right: REC + elapsed
    const recText = `REC ${formatTime(recElapsedSec())}`;
    ctx.font = `800 ${16 * s}px Inter, sans-serif`;
    const recW = ctx.measureText(recText).width + 44 * s;
    fillRoundRect(ctx, W - pad - recW, pad, recW, 34 * s, 17 * s, 'rgba(28, 16, 22,0.78)');
    const blink = Math.floor(performance.now() / 600) % 2 === 0;
    ctx.fillStyle = blink ? '#FF3B30' : 'rgba(255,59,48,0.35)';
    ctx.beginPath();
    ctx.arc(W - pad - recW + 18 * s, pad + 17 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(recText, W - pad - recW + 30 * s, pad + 23 * s);

    ctx.font = `900 ${13 * s}px Outfit, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const brand = 'AI POSE TRACKER';
    ctx.fillText(brand, W - pad - ctx.measureText(brand).width, pad + 56 * s);

    // Bottom: info panel
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}`;
    const lines = [
        ['Thời gian', timeStr],
        ['Thiết bị', currentDeviceName()]
    ];
    if (recSettings.gps) lines.push(['GPS', gpsText()]);
    if (recSettings.gps && recSettings.address && geo.place) lines.push(['Vị trí', geo.place]);

    const lineH = 27 * s;
    const titleH = 38 * s;
    const panelH = titleH + lines.length * lineH + 18 * s;
    const panelY = H - pad - panelH;
    const panelW = W - pad * 2;
    fillRoundRect(ctx, pad, panelY, panelW, panelH, 14 * s, 'rgba(28, 16, 22,0.72)');
    ctx.fillStyle = '#FF5C34';
    ctx.fillRect(pad, panelY + 12 * s, 4 * s, panelH - 24 * s);

    const tx = pad + 18 * s;
    const maxTextW = panelW - 36 * s;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${24 * s}px Outfit, sans-serif`;
    ctx.fillText(fitText(ctx, `${cfg.name.toUpperCase()} · ${repCount} ${unitOf(currentExercise)}`, maxTextW), tx, panelY + 34 * s);

    lines.forEach(([label, value], i) => {
        const y = panelY + titleH + 14 * s + i * lineH;
        ctx.font = `700 ${16 * s}px Inter, sans-serif`;
        ctx.fillStyle = '#E9F056';
        const labelText = `${label}: `;
        ctx.fillText(labelText, tx, y);
        const lw = ctx.measureText(labelText).width;
        ctx.font = `500 ${16 * s}px Inter, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(fitText(ctx, value, maxTextW - lw), tx + lw, y);
    });
}

// ---------- Settings UI ----------
function initRecorderUI() {
    const nameEl = $('rec-device-name');
    const gpsEl = $('rec-gps');
    const addrEl = $('rec-address');
    nameEl.value = recSettings.deviceName;
    gpsEl.checked = recSettings.gps;
    addrEl.checked = recSettings.address;
    addrEl.disabled = !recSettings.gps;

    nameEl.addEventListener('input', () => { recSettings.deviceName = nameEl.value.slice(0, 60); saveRecSettings(); });
    gpsEl.addEventListener('change', () => { recSettings.gps = gpsEl.checked; addrEl.disabled = !gpsEl.checked; saveRecSettings(); });
    addrEl.addEventListener('change', () => { recSettings.address = addrEl.checked; saveRecSettings(); });

    // Android app: a plain download link does nothing in a WebView -> use the share sheet
    $('rec-download').addEventListener('click', (e) => {
        if (!NativeApp.isNative || !recBlob) return;
        e.preventDefault();
        NativeApp.saveAndShare(recBlob, recFileName, 'Video buổi tập');
    });

    detectDeviceName().then(name => {
        detectedDeviceName = name;
        $('rec-detected-device').textContent = name;
        nameEl.placeholder = name;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('rec-modal').hidden) closeRecModal();
    });
}

document.addEventListener('DOMContentLoaded', initRecorderUI);
