// ==============================================================
// GPS ACTIVITIES (Strava-style): run, walk, ride, drive
// Live map + distance, moving time, pace/speed, elevation, splits
// ==============================================================
const ACT_TABLE = 'activities';
const ACT_ACTIVE_KEY = 'aiPoseFitness.activeActivity';
const ACT_SETTINGS_KEY = 'aiPoseFitness.actSettings';
const ACT_LIST_LIMIT = 20;

const ACT_TYPES = {
    RUN:   { name: 'Chạy bộ', icon: 'fa-person-running', pace: true,  maxSpeed: 12, moveSpeed: 0.8, spacing: 5,  maxAcc: 30,
             met: (kmh) => Math.max(6, kmh) },
    WALK:  { name: 'Đi bộ',   icon: 'fa-person-walking', pace: true,  maxSpeed: 4.5, moveSpeed: 0.4, spacing: 5,  maxAcc: 30,
             met: (kmh) => (kmh < 4 ? 2.8 : kmh < 5.5 ? 3.5 : 4.3) },
    RIDE:  { name: 'Đạp xe',  icon: 'fa-person-biking',  pace: false, maxSpeed: 25, moveSpeed: 1.2, spacing: 15, maxAcc: 40,
             met: (kmh) => (kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : 10) },
    DRIVE: { name: 'Đi xe',   icon: 'fa-motorcycle',     pace: false, maxSpeed: 70, moveSpeed: 2,   spacing: 40, maxAcc: 50,
             met: () => 0, noCalories: true }
};
const ACT_ORDER = ['RUN', 'WALK', 'RIDE', 'DRIVE'];

const actSettings = (() => {
    const d = { type: 'RUN', weight: 60, autoPause: true, voiceKm: true };
    try { return { ...d, ...JSON.parse(localStorage.getItem(ACT_SETTINGS_KEY) || '{}') }; } catch (e) { return d; }
})();
const saveActSettings = () => { try { localStorage.setItem(ACT_SETTINGS_KEY, JSON.stringify(actSettings)); } catch (e) {} };

// ---------- state ----------
let act = null;            // the activity being recorded
let actWatchId = null;     // geolocation watch
let actTicker = null;      // 1s timer
let lastFix = null;        // latest GPS fix (even when not recording)
let actMap = null, actRouteLine = null, actPosMarker = null, actAccCircle = null, actTiles = null;
let followMe = true;
let detailMap = null, detailTiles = null;
let detailActivity = null; // activity shown in the detail modal

// ---------- helpers ----------
function haversine(a, b) {
    const R = 6371000, toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtPace(secPerKm) {
    if (!isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return '--:--';
    const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
    return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

const fmtKm = (m) => (m / 1000).toFixed(2);
const fmtSpeed = (mps) => (isFinite(mps) && mps > 0 ? (mps * 3.6).toFixed(1) : '0.0');

function caloriesFor(type, distanceM, movingSec) {
    const cfg = ACT_TYPES[type];
    if (cfg.noCalories || movingSec <= 0) return null;
    const kmh = (distanceM / 1000) / (movingSec / 3600);
    return Math.round(cfg.met(kmh) * (actSettings.weight || 60) * (movingSec / 3600));
}

function speakText(text) {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        window.speechSynthesis.speak(u);
    } catch (e) {}
}

// ---------- mode tabs ----------
const MODE_KEY = 'aiPoseFitness.mode';

window.setMode = function (mode) {
    const gps = mode === 'gps';
    $('mode-camera').hidden = gps;
    $('mode-gps').hidden = !gps;
    document.querySelectorAll('.mode-tab').forEach(t => {
        const on = t.dataset.mode === mode;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
    });
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}

    if (gps) {
        if (isCameraActive) stopCamera();
        initActMap();
        setTimeout(() => actMap && actMap.invalidateSize(), 50);
        if (sbUserId) startGpsWatch();
    } else if (!act) {
        stopGpsWatch();
    }
};

// ---------- map ----------
// OpenStreetMap tiles (no API key). Dark mode is done with a CSS filter on the tile pane.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const tileUrl = () => TILE_URL;

function makeTiles() {
    return L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 });
}

function initActMap() {
    if (actMap || typeof L === 'undefined') return;
    actMap = L.map('act-map', { zoomControl: false, attributionControl: true }).setView([16.0, 106.0], 5);
    actTiles = makeTiles().addTo(actMap);
    L.control.zoom({ position: 'bottomright' }).addTo(actMap);
    actRouteLine = L.polyline([], { color: '#FF5E3A', weight: 5, opacity: 0.95 }).addTo(actMap);
    actMap.on('dragstart', () => { followMe = false; $('act-recenter').classList.add('show'); });
    if (act) redrawRoute();
    if (lastFix) updatePositionMarker(lastFix, true);
}

window.recenterMap = function () {
    followMe = true;
    $('act-recenter').classList.remove('show');
    if (lastFix && actMap) actMap.setView([lastFix.lat, lastFix.lon], Math.max(actMap.getZoom(), 16));
};

function updatePositionMarker(p, forceView) {
    if (!actMap) return;
    const ll = [p.lat, p.lon];
    if (!actPosMarker) {
        actPosMarker = L.circleMarker(ll, { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#00A8FF', fillOpacity: 1 }).addTo(actMap);
        actAccCircle = L.circle(ll, { radius: p.acc || 10, color: '#00A8FF', weight: 1, fillOpacity: 0.12 }).addTo(actMap);
        actMap.setView(ll, 16);
    } else {
        actPosMarker.setLatLng(ll);
        actAccCircle.setLatLng(ll).setRadius(p.acc || 10);
        if (followMe || forceView) actMap.panTo(ll, { animate: true });
    }
}

function redrawRoute(fit) {
    if (!actRouteLine || !act) return;
    actRouteLine.setLatLngs(act.points.map(p => [p.lat, p.lon]));
    if (fit && act.points.length >= 2) {
        followMe = false;
        actMap.fitBounds(actRouteLine.getBounds(), { padding: [30, 30], maxZoom: 17 });
        $('act-recenter').classList.add('show');
    }
}

document.addEventListener('themechange', () => {
    if (actTiles) actTiles.setUrl(tileUrl());
    if (detailTiles) detailTiles.setUrl(tileUrl());
});

// ---------- GPS ----------
function setGpsBadge(text, level) {
    const el = $('act-gps-badge');
    el.className = `act-gps-badge ${level}`;
    el.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> ${text}`;
}

function startGpsWatch() {
    if (actWatchId !== null) return;
    if (!navigator.geolocation) {
        setGpsBadge('Thiết bị không hỗ trợ GPS', 'bad');
        return;
    }
    setGpsBadge('Đang tìm GPS...', 'wait');
    actWatchId = navigator.geolocation.watchPosition(onGpsPosition, onGpsError, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 30000
    });
}

function stopGpsWatch() {
    if (actWatchId !== null) navigator.geolocation.clearWatch(actWatchId);
    actWatchId = null;
}

function onGpsError(err) {
    if (err.code === 1) {
        setGpsBadge('Chưa cấp quyền vị trí', 'bad');
        showToast('Hãy cho phép truy cập Vị trí trong trình duyệt để ghi hoạt động.', 'error');
    } else {
        setGpsBadge('Mất tín hiệu GPS', 'bad');
    }
}

function onGpsPosition(pos) {
    const c = pos.coords;
    const p = {
        lat: c.latitude, lon: c.longitude, t: pos.timestamp || Date.now(),
        alt: (c.altitude === null || c.altitude === undefined) ? null : c.altitude,
        acc: Math.round(c.accuracy || 0),
        spd: (c.speed === null || c.speed === undefined || isNaN(c.speed)) ? null : c.speed
    };
    lastFix = p;
    const level = p.acc <= 15 ? 'good' : p.acc <= 40 ? 'ok' : 'bad';
    setGpsBadge(`GPS ±${p.acc} m`, level);
    // While recording, don't let an obvious GPS jump drag the map around
    const result = (act && act.status === 'running') ? addTrackPoint(p) : null;
    if (result !== 'jump') updatePositionMarker(p);
}

// Filter noise and accumulate distance / elevation / splits
function addTrackPoint(p) {
    const cfg = ACT_TYPES[act.type];
    if (p.acc > cfg.maxAcc) return;          // too inaccurate

    if (!act.last) {
        act.last = p;
        act.altRef = p.alt;
        act.points.push(p);
        redrawRoute();
        return;
    }

    const d = haversine(act.last, p);
    const dt = (p.t - act.last.t) / 1000;
    if (dt <= 0) return;
    const v = d / dt;
    if (v > cfg.maxSpeed * 1.5) return 'jump'; // GPS jump
    if (d < Math.max(3, p.acc * 0.35)) return; // standing still / jitter

    act.distance += d;
    act.lastMoveTs = Date.now();
    act.maxSpeed = Math.max(act.maxSpeed, p.spd !== null ? p.spd : v);
    act.recent.push({ t: p.t, dist: act.distance });

    // Elevation gain with a 3 m hysteresis to ignore GPS altitude noise
    if (p.alt !== null) {
        if (act.altRef === null) act.altRef = p.alt;
        else if (p.alt - act.altRef >= 3) { act.elevGain += p.alt - act.altRef; act.altRef = p.alt; }
        else if (act.altRef - p.alt >= 3) act.altRef = p.alt;
    }

    const lastSaved = act.points[act.points.length - 1];
    if (!lastSaved || haversine(lastSaved, p) >= cfg.spacing) {
        act.points.push(p);
        if (actRouteLine) actRouteLine.addLatLng([p.lat, p.lon]);
    }
    act.last = p;

    // Splits every full km
    while (act.distance >= (act.splits.length + 1) * 1000) {
        const totalSec = act.movingMs / 1000;
        const prev = act.splits.reduce((s, x) => s + x.seconds, 0);
        const split = { km: act.splits.length + 1, seconds: Math.round(totalSec - prev) };
        act.splits.push(split);
        renderSplits();
        if (actSettings.voiceKm) {
            const pace = ACT_TYPES[act.type].pace
                ? `pace ${fmtPace(split.seconds).replace(':', ' phút ')} giây`
                : `tốc độ trung bình ${fmtSpeed(act.distance / (act.movingMs / 1000))} ki lô mét giờ`;
            speakText(`${split.km} ki lô mét. ${pace}`);
        }
    }
}

function currentSpeed() {
    if (!act) return 0;
    const now = Date.now();
    if (lastFix && lastFix.spd !== null && now - lastFix.t < 5000 && act.status === 'running') return lastFix.spd;
    act.recent = act.recent.filter(r => now - r.t < 20000);
    if (act.recent.length < 2) return 0;
    const a = act.recent[0], b = act.recent[act.recent.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.dist - a.dist) / dt : 0;
}

// ---------- lifecycle ----------
function newActivity(type) {
    return {
        clientId: Date.now(), type, startedAt: Date.now(), status: 'running',
        points: [], distance: 0, movingMs: 0, elevGain: 0, maxSpeed: 0, splits: [],
        last: null, altRef: null, lastMoveTs: Date.now(), lastTick: Date.now(), recent: [],
        pausedAt: null, pausedMs: 0
    };
}

window.startActivity = function () {
    if (!sbUserId) { showAuth('login'); return; }
    if (!navigator.geolocation) { showToast('Thiết bị không hỗ trợ GPS.', 'error'); return; }
    act = newActivity(actSettings.type);
    followMe = true;
    if (actRouteLine) actRouteLine.setLatLngs([]);
    renderSplits();
    startGpsWatch();
    if (lastFix && Date.now() - lastFix.t < 10000) addTrackPoint(lastFix);
    startTicker();
    requestWakeLock();
    playBeep(880, 0.15);
    updateActControls();
    persistActive();
    showToast(`Bắt đầu ${ACT_TYPES[act.type].name}. Giữ màn hình mở để GPS ghi liên tục.`, 'info');
};

window.togglePauseActivity = function () {
    if (!act) return;
    if (act.status === 'running') {
        act.status = 'paused';
        act.pausedAt = Date.now();
        act.last = null; // don't connect the gap distance after resuming
        playBeep(500, 0.12);
    } else {
        act.status = 'running';
        act.lastTick = Date.now();
        act.lastMoveTs = Date.now();
        playBeep(880, 0.12);
    }
    updateActControls();
    persistActive();
};

window.finishActivity = function () {
    if (!act) return;
    if (act.status === 'running') {
        act.status = 'paused';
        act.pausedAt = Date.now();
    }
    updateActControls();
    persistActive();
    openActivityModal(snapshotActivity(act), 'finish');
};

function snapshotActivity(a) {
    const movingS = Math.round(a.movingMs / 1000);
    const elapsedS = Math.round(((a.pausedAt || Date.now()) - a.startedAt) / 1000);
    return {
        clientId: a.clientId, type: a.type, startedAt: a.startedAt,
        movingS, elapsedS: Math.max(elapsedS, movingS),
        distance: Math.round(a.distance), elevGain: Math.round(a.elevGain),
        maxSpeed: Math.round(a.maxSpeed * 100) / 100,
        calories: caloriesFor(a.type, a.distance, movingS),
        splits: a.splits.slice(),
        route: a.points.map(p => [+p.lat.toFixed(6), +p.lon.toFixed(6), Math.round((p.t - a.startedAt) / 1000), p.alt === null ? null : Math.round(p.alt)]),
        synced: false
    };
}

function endActivity() {
    act = null;
    stopTicker();
    clearActive();
    if (!isCameraActive) releaseWakeLock();
    if ($('mode-gps').hidden) stopGpsWatch();
    if (actRouteLine) actRouteLine.setLatLngs([]);
    renderSplits();
    updateActControls();
    renderActStats();
}

function startTicker() {
    clearInterval(actTicker);
    actTicker = setInterval(tick, 1000);
    tick();
}
function stopTicker() { clearInterval(actTicker); actTicker = null; }

function isAutoPaused() {
    return act && act.status === 'running' && actSettings.autoPause && Date.now() - act.lastMoveTs > 10000;
}

function tick() {
    if (!act) return;
    const now = Date.now();
    if (act.status === 'running' && !isAutoPaused()) act.movingMs += now - act.lastTick;
    act.lastTick = now;
    if (act.status === 'running' && !wakeLock && document.visibilityState === 'visible') requestWakeLock();
    renderActStats();
    if (now % 5000 < 1000) persistActive();
}

// ---------- UI ----------
function renderActTypePicker() {
    $('act-type-picker').innerHTML = ACT_ORDER.map(k => {
        const t = ACT_TYPES[k];
        return `<button class="act-type-btn" data-type="${k}" onclick="selectActType('${k}')" aria-pressed="false">
            <i class="fa-solid ${t.icon}"></i><span>${t.name}</span></button>`;
    }).join('');
}

window.selectActType = function (type) {
    if (act) { showToast('Kết thúc hoạt động hiện tại trước khi đổi loại.', 'warn'); return; }
    actSettings.type = type;
    saveActSettings();
    document.querySelectorAll('.act-type-btn').forEach(b => {
        const on = b.dataset.type === type;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
    });
    renderActStats();
};

function renderActStats() {
    const type = act ? act.type : actSettings.type;
    const cfg = ACT_TYPES[type];
    const distance = act ? act.distance : 0;
    const movingS = act ? act.movingMs / 1000 : 0;
    const speed = act ? currentSpeed() : 0;
    const avgSpeed = movingS > 0 ? distance / movingS : 0;

    $('act-distance').textContent = fmtKm(distance);
    $('act-time').textContent = fmtDuration(movingS);
    if (cfg.pace) {
        $('act-speed-label').textContent = 'Pace hiện tại';
        $('act-speed').textContent = speed > 0.3 ? fmtPace(1000 / speed) : '--:--';
        $('act-speed-unit').textContent = '/km';
        $('act-avg-label').textContent = 'Pace TB';
        $('act-avg').textContent = distance > 50 ? fmtPace(movingS / (distance / 1000)) : '--:--';
        $('act-avg-unit').textContent = '/km';
    } else {
        $('act-speed-label').textContent = 'Tốc độ';
        $('act-speed').textContent = fmtSpeed(speed);
        $('act-speed-unit').textContent = 'km/h';
        $('act-avg-label').textContent = 'Tốc độ TB';
        $('act-avg').textContent = fmtSpeed(avgSpeed);
        $('act-avg-unit').textContent = 'km/h';
    }
    $('act-elev').textContent = act ? Math.round(act.elevGain) : 0;
    const cal = act ? caloriesFor(type, distance, movingS) : 0;
    $('act-cal').textContent = cfg.noCalories ? '--' : (cal || 0);

    const state = $('act-state');
    if (!act) { state.textContent = 'Sẵn sàng'; state.className = 'act-state'; }
    else if (act.status === 'paused') { state.textContent = 'Đã tạm dừng'; state.className = 'act-state paused'; }
    else if (isAutoPaused()) { state.textContent = 'Tự tạm dừng (đứng yên)'; state.className = 'act-state paused'; }
    else { state.textContent = `Đang ghi · ${cfg.name}`; state.className = 'act-state live'; }
}

function updateActControls() {
    const start = $('act-start'), pause = $('act-pause'), finish = $('act-finish');
    start.hidden = !!act;
    pause.hidden = !act;
    finish.hidden = !act;
    if (act) {
        pause.innerHTML = act.status === 'running'
            ? '<i class="fa-solid fa-pause"></i> <span>Tạm dừng</span>'
            : '<i class="fa-solid fa-play"></i> <span>Tiếp tục</span>';
    }
    renderActStats();
}

function renderSplits() {
    const panel = $('act-splits-panel');
    const splits = act ? act.splits : [];
    panel.hidden = !splits.length;
    $('act-splits').innerHTML = splitsHtml(splits, act ? act.type : actSettings.type);
}

function splitsHtml(splits, type) {
    if (!splits.length) return '';
    const pace = ACT_TYPES[type].pace;
    const best = Math.min(...splits.map(s => s.seconds));
    return splits.map(s => {
        const val = pace ? `${fmtPace(s.seconds)} /km` : `${fmtSpeed(1000 / s.seconds)} km/h`;
        const w = Math.max(15, Math.round(best / s.seconds * 100));
        return `<li><span class="sp-km">${s.km}</span><span class="sp-bar"><span style="width:${w}%"></span></span><span class="sp-val">${val}</span></li>`;
    }).join('');
}

// ---------- persistence of the in-progress activity ----------
function persistActive() {
    if (!act) return;
    try {
        const { recent, ...rest } = act;
        localStorage.setItem(ACT_ACTIVE_KEY, JSON.stringify({ ...rest, userId: sbUserId }));
    } catch (e) {}
}
function clearActive() { try { localStorage.removeItem(ACT_ACTIVE_KEY); } catch (e) {} }

function checkUnfinishedActivity() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ACT_ACTIVE_KEY) || 'null'); } catch (e) {}
    const banner = $('act-resume');
    if (!saved || saved.userId !== sbUserId || act) { banner.hidden = true; return; }
    $('act-resume-text').textContent =
        `Có ${ACT_TYPES[saved.type]?.name || 'hoạt động'} chưa kết thúc (${fmtKm(saved.distance)} km, ${fmtDuration(saved.movingMs / 1000)}).`;
    banner.hidden = false;
}

window.resumeUnfinished = function () {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ACT_ACTIVE_KEY) || 'null'); } catch (e) {}
    $('act-resume').hidden = true;
    if (!saved) return;
    act = { ...saved, recent: [], status: 'paused', last: null, pausedAt: saved.pausedAt || Date.now(), lastTick: Date.now() };
    delete act.userId;
    setMode('gps');
    selectActTypeUI(act.type);
    setTimeout(() => redrawRoute(true), 80);
    renderSplits();
    startTicker();
    updateActControls();
    showToast('Đã khôi phục. Bấm "Tiếp tục" để ghi tiếp.', 'info');
};

window.discardUnfinished = function () {
    clearActive();
    $('act-resume').hidden = true;
};

function selectActTypeUI(type) {
    document.querySelectorAll('.act-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

// ---------- saving & history ----------
const actCacheKey = () => `aiPoseFitness.activities.${sbUserId}`;

function loadActCache() {
    if (!sbUserId) return [];
    try { const d = JSON.parse(localStorage.getItem(actCacheKey()) || '[]'); return Array.isArray(d) ? d : []; } catch (e) { return []; }
}
function storeActCache(list) {
    if (!sbUserId) return;
    list.sort((a, b) => b.startedAt - a.startedAt);
    // keep routes only for unsynced items (synced ones are re-fetched on demand)
    const trimmed = list.slice(0, ACT_LIST_LIMIT).map(a => (a.synced ? { ...a, route: undefined } : a));
    try { localStorage.setItem(actCacheKey(), JSON.stringify(trimmed)); } catch (e) { console.warn('Activity cache full', e); }
}

const actToRow = (a) => ({
    user_id: sbUserId, client_id: a.clientId, activity_type: a.type,
    started_at: new Date(a.startedAt).toISOString(),
    moving_seconds: a.movingS, elapsed_seconds: a.elapsedS,
    distance_m: a.distance, elevation_gain_m: a.elevGain, max_speed_mps: a.maxSpeed,
    calories: a.calories, splits: a.splits, route: a.route || []
});
const ACT_SUMMARY_COLS = 'client_id, activity_type, started_at, moving_seconds, elapsed_seconds, distance_m, elevation_gain_m, max_speed_mps, calories, splits';
const actFromRow = (r) => ({
    clientId: Number(r.client_id), type: r.activity_type, startedAt: new Date(r.started_at).getTime(),
    movingS: r.moving_seconds, elapsedS: r.elapsed_seconds, distance: r.distance_m, elevGain: r.elevation_gain_m,
    maxSpeed: r.max_speed_mps, calories: r.calories, splits: r.splits || [], route: r.route, synced: true
});

async function saveActivity(summary) {
    const list = loadActCache().filter(a => a.clientId !== summary.clientId);
    list.unshift(summary);
    storeActCache(list);
    renderActList();
    if (!sb || !sbUserId) return;
    try {
        const { error } = await sb.from(ACT_TABLE).upsert(actToRow(summary), { onConflict: 'user_id,client_id' });
        if (error) throw error;
        storeActCache(loadActCache().map(a => (a.clientId === summary.clientId ? { ...a, synced: true } : a)));
        renderActList();
        showToast('Đã lưu hoạt động lên đám mây.', 'info');
    } catch (e) {
        console.warn('Activity upload failed', e);
        showToast('Đã lưu trên máy, sẽ đồng bộ khi có mạng.', 'warn');
    }
}

async function syncActivities() {
    if (!sb || !sbUserId) return;
    const uid = sbUserId;
    try {
        const pending = loadActCache().filter(a => !a.synced && a.route);
        if (pending.length) {
            const { error } = await sb.from(ACT_TABLE).upsert(pending.map(actToRow), { onConflict: 'user_id,client_id' });
            if (error) throw error;
        }
        const { data, error } = await sb.from(ACT_TABLE).select(ACT_SUMMARY_COLS)
            .order('started_at', { ascending: false }).limit(ACT_LIST_LIMIT);
        if (error) throw error;
        if (uid !== sbUserId) return;
        const remote = data.map(actFromRow);
        const stillPending = loadActCache().filter(a => !a.synced && a.route && !remote.some(r => r.clientId === a.clientId));
        storeActCache([...stillPending, ...remote]);
    } catch (e) {
        console.warn('Activity sync failed', e);
    }
    renderActList();
}

function renderActList() {
    const el = $('act-list');
    if (!sbUserId) { el.innerHTML = '<li class="history-empty">Đăng nhập để xem hoạt động.</li>'; return; }
    const list = loadActCache();
    if (!list.length) { el.innerHTML = '<li class="history-empty">Chưa có hoạt động nào. Bấm BẮT ĐẦU để ghi!</li>'; return; }
    el.innerHTML = list.map(a => {
        const cfg = ACT_TYPES[a.type] || ACT_TYPES.RUN;
        const d = new Date(a.startedAt);
        const when = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        const perf = cfg.pace
            ? `${a.distance > 50 ? fmtPace(a.movingS / (a.distance / 1000)) : '--:--'} /km`
            : `${fmtSpeed(a.movingS > 0 ? a.distance / a.movingS : 0)} km/h`;
        return `<li class="act-item" onclick="openActivityDetail(${a.clientId})" tabindex="0" role="button">
            <span class="h-name"><i class="fa-solid ${cfg.icon}"></i> ${cfg.name}</span>
            <span class="h-reps">${fmtKm(a.distance)} km</span>
            <span class="h-date">${when}${a.synced ? '' : ' <i class="fa-solid fa-cloud-arrow-up" title="Chưa đồng bộ"></i>'}</span>
            <span class="h-meta">${fmtDuration(a.movingS)} · ${perf}</span>
        </li>`;
    }).join('');
}

window.onActivitiesUserChanged = function () {
    if (!sbUserId && act) {
        // Signed out while recording: stop here but keep the saved copy so the
        // same user can resume it after signing back in
        act = null;
        stopTicker();
        stopGpsWatch();
        if (actRouteLine) actRouteLine.setLatLngs([]);
        renderSplits();
        updateActControls();
    }
    renderActList();
    checkUnfinishedActivity();
    if (sbUserId) {
        syncActivities();
        if (!$('mode-gps').hidden) startGpsWatch();
    }
};

// ---------- summary / detail modal ----------
let modalMode = 'detail';

function openActivityModal(a, mode) {
    modalMode = mode;
    detailActivity = a;
    const cfg = ACT_TYPES[a.type] || ACT_TYPES.RUN;
    const d = new Date(a.startedAt);
    $('act-modal-title').innerHTML = `<i class="fa-solid ${cfg.icon}"></i> ${cfg.name}`;
    $('act-modal-date').textContent = `${d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

    const avg = a.movingS > 0 ? a.distance / a.movingS : 0;
    const stats = [
        ['Quãng đường', `${fmtKm(a.distance)} km`],
        ['Thời gian di chuyển', fmtDuration(a.movingS)],
        cfg.pace ? ['Pace TB', `${a.distance > 50 ? fmtPace(a.movingS / (a.distance / 1000)) : '--:--'} /km`] : ['Tốc độ TB', `${fmtSpeed(avg)} km/h`],
        ['Tốc độ tối đa', `${fmtSpeed(a.maxSpeed || 0)} km/h`],
        ['Độ cao leo', `${Math.round(a.elevGain || 0)} m`],
        ['Calo', a.calories === null || a.calories === undefined ? '--' : `${a.calories} kcal`],
        ['Tổng thời gian', fmtDuration(a.elapsedS)]
    ];
    $('act-modal-stats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
    $('act-modal-splits').innerHTML = splitsHtml(a.splits || [], a.type);
    $('act-modal-splits-wrap').hidden = !(a.splits && a.splits.length);

    $('act-modal-save').hidden = mode !== 'finish';
    $('act-modal-discard').hidden = mode !== 'finish';
    $('act-modal-delete').hidden = mode === 'finish';
    $('act-modal-close').hidden = false;

    $('act-modal').hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => drawDetailMap(a.route), 30);
}

function drawDetailMap(route) {
    if (typeof L === 'undefined') return;
    if (!detailMap) {
        detailMap = L.map('act-modal-map', { zoomControl: true, attributionControl: true });
        detailTiles = makeTiles().addTo(detailMap);
    }
    detailMap.invalidateSize();
    detailMap.eachLayer(l => { if (l !== detailTiles) detailMap.removeLayer(l); });
    const pts = (route || []).map(r => [r[0], r[1]]);
    if (pts.length >= 2) {
        const line = L.polyline(pts, { color: '#FF5E3A', weight: 5 }).addTo(detailMap);
        L.circleMarker(pts[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#00C853', fillOpacity: 1 }).addTo(detailMap).bindTooltip('Bắt đầu');
        L.circleMarker(pts[pts.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#FF3B30', fillOpacity: 1 }).addTo(detailMap).bindTooltip('Kết thúc');
        detailMap.fitBounds(line.getBounds(), { padding: [24, 24] });
    } else if (pts.length === 1) {
        detailMap.setView(pts[0], 16);
        L.circleMarker(pts[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#FF5E3A', fillOpacity: 1 }).addTo(detailMap);
    } else {
        detailMap.setView([16.0, 106.0], 5);
    }
}

window.closeActModal = function () {
    $('act-modal').hidden = true;
    document.body.classList.remove('modal-open');
};

window.saveFinishedActivity = async function () {
    const a = detailActivity;
    closeActModal();
    endActivity();
    if (a.distance < 10 && a.movingS < 10) {
        showToast('Hoạt động quá ngắn, không lưu.', 'warn');
        return;
    }
    await saveActivity(a);
};

window.discardFinishedActivity = function () {
    closeActModal();
    endActivity();
    showToast('Đã bỏ hoạt động.', 'info');
};

window.openActivityDetail = async function (clientId) {
    const a = loadActCache().find(x => x.clientId === clientId);
    if (!a) return;
    openActivityModal({ ...a, route: a.route || [] }, 'detail');
    if (!a.route && sb && sbUserId) {
        const { data, error } = await sb.from(ACT_TABLE).select('route').eq('client_id', clientId).maybeSingle();
        if (!error && data && detailActivity && detailActivity.clientId === clientId) {
            detailActivity.route = data.route || [];
            drawDetailMap(detailActivity.route);
        }
    }
};

window.deleteActivity = async function () {
    const a = detailActivity;
    if (!a) return;
    const btn = $('act-modal-delete');
    if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Bấm lần nữa để xóa</span>';
        setTimeout(() => { btn.dataset.confirm = ''; btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa</span>'; }, 3000);
        return;
    }
    btn.dataset.confirm = '';
    btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa</span>';
    closeActModal();
    storeActCache(loadActCache().filter(x => x.clientId !== a.clientId));
    renderActList();
    if (sb && sbUserId) {
        const { error } = await sb.from(ACT_TABLE).delete().eq('client_id', a.clientId);
        if (error) console.warn('Delete failed', error);
    }
    showToast('Đã xóa hoạt động.', 'info');
};

// GPX export (works in Strava, Garmin, Google Earth...)
window.exportGpx = function () {
    const a = detailActivity;
    if (!a || !a.route || !a.route.length) { showToast('Chưa có dữ liệu tuyến đường.', 'warn'); return; }
    const cfg = ACT_TYPES[a.type];
    const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const pts = a.route.map(([lat, lon, t, alt]) =>
        `      <trkpt lat="${lat}" lon="${lon}">${alt !== null && alt !== undefined ? `<ele>${alt}</ele>` : ''}<time>${new Date(a.startedAt + t * 1000).toISOString()}</time></trkpt>`
    ).join('\n');
    const gpxType = { RUN: 'running', WALK: 'walking', RIDE: 'cycling', DRIVE: 'driving' }[a.type] || 'other';
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AI Pose Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(cfg.name)}</name><time>${new Date(a.startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${esc(cfg.name)} ${new Date(a.startedAt).toLocaleDateString('vi-VN')}</name>
    <type>${gpxType}</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const d = new Date(a.startedAt);
    link.href = url;
    link.download = `${a.type.toLowerCase()}-${d.toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ---------- settings & init ----------
function initActivityUI() {
    renderActTypePicker();
    selectActTypeUI(actSettings.type);
    const w = $('act-weight'), ap = $('act-autopause'), vk = $('act-voicekm');
    w.value = actSettings.weight;
    ap.checked = actSettings.autoPause;
    vk.checked = actSettings.voiceKm;
    w.addEventListener('change', () => {
        const v = Math.round(Number(w.value));
        actSettings.weight = v >= 20 && v <= 250 ? v : 60;
        w.value = actSettings.weight;
        saveActSettings();
        renderActStats();
    });
    ap.addEventListener('change', () => { actSettings.autoPause = ap.checked; saveActSettings(); });
    vk.addEventListener('change', () => { actSettings.voiceKm = vk.checked; saveActSettings(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('act-modal').hidden && modalMode !== 'finish') closeActModal();
    });

    updateActControls();
    renderActList();

    let mode = 'camera';
    try { mode = localStorage.getItem(MODE_KEY) || 'camera'; } catch (e) {}
    setMode(mode === 'gps' ? 'gps' : 'camera');
}

window.addEventListener('online', () => { if (sbUserId) syncActivities(); });
document.addEventListener('DOMContentLoaded', initActivityUI);
