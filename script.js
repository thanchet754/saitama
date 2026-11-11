// ==============================================================
// AI POSE FITNESS - LOGIC CONTROLLER (MediaPipe Skeleton AI)
// ==============================================================

const MEDIAPIPE_POSE_VERSION = '0.5.1675469404';
const HISTORY_KEY = 'aiPoseFitness.history';
const HISTORY_LIMIT = 20;
const VIS_THRESHOLD = 0.4;

// Exercise definitions & counting logic live in exercises.js

// App State
let currentExercise = 'SQUAT';
let selectedArmMode = 'BOTH';  // 'BOTH', 'RIGHT', 'LEFT'
let isCameraActive = false;
let isStarting = false;
let currentFacingMode = 'user';
let isVoiceEnabled = true;

// Workout Metrics
let repCount = 0;
let durationSeconds = 0;
let timerInterval = null;
let formScores = [];
let sessionId = Date.now();

// MediaPipe & WebRTC
let poseInstance = null;
let activeMediaStream = null;
let loopToken = 0;        // increments on every (re)start so stale loops exit
let wakeLock = null;
let audioCtx = null;

// UI Elements
const $ = (id) => document.getElementById(id);
const videoEl = $('video-element');
const canvasEl = $('output-canvas');
const canvasCtx = canvasEl.getContext('2d');
const stageEl = $('camera-stage');

// ==============================================================
// LIGHT / DARK THEME
// ==============================================================
const THEME_KEY = 'aiPoseFitness.theme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F2F4F8' : '#0D0E12');
    document.querySelectorAll('.theme-icon').forEach(i => {
        i.className = `fa-solid ${theme === 'light' ? 'fa-sun' : 'fa-moon'} theme-icon`;
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

window.toggleTheme = function () {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
};

applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

// Follow the system theme until the user picks one
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (e) => {
        let saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
        if (!saved) applyTheme(e.matches ? 'light' : 'dark');
    });
}

const placeholderEl = $('camera-placeholder');
const placeholderTitleEl = $('placeholder-title');
const placeholderTextEl = $('placeholder-text');
const loaderEl = $('camera-loader');
const loaderTextEl = $('loader-text');
const hudEl = $('stage-hud');

const repNumberEl = $('hud-rep-number');
const angleValEl = $('hud-angle-val');
const gaugeFillEl = $('gauge-fill');
const stageBadgeEl = $('hud-stage-label');
const feedbackPillEl = $('hud-feedback-pill');
const feedbackTextEl = $('hud-feedback-text');
const jointLabelEl = $('gauge-joint-label');
const targetTextEl = $('gauge-target-text');

const statusBadgeEl = $('ai-status-badge');
const statusTextEl = $('ai-status-text');

const btnToggleCamera = $('btn-toggle-camera');
const btnToggleVoice = $('btn-toggle-voice');

const statTimeEl = $('stat-time');
const statCalsEl = $('stat-cals');
const statAccuracyEl = $('stat-accuracy');
const armPickerRow = $('arm-picker-row');
const historyListEl = $('history-list');

// ==============================================================
// AUDIO & SPEECH FEEDBACK
// ==============================================================
function playBeep(freq = 700, duration = 0.1) {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.warn('Audio not available', e);
    }
}

function speakRep(number) {
    if (!isVoiceEnabled) return;
    if (NativeApp.speak(number, 1.2)) return; // Android app: native TTS
    if (!window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(number));
        utterance.lang = 'vi-VN';
        utterance.rate = 1.2;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('Speech synthesis error', e);
    }
}

// ==============================================================
// EXERCISE & ARM SELECTOR
// ==============================================================
function renderExercisePicker() {
    const picker = $('exercise-picker');
    picker.innerHTML = EXERCISE_ORDER.map(key => {
        const ex = EXERCISES[key];
        return `<button class="exercise-btn" data-ex="${key}" aria-pressed="false" onclick="selectExercise('${key}')">
            <span class="btn-icon-wrap"><i class="fa-solid ${ex.icon}"></i></span>
            <span class="btn-info"><span class="ex-name">${ex.name}</span><span class="ex-sub">${groupOf(key)}${ex.mode === 'hold' ? ' · tính giây' : ''}${ex.equipment === 'dumbbell' ? ' · <i class="fa-solid fa-dumbbell" title="Cần tạ"></i>' : ''}</span></span>
        </button>`;
    }).join('');
}

function renderGuide(cfg) {
    $('guide-list').innerHTML = `
        <li><strong>Đặt camera (${cfg.name}):</strong> ${cfg.view}</li>
        <li><strong>Kỹ thuật:</strong> ${cfg.tip}</li>
        <li><strong>Khoảng cách:</strong> Cách camera khoảng 1.5 - 2.5 mét để AI thấy đủ các khớp.</li>
        <li><strong>Ánh sáng:</strong> Đứng nơi đủ sáng, tránh ngược sáng, mặc đồ tương phản với nền.</li>`;
}

window.selectExercise = function (type) {
    if (!EXERCISES[type]) return;
    if (type !== currentExercise) {
        saveSession();   // save the finished exercise under ITS name...
        repCount = 0;    // ...so resetCounter() below doesn't re-save it under the new name
    }
    currentExercise = type;
    const cfg = EXERCISES[type];

    document.querySelectorAll('#exercise-picker .exercise-btn').forEach(btn => {
        const active = btn.dataset.ex === type;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active);
        if (active) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });

    armPickerRow.style.display = cfg.arm ? 'flex' : 'none';

    jointLabelEl.textContent = cfg.jointLabel;
    targetTextEl.textContent = `Chuẩn: ${cfg.dir === 'down' ? '<' : '>'} ${cfg.target}°`;
    $('hud-rep-label').textContent = cfg.mode === 'hold' ? 'GIÂY' : 'REPS';
    $('ws-ex-name').textContent = cfg.name;
    renderGuide(cfg);
    updateStartButton();
    if (window.DemoUI) DemoUI.refresh();

    resetCounter();
};

window.setArmMode = function (mode) {
    selectedArmMode = mode;
    document.querySelectorAll('.arm-btn').forEach(btn => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive);
    });
};

// ==============================================================
// MEDIAPIPE & CAMERA
// ==============================================================
async function getPoseModel() {
    if (poseInstance) return poseInstance;

    if (typeof window.Pose === 'undefined') {
        throw new Error('Thư viện AI chưa tải được. Vui lòng kiểm tra kết nối internet rồi tải lại trang.');
    }

    poseInstance = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MEDIAPIPE_POSE_VERSION}/${file}`
    });

    poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    poseInstance.onResults(onPoseResults);

    // Download & warm up the model before hiding the loader
    loaderTextEl.textContent = 'Đang tải mô hình AI (lần đầu có thể mất vài giây)...';
    await poseInstance.initialize();
    return poseInstance;
}

window.toggleCamera = async function () {
    if (isStarting) { // cancel while the camera / AI is still loading
        loopToken++;
        stopStream();
        loaderEl.style.display = 'none';
        exitWorkoutView();
        return;
    }
    if (!sbUserId && !isCameraActive) {
        showAuth('login');
        return;
    }
    if (isCameraActive) {
        if (window.Runner && Runner.active) Runner.quit(); // also turns the camera off
        else stopCamera();
    } else {
        await startCamera();
    }
};

// ---------- Full-screen, distraction-free workout view ----------
function updateStartButton() {
    if (isCameraActive || isStarting) return;
    const name = EXERCISES[currentExercise] ? EXERCISES[currentExercise].name : '';
    btnToggleCamera.innerHTML = `<i class="fa-solid fa-play"></i> <span>BẮT ĐẦU TẬP${name ? ' · ' + name.toUpperCase() : ''}</span>`;
}

const isPhoneLike = () => window.matchMedia('(pointer: coarse)').matches;

function enterWorkoutView() {
    if (document.body.classList.contains('workout-on')) return;
    document.body.classList.add('workout-on');
    window.scrollTo(0, 0);
    if (window.DemoUI) DemoUI.refresh();
    // Phones (browser only): hide the address bar and keep the current orientation
    if (isPhoneLike() && !NativeApp.isNative && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' })
            .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock(screen.orientation.type).catch(() => {}))
            .catch(() => {});
    }
}

function exitWorkoutView() {
    if (!document.body.classList.contains('workout-on')) return;
    document.body.classList.remove('workout-on');
    if (window.DemoUI) DemoUI.refresh();
    try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

function cameraErrorMessage(err) {
    if (!window.isSecureContext) return 'Camera chỉ hoạt động trên HTTPS hoặc localhost.';
    switch (err && err.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Bạn đã chặn quyền Camera. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ, cho phép Camera rồi thử lại.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'Không tìm thấy camera trên thiết bị này.';
        case 'NotReadableError':
            return 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
        default:
            return (err && err.message) || 'Đã có lỗi không xác định.';
    }
}

async function startCamera() {
    isStarting = true;
    const myToken = ++loopToken; // stops any previous loop
    enterWorkoutView();
    hudEl.style.display = 'none';
    loaderEl.style.display = 'flex';
    placeholderEl.style.display = 'none';
    loaderTextEl.textContent = 'Đang nạp Camera & Khung Xương AI...';
    statusTextEl.textContent = 'Đang nạp AI...';

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Trình duyệt không hỗ trợ camera. Hãy dùng Chrome, Edge hoặc Safari mới nhất.');
        }

        stopStream();

        loaderTextEl.textContent = 'Đang mở Camera...';
        // Full-screen view: ask for a stream shaped like the screen (9:16 on a portrait
        // phone) so it fills the display with as little cropping as possible
        const portrait = isPortraitScreen();
        activeMediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacingMode,
                width: { ideal: portrait ? 720 : 1280 },
                height: { ideal: portrait ? 1280 : 720 },
                aspectRatio: { ideal: portrait ? 9 / 16 : 16 / 9 }
            },
            audio: false
        });
        if (myToken !== loopToken) { stopStream(); return; } // cancelled meanwhile
        videoEl.srcObject = activeMediaStream;
        await videoEl.play();

        syncCanvasSize();

        await getPoseModel();
        if (myToken !== loopToken) { stopStream(); return; } // cancelled / superseded

        isCameraActive = true;
        if (repCount === 0) sessionId = Date.now(); // session starts when training starts
        loaderEl.style.display = 'none';
        hudEl.style.display = 'flex';

        btnToggleCamera.innerHTML = '<i class="fa-solid fa-xmark"></i> <span>Thoát</span>';
        btnToggleCamera.classList.add('running');

        statusBadgeEl.className = 'status-badge running';
        statusTextEl.textContent = 'AI Đang Hoạt Động';

        // Unlock audio on this user gesture (iOS needs it)
        playBeep(1, 0.01);

        requestWakeLock();
        startTimer();
        runVideoLoop(myToken);
    } catch (err) {
        console.error('Camera error:', err);
        stopStream();
        isCameraActive = false;
        loaderEl.style.display = 'none';
        if (myToken === loopToken) {
            exitWorkoutView();
            showToast(cameraErrorMessage(err), 'error');
        }
    } finally {
        isStarting = false;
    }
}

function stopStream() {
    if (activeMediaStream) {
        activeMediaStream.getTracks().forEach(t => t.stop());
        activeMediaStream = null;
    }
    videoEl.srcObject = null;
}

function stopCamera() {
    if (typeof isRecording !== 'undefined' && isRecording) stopRecording();
    loopToken++;
    isCameraActive = false;
    stopTimer();
    stopStream();
    releaseWakeLock();
    saveSession();

    hudEl.style.display = 'none';
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    stageEl.style.removeProperty('--stage-ratio');

    btnToggleCamera.classList.remove('running');
    updateStartButton();
    exitWorkoutView();

    statusBadgeEl.className = 'status-badge ready';
    statusTextEl.textContent = 'AI Đã Sẵn Sàng';
}

function showPlaceholder(title, html, isError = false) {
    placeholderTitleEl.textContent = title;
    placeholderTextEl.innerHTML = html;
    placeholderEl.classList.toggle('error', isError);
    placeholderEl.style.display = 'flex';
}

window.flipCamera = async function () {
    if (isStarting) return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (isCameraActive) {
        stopTimer();
        await startCamera();
    }
};

window.toggleVoice = function () {
    isVoiceEnabled = !isVoiceEnabled;
    btnToggleVoice.classList.toggle('active', isVoiceEnabled);
    btnToggleVoice.setAttribute('aria-pressed', isVoiceEnabled);
    btnToggleVoice.innerHTML = `<i class="fa-solid ${isVoiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i> <span>Giọng: ${isVoiceEnabled ? 'BẬT' : 'TẮT'}</span>`;
};

window.resetCounter = function () {
    saveSession();
    sessionId = Date.now();
    repCount = 0;
    durationSeconds = 0;
    formScores = [];
    resetExerciseState();

    repNumberEl.textContent = '0';
    statTimeEl.textContent = '00:00';
    $('ws-time').textContent = '00:00';
    statCalsEl.textContent = '0 kcal';
    statAccuracyEl.textContent = '--';
    gaugeFillEl.style.width = '0%';
    angleValEl.textContent = '--°';
    stageBadgeEl.textContent = EXERCISES[currentExercise].restLabel;
};

// Frame loop: one in-flight frame at a time, exits when its token is stale
async function runVideoLoop(token) {
    if (token !== loopToken || !isCameraActive) return;

    if (videoEl.readyState >= 2 && poseInstance) {
        try {
            await poseInstance.send({ image: videoEl });
        } catch (e) {
            console.warn('Pose frame issue', e);
        }
    }
    requestAnimationFrame(() => runVideoLoop(token));
}

// ==============================================================
// SCREEN WAKE LOCK (keeps phone screen on while training)
// ==============================================================
async function requestWakeLock() {
    if (NativeApp.keepAwake(true)) { wakeLock = wakeLock || { native: true, release: async () => NativeApp.keepAwake(false) }; return; }
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (e) {
        console.warn('Wake lock unavailable', e);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isCameraActive) requestWakeLock();
});

// ==============================================================
// POSE RESULTS & DRAWING
// ==============================================================
const isMirrored = () => currentFacingMode === 'user';

// Convert normalized landmark to canvas pixel (handles mirroring)
function toPx(p, width, height) {
    const x = isMirrored() ? 1 - p.x : p.x;
    return { x: x * width, y: p.y * height };
}

const isVisible = (p) => !!p && (p.visibility ?? 1) > VIS_THRESHOLD;

function isPortraitScreen() {
    return window.matchMedia('(orientation: portrait)').matches && window.innerWidth <= 820;
}

// Match canvas resolution + stage shape to the real video (handles rotation)
function syncCanvasSize() {
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    if (canvasEl.width !== w || canvasEl.height !== h) {
        canvasEl.width = w;
        canvasEl.height = h;
    }
    stageEl.style.setProperty('--stage-ratio', `${w} / ${h}`);
}

function onPoseResults(results) {
    if (!isCameraActive) return;
    renderPoseFrame(results);
    if (typeof composeRecordingFrame === 'function') composeRecordingFrame();
}

function renderPoseFrame(results) {
    if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) syncCanvasSize();

    const width = canvasEl.width;
    const height = canvasEl.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);
    if (isMirrored()) {
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
    }
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    if (!results.poseLandmarks) {
        setFeedback('Đứng vào khung hình', 'ready');
        return;
    }

    const lm = results.poseLandmarks;
    drawNeonSkeleton(canvasCtx, lm, width, height);

    processExercise(lm, width, height);
}

const SKELETON_PAIRS = [
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24],
    [23, 24],
    [23, 25], [25, 27],
    [24, 26], [26, 28]
];
const SKELETON_JOINTS = [...new Set(SKELETON_PAIRS.flat())];

function drawNeonSkeleton(ctx, lm, width, height) {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00F2FE';
    ctx.strokeStyle = '#00F2FE';

    SKELETON_PAIRS.forEach(([i, j]) => {
        if (isVisible(lm[i]) && isVisible(lm[j])) {
            const a = toPx(lm[i], width, height);
            const b = toPx(lm[j], width, height);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    });

    SKELETON_JOINTS.forEach(idx => {
        if (!isVisible(lm[idx])) return;
        const { x, y } = toPx(lm[idx], width, height);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#00F2FE';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
    });
    ctx.restore();
}

// Angle at vertex B formed by A-B-C (degrees)
function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 180;
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(rad * 180.0 / Math.PI);
    if (deg > 180.0) deg = 360.0 - deg;
    return Math.round(deg);
}

function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawJointAngleLabel(ctx, x, y, angle, isTargetReached) {
    const color = isTargetReached ? '#00E676' : '#FF9500';
    ctx.save();
    const text = `${angle}°`;
    ctx.font = 'bold 15px Outfit, sans-serif';
    const textWidth = ctx.measureText(text).width;

    // Keep the bubble inside the canvas
    const boxW = textWidth + 14;
    const boxX = Math.min(x + 10, ctx.canvas.width - boxW - 4);

    ctx.fillStyle = 'rgba(13, 14, 18, 0.85)';
    ctx.beginPath();
    roundRectPath(ctx, boxX, y - 13, boxW, 24, 12);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = isTargetReached ? color : '#FFFFFF';
    ctx.fillText(text, boxX + 7, y + 4);

    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

// Pick the joint angle to track from left/right sides
function pickSide(lm, leftIdx, rightIdx, mode) {
    const left = { pts: leftIdx.map(i => lm[i]) };
    const right = { pts: rightIdx.map(i => lm[i]) };
    [left, right].forEach(s => {
        s.vis = s.pts.reduce((sum, p) => sum + (p?.visibility ?? 0), 0) / 3;
        s.angle = calculateAngle(...s.pts);
        s.vertex = s.pts[1];
        s.ok = s.vis >= VIS_THRESHOLD;
    });

    if (mode === 'LEFT') return left.ok ? left : null;
    if (mode === 'RIGHT') return right.ok ? right : null;
    if (left.ok && right.ok) return left.angle <= right.angle ? left : right;
    if (left.ok) return left;
    if (right.ok) return right;
    return null;
}

// ==============================================================
// UI HELPERS
// ==============================================================
let lastFeedback = '';
function setFeedback(text, status = 'ready') {
    const key = status + text;
    if (key === lastFeedback) return; // avoid DOM writes every frame
    lastFeedback = key;
    feedbackTextEl.textContent = text;
    feedbackPillEl.className = `hud-feedback-pill ${status}`;
}

function triggerRepAnimation() {
    repNumberEl.textContent = repCount;
    repNumberEl.classList.remove('pop-anim');
    void repNumberEl.offsetWidth; // restart animation
    repNumberEl.classList.add('pop-anim');
    setTimeout(() => repNumberEl.classList.remove('pop-anim'), 250);
}

function averageForm() {
    if (!formScores.length) return null;
    return Math.round(formScores.reduce((a, b) => a + b, 0) / formScores.length);
}

function updateStatsDisplay() {
    repNumberEl.textContent = repCount;
    const cals = Math.round(repCount * EXERCISES[currentExercise].kcal * 10) / 10;
    statCalsEl.textContent = `${cals} kcal`;
    const avg = averageForm();
    statAccuracyEl.textContent = avg === null ? '--' : `${avg}%`;
    if (window.Runner) Runner.onProgress();
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        durationSeconds++;
        statTimeEl.textContent = formatTime(durationSeconds);
        $('ws-time').textContent = formatTime(durationSeconds);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ==============================================================
// ACCOUNT (Supabase Auth) & WORKOUT HISTORY (cloud + local cache)
// ==============================================================
// The anon key is public by design; data is protected by Row Level Security.
const SUPABASE_URL = 'https://lhsgdulyyssrcicwhdhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc2dkdWx5eXNzcmNpY3doZGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTgxMDYsImV4cCI6MjA5MjkzNDEwNn0.9cXMTwNBmoJHnyvRezP1qivatXEDT-b58nW82c9i_Ng';
const SESSIONS_TABLE = 'workout_sessions';

let sb = null;          // Supabase client
let sbUser = null;      // signed-in user
let sbUserId = null;
let authMode = 'login'; // 'login' | 'signup' | 'forgot' | 'reset'

const syncStatusEl = $('sync-status');
const authOverlayEl = $('auth-overlay');
const authFormEl = $('auth-form');
const authTitleEl = $('auth-title');
const authSubtitleEl = $('auth-subtitle');
const authEmailEl = $('auth-email');
const authPasswordEl = $('auth-password');
const authEmailRow = $('auth-email-row');
const authPasswordRow = $('auth-password-row');
const authMsgEl = $('auth-msg');
const authSubmitEl = $('auth-submit');
const authLoadingEl = $('auth-loading');
const authBodyEl = $('auth-body');
const authGoogleBlock = $('auth-google-block');
const authSwitchEl = $('auth-switch');
const authForgotLink = $('auth-forgot-link');
const accountBarEl = $('account-bar');
const accountEmailEl = $('account-email');

function setSyncStatus(state, text) {
    syncStatusEl.className = `sync-status ${state}`;
    const icon = state === 'cloud' ? 'fa-cloud' : state === 'syncing' ? 'fa-arrows-rotate fa-spin' : 'fa-cloud-arrow-up';
    syncStatusEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${text}</span>`;
}

// ---------- Auth UI ----------
const AUTH_TEXT = {
    login:  { title: 'Đăng Nhập', sub: 'Đăng nhập để lưu và xem lại lịch sử tập luyện trên mọi thiết bị.', submit: 'ĐĂNG NHẬP', pwAuto: 'current-password' },
    signup: { title: 'Tạo Tài Khoản', sub: 'Đăng ký miễn phí, dùng ngay không cần xác nhận email.', submit: 'ĐĂNG KÝ', pwAuto: 'new-password' },
    forgot: { title: 'Quên Mật Khẩu', sub: 'Nhập email, chúng tôi sẽ gửi link đặt lại mật khẩu.', submit: 'GỬI LINK ĐẶT LẠI', pwAuto: 'off' },
    reset:  { title: 'Đặt Mật Khẩu Mới', sub: 'Nhập mật khẩu mới cho tài khoản của bạn.', submit: 'LƯU MẬT KHẨU', pwAuto: 'new-password' }
};

function setAuthMessage(text, type = 'error') {
    authMsgEl.textContent = text || '';
    authMsgEl.className = `auth-msg ${type}`;
}

window.setAuthMode = function (mode) {
    authMode = mode;
    const t = AUTH_TEXT[mode];
    authTitleEl.textContent = t.title;
    authSubtitleEl.textContent = t.sub;
    authSubmitEl.textContent = t.submit;
    authPasswordEl.autocomplete = t.pwAuto;
    authEmailRow.hidden = mode === 'reset';
    authPasswordRow.hidden = mode === 'forgot';
    authForgotLink.hidden = mode !== 'login';
    authGoogleBlock.hidden = !(mode === 'login' || mode === 'signup') || !googleEnabled;
    authSwitchEl.innerHTML = mode === 'login'
        ? 'Chưa có tài khoản? <a href="#" onclick="setAuthMode(\'signup\');return false;">Đăng ký</a>'
        : mode === 'reset' ? ''
        : 'Đã có tài khoản? <a href="#" onclick="setAuthMode(\'login\');return false;">Đăng nhập</a>';
    setAuthMessage('');
};

function showAuth(mode = 'login') {
    authLoadingEl.hidden = true;
    authBodyEl.hidden = false;
    setAuthMode(mode);
    authOverlayEl.hidden = false;
    document.body.classList.add('auth-open');
    setTimeout(() => (mode === 'reset' ? authPasswordEl : authEmailEl).focus(), 50);
}

function hideAuth() {
    authOverlayEl.hidden = true;
    document.body.classList.remove('auth-open');
}

function showAuthFatal(text) {
    authOverlayEl.hidden = false;
    authBodyEl.hidden = true;
    authLoadingEl.hidden = false;
    authLoadingEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><p>${text}</p>
        <button class="btn btn-primary" onclick="location.reload()">Tải lại trang</button>`;
}

function translateAuthError(err) {
    const msg = (err && (err.message || err.error_description)) || '';
    const code = err && err.code;
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu.';
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'Email này đã có tài khoản. Hãy đăng nhập.';
    if (code === 'weak_password' || /password should be/i.test(msg)) return 'Mật khẩu quá yếu (tối thiểu 6 ký tự).';
    if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'Email không hợp lệ.';
    if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) return 'Gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
    if (code === 'same_password') return 'Mật khẩu mới phải khác mật khẩu cũ.';
    if (/fetch|network/i.test(msg)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    return msg || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!sb) return;
    const email = authEmailEl.value.trim();
    const password = authPasswordEl.value;
    setAuthMessage('');
    authSubmitEl.disabled = true;
    const label = authSubmitEl.textContent;
    authSubmitEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        if (authMode === 'login') {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else if (authMode === 'signup') {
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            // An existing (already confirmed) email returns a user with no identities
            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                throw { code: 'user_already_exists' };
            }
            if (!data.session) {
                setAuthMessage('Đã gửi email xác nhận. Hãy mở email để kích hoạt tài khoản.', 'success');
            }
        } else if (authMode === 'forgot') {
            const { error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: location.origin + location.pathname
            });
            if (error) throw error;
            setAuthMessage('Đã gửi link đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục Spam).', 'success');
        } else if (authMode === 'reset') {
            const { error } = await sb.auth.updateUser({ password });
            if (error) throw error;
            authPasswordEl.value = '';
            hideAuth();
        }
    } catch (err) {
        setAuthMessage(translateAuthError(err));
    } finally {
        authSubmitEl.disabled = false;
        authSubmitEl.textContent = label;
    }
}

let googleEnabled = false;

window.signInWithGoogle = async function () {
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname }
    });
    if (error) setAuthMessage(translateAuthError(error));
};

window.toggleAccountMenu = function () {
    accountBarEl.classList.toggle('open');
};
document.addEventListener('click', (e) => {
    if (!accountBarEl.classList.contains('open')) return;
    if (!e.target.closest('#account-bar, #account-btn')) accountBarEl.classList.remove('open');
});

window.signOut = async function () {
    if (isCameraActive) stopCamera(); // also saves the current session
    else saveSession();
    if (sb) await sb.auth.signOut();
};

function onUserChanged(user) {
    const prevId = sbUserId;
    sbUser = user;
    sbUserId = user ? user.id : null;

    $('account-btn').hidden = !user;
    accountBarEl.classList.remove('open');
    if (user) {
        accountEmailEl.textContent = user.email || 'Tài khoản';
        accountBarEl.hidden = false;
        if (authMode !== 'reset') hideAuth();
        if (prevId !== sbUserId) {
            renderHistory();
            syncHistory();
            if (window.onActivitiesUserChanged) onActivitiesUserChanged();
            if (window.onProgramsUserChanged) onProgramsUserChanged();
        }
    } else {
        if (isCameraActive) stopCamera();
        accountBarEl.hidden = true;
        repCount = 0; // don't carry an unsaved count into the next account
        resetCounter();
        renderHistory();
        setSyncStatus('local', 'Chưa đăng nhập');
        if (window.onActivitiesUserChanged) onActivitiesUserChanged();
        if (window.onProgramsUserChanged) onProgramsUserChanged();
        showAuth('login');
    }
}

async function initAuth() {
    if (!window.supabase || !window.supabase.createClient) {
        showAuthFatal('Không tải được hệ thống đăng nhập. Kiểm tra kết nối internet.');
        return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    authFormEl.addEventListener('submit', handleAuthSubmit);

    // Show the Google button only when the provider is enabled in Supabase
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
        .then(r => r.json())
        .then(s => {
            googleEnabled = !!(s.external && s.external.google);
            if (!authOverlayEl.hidden && !authBodyEl.hidden) setAuthMode(authMode);
        })
        .catch(() => {});

    // Use the remembered account right away: offline, Supabase retries the token
    // refresh for up to ~30s before reporting INITIAL_SESSION
    const remembered = storedUser();
    if (remembered) onUserChanged(remembered);

    // Fires INITIAL_SESSION on load (session is remembered in this browser)
    sb.auth.onAuthStateChange((event, session) => {
        // Defer: Supabase recommends not awaiting other calls inside this callback
        setTimeout(() => {
            if (event === 'PASSWORD_RECOVERY') {
                onUserChanged(session ? session.user : null);
                showAuth('reset');
                return;
            }
            // Offline with an expired token Supabase can't refresh and reports no
            // session; keep the remembered user so the app still works offline.
            // The stored token stays put and is refreshed once the network is back.
            const user = session ? session.user : (event !== 'SIGNED_OUT' ? storedUser() : null);
            onUserChanged(user);
        }, 0);
    });
}

function storedUser() {
    try {
        const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
        const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null');
        return (s && s.user && s.refresh_token) ? s.user : null;
    } catch (e) { return null; }
}

// ---------- History storage (per-user local cache) ----------
const historyKey = () => `${HISTORY_KEY}.${sbUserId}`;

function loadHistory() {
    if (!sbUserId) return [];
    try {
        const data = JSON.parse(localStorage.getItem(historyKey()) || '[]');
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function storeHistory(history) {
    if (!sbUserId) return;
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    try {
        localStorage.setItem(historyKey(), JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    } catch (e) {
        console.warn('Cannot save history', e);
    }
}

const toRow = (h) => ({
    user_id: sbUserId,
    client_id: h.id,
    exercise: h.exercise,
    reps: h.reps,
    duration_seconds: h.duration || 0,
    form_score: h.form,
    performed_at: h.date
});

const fromRow = (r) => ({
    id: Number(r.client_id),
    exercise: r.exercise,
    reps: r.reps,
    duration: r.duration_seconds,
    form: r.form_score,
    date: r.performed_at,
    synced: true
});

// Push unsynced local entries, then load the latest from the cloud
async function syncHistory() {
    if (!sb || !sbUserId) return;
    const userAtStart = sbUserId;
    setSyncStatus('syncing', 'Đang đồng bộ...');
    try {
        const pending = loadHistory().filter(h => !h.synced);
        if (pending.length) {
            const { error } = await sb.from(SESSIONS_TABLE)
                .upsert(pending.map(toRow), { onConflict: 'user_id,client_id' });
            if (error) throw error;
        }
        const { data, error } = await sb.from(SESSIONS_TABLE)
            .select('client_id, exercise, reps, duration_seconds, form_score, performed_at')
            .order('performed_at', { ascending: false })
            .limit(HISTORY_LIMIT);
        if (error) throw error;
        if (userAtStart !== sbUserId) return; // user switched meanwhile

        const stillPending = loadHistory().filter(h => !h.synced && !data.some(r => Number(r.client_id) === h.id));
        storeHistory([...stillPending, ...data.map(fromRow)]);
        renderHistory();
        setSyncStatus(stillPending.length ? 'local' : 'cloud', stillPending.length ? 'Chờ đồng bộ' : 'Đã lưu đám mây');
    } catch (e) {
        console.warn('Sync failed', e);
        setSyncStatus('local', 'Chờ đồng bộ');
    }
}

async function pushEntry(entry) {
    if (!sb || !sbUserId) return;
    const uid = sbUserId;
    try {
        const { error } = await sb.from(SESSIONS_TABLE)
            .upsert(toRow(entry), { onConflict: 'user_id,client_id' });
        if (error) throw error;
        if (uid !== sbUserId) return;
        storeHistory(loadHistory().map(h => (h.id === entry.id ? { ...h, synced: true } : h)));
        renderHistory();
        setSyncStatus('cloud', 'Đã lưu đám mây');
    } catch (e) {
        console.warn('Upload failed, will retry later', e);
        setSyncStatus('local', 'Chờ đồng bộ');
    }
}

function saveSession() {
    if (repCount <= 0 || !sbUserId) return;
    const entry = {
        id: sessionId,
        exercise: currentExercise,
        reps: repCount,
        duration: durationSeconds,
        form: averageForm(),
        date: new Date(sessionId).toISOString(),
        synced: false
    };
    const history = loadHistory().filter(h => h.id !== sessionId);
    history.unshift(entry);
    storeHistory(history);
    renderHistory();
    pushEntry(entry);
}

// (re-sync after reconnecting is handled in offline.js)

function renderHistory() {
    if (!sbUserId) {
        historyListEl.innerHTML = '<li class="history-empty">Đăng nhập để xem lịch sử tập luyện.</li>';
        return;
    }
    const history = loadHistory();
    if (!history.length) {
        historyListEl.innerHTML = '<li class="history-empty">Chưa có buổi tập nào. Bắt đầu ngay nhé!</li>';
        return;
    }
    historyListEl.innerHTML = history.map(h => {
        const d = new Date(h.date);
        const when = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        const name = EXERCISES[h.exercise]?.name || h.exercise;
        const icon = EXERCISES[h.exercise]?.icon || 'fa-dumbbell';
        return `<li>
            <span class="h-name"><i class="fa-solid ${icon}"></i> ${name}</span>
            <span class="h-reps">${h.reps} ${unitOf(h.exercise)}</span>
            <span class="h-meta">${formatTime(h.duration || 0)} · ${h.form ?? '--'}%</span>
            <span class="h-date">${when}${h.synced ? '' : ' <i class="fa-solid fa-cloud-arrow-up" title="Chưa đồng bộ"></i>'}</span>
        </li>`;
    }).join('');
}

window.clearHistory = async function () {
    if (!sbUserId || !loadHistory().length) return;
    try { localStorage.removeItem(historyKey()); } catch (e) {}
    renderHistory();
    if (sb) {
        const { error } = await sb.from(SESSIONS_TABLE).delete().eq('user_id', sbUserId);
        if (error) console.warn('Cloud delete failed', error);
    }
};

// Save progress if the page is closed mid-workout
window.addEventListener('pagehide', saveSession);

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    renderExercisePicker();
    selectExercise('SQUAT');
    renderHistory();
    initAuth();
});
