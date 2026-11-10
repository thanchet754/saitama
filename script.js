// ==============================================================
// AI POSE FITNESS - LOGIC CONTROLLER (MediaPipe Skeleton AI)
// ==============================================================

const MEDIAPIPE_POSE_VERSION = '0.5.1675469404';
const HISTORY_KEY = 'aiPoseFitness.history';
const HISTORY_LIMIT = 20;
const VIS_THRESHOLD = 0.4;

// Exercise configuration (thresholds in degrees)
const EXERCISES = {
    SQUAT: {
        name: 'Squat',
        jointLabel: 'Góc đầu gối',
        top: 160,        // standing straight
        target: 95,      // deep enough to count
        perfect: 90,     // "perfect depth" for form score
        gaugeStart: 170,
        restLabel: 'UP (ĐỨNG)',
        activeLabel: 'DOWN (ĐẠT)',
        kcalPerRep: 0.35
    },
    CURL: {
        name: 'Gập tạ',
        jointLabel: 'Góc khuỷu tay',
        top: 150,        // arm extended
        target: 48,      // peak flexion
        perfect: 45,
        gaugeStart: 155,
        restLabel: 'DOWN (DUỖI)',
        activeLabel: 'UP (ĐỈNH GẬP)',
        kcalPerRep: 0.30
    }
};

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

// Rep State Machine (shared by both exercises)
let repStage = 'REST';    // 'REST' (top position) or 'ACTIVE' (target reached)
let minAngleInRep = 180;

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
    if (!isVoiceEnabled || !window.speechSynthesis) return;
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
window.selectExercise = function (type) {
    if (!EXERCISES[type]) return;
    saveSession();
    currentExercise = type;
    const cfg = EXERCISES[type];

    $('btn-exercise-squat').classList.toggle('active', type === 'SQUAT');
    $('btn-exercise-curl').classList.toggle('active', type === 'CURL');
    $('btn-exercise-squat').setAttribute('aria-pressed', type === 'SQUAT');
    $('btn-exercise-curl').setAttribute('aria-pressed', type === 'CURL');

    armPickerRow.style.display = type === 'CURL' ? 'flex' : 'none';

    jointLabelEl.textContent = cfg.jointLabel;
    targetTextEl.textContent = `Chuẩn: < ${cfg.target}°`;

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
    if (isStarting) return;
    if (isCameraActive) {
        stopCamera();
    } else {
        await startCamera();
    }
};

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
        activeMediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });
        videoEl.srcObject = activeMediaStream;
        await videoEl.play();

        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 480;

        await getPoseModel();
        if (myToken !== loopToken) return; // superseded by another start/stop

        isCameraActive = true;
        if (repCount === 0) sessionId = Date.now(); // session starts when training starts
        loaderEl.style.display = 'none';
        hudEl.style.display = 'flex';

        btnToggleCamera.innerHTML = '<i class="fa-solid fa-stop"></i> <span>TẮT CAMERA / DỪNG</span>';
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
        showPlaceholder('Không Mở Được Camera', cameraErrorMessage(err), true);
        statusBadgeEl.className = 'status-badge error';
        statusTextEl.textContent = 'Lỗi Camera';
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
    loopToken++;
    isCameraActive = false;
    stopTimer();
    stopStream();
    releaseWakeLock();
    saveSession();

    showPlaceholder('Camera Đang Tắt', 'Bấm nút <strong>"BẬT CAMERA & BẮT ĐẦU"</strong> bên dưới để AI tự động vẽ khung xương và đếm số rep cho bạn!');
    hudEl.style.display = 'none';
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    btnToggleCamera.innerHTML = '<i class="fa-solid fa-play"></i> <span>BẬT CAMERA & BẮT ĐẦU</span>';
    btnToggleCamera.classList.remove('running');

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
    repStage = 'REST';
    minAngleInRep = 180;

    repNumberEl.textContent = '0';
    statTimeEl.textContent = '00:00';
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

function onPoseResults(results) {
    if (!isCameraActive) return;

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
        setFeedback('Không phát hiện người! Hãy đứng trước camera', 'ready');
        return;
    }

    const lm = results.poseLandmarks;
    drawNeonSkeleton(canvasCtx, lm, width, height);

    if (currentExercise === 'SQUAT') {
        processSquat(lm, width, height);
    } else {
        processBicepCurl(lm, width, height);
    }
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
// REP COUNTING (shared state machine)
// ==============================================================
function processRep(angle, msgs) {
    const cfg = EXERCISES[currentExercise];

    const pct = Math.max(0, Math.min(100, Math.round(((cfg.gaugeStart - angle) / (cfg.gaugeStart - cfg.target)) * 100)));
    angleValEl.textContent = `${angle}°`;
    gaugeFillEl.style.width = `${pct}%`;

    if (angle > cfg.top) {
        if (repStage === 'ACTIVE') {
            repCount++;
            repStage = 'REST';
            formScores.push(minAngleInRep <= cfg.perfect ? 100 : 80);
            updateStatsDisplay();
            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(repCount);
            setFeedback(msgs.counted(minAngleInRep), 'good');
            minAngleInRep = 180;
        } else {
            minAngleInRep = 180;
            setFeedback(msgs.rest, 'ready');
        }
        stageBadgeEl.textContent = cfg.restLabel;
    } else if (angle <= cfg.target) {
        repStage = 'ACTIVE';
        minAngleInRep = Math.min(minAngleInRep, angle);
        stageBadgeEl.textContent = cfg.activeLabel;
        setFeedback(msgs.reached, 'good');
    } else {
        minAngleInRep = Math.min(minAngleInRep, angle);
        if (repStage === 'REST') {
            setFeedback(msgs.deeper, 'warning');
        } else {
            setFeedback(msgs.returning, 'ready');
        }
    }
}

function processSquat(lm, width, height) {
    const side = pickSide(lm, [23, 25, 27], [24, 26, 28], 'BOTH');
    if (!side) {
        setFeedback('Hãy lùi lại để camera thấy từ hông tới bàn chân', 'ready');
        return;
    }
    const v = toPx(side.vertex, width, height);
    drawJointAngleLabel(canvasCtx, v.x, v.y, side.angle, side.angle <= EXERCISES.SQUAT.target);

    processRep(side.angle, {
        counted: (a) => `Tuyệt vời! +1 Rep (Sâu: ${a}°)`,
        rest: 'Đang đứng thẳng. Hãy ngồi xổm xuống!',
        reached: 'Đã đạt chuẩn sâu! Đứng thẳng dậy nào!',
        deeper: `Xuống sâu hơn nữa (< ${EXERCISES.SQUAT.target}°)!`,
        returning: 'Đứng thẳng hẳn lên để tính rep!'
    });
}

function processBicepCurl(lm, width, height) {
    const side = pickSide(lm, [11, 13, 15], [12, 14, 16], selectedArmMode);
    if (!side) {
        const which = selectedArmMode === 'LEFT' ? 'tay trái' : selectedArmMode === 'RIGHT' ? 'tay phải' : 'cánh tay';
        setFeedback(`Hãy đứng để camera thấy rõ ${which} và khuỷu tay`, 'ready');
        return;
    }
    const v = toPx(side.vertex, width, height);
    drawJointAngleLabel(canvasCtx, v.x, v.y, side.angle, side.angle <= EXERCISES.CURL.target);

    processRep(side.angle, {
        counted: (a) => `Chuẩn đỉnh! +1 Rep (Gập: ${a}°)`,
        rest: 'Tay duỗi thẳng. Gập tạ lên nào!',
        reached: 'Đã đạt đỉnh gập! Hạ tạ có kiểm soát!',
        deeper: `Gập cao hơn nữa (< ${EXERCISES.CURL.target}°)!`,
        returning: 'Duỗi thẳng tay hẳn xuống để tính rep!'
    });
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
    const cals = Math.round(repCount * EXERCISES[currentExercise].kcalPerRep * 10) / 10;
    statCalsEl.textContent = `${cals} kcal`;
    const avg = averageForm();
    statAccuracyEl.textContent = avg === null ? '--' : `${avg}%`;
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
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ==============================================================
// WORKOUT HISTORY (Supabase cloud + localStorage cache/offline)
// ==============================================================
// The anon key is public by design; data is protected by Row Level Security.
const SUPABASE_URL = 'https://lhsgdulyyssrcicwhdhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc2dkdWx5eXNzcmNpY3doZGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTgxMDYsImV4cCI6MjA5MjkzNDEwNn0.9cXMTwNBmoJHnyvRezP1qivatXEDT-b58nW82c9i_Ng';
const SESSIONS_TABLE = 'workout_sessions';

let sb = null;          // Supabase client
let sbUserId = null;    // set once signed in (anonymous)

const syncStatusEl = $('sync-status');

function setSyncStatus(state, text) {
    syncStatusEl.className = `sync-status ${state}`;
    const icon = state === 'cloud' ? 'fa-cloud' : state === 'syncing' ? 'fa-arrows-rotate fa-spin' : 'fa-cloud-arrow-up';
    syncStatusEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${text}</span>`;
}

function loadHistory() {
    try {
        const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function storeHistory(history) {
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
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

async function initCloud() {
    if (!window.supabase || !window.supabase.createClient) {
        setSyncStatus('local', 'Chỉ lưu trên máy');
        return;
    }
    try {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true }
        });
        let { data: { session } } = await sb.auth.getSession();
        if (!session) {
            const { data, error } = await sb.auth.signInAnonymously();
            if (error) throw error;
            session = data.session;
        }
        sbUserId = session.user.id;
        await syncHistory();
    } catch (e) {
        console.warn('Supabase unavailable, using local storage only', e);
        sb = null;
        sbUserId = null;
        setSyncStatus('local', 'Chỉ lưu trên máy');
    }
}

// Push unsynced local entries, then pull latest from cloud
async function syncHistory() {
    if (!sb || !sbUserId) return;
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
    try {
        const { error } = await sb.from(SESSIONS_TABLE)
            .upsert(toRow(entry), { onConflict: 'user_id,client_id' });
        if (error) throw error;
        storeHistory(loadHistory().map(h => (h.id === entry.id ? { ...h, synced: true } : h)));
        setSyncStatus('cloud', 'Đã lưu đám mây');
    } catch (e) {
        console.warn('Upload failed, will retry later', e);
        setSyncStatus('local', 'Chờ đồng bộ');
    }
}

function saveSession() {
    if (repCount <= 0) return;
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

window.addEventListener('online', syncHistory);

function renderHistory() {
    const history = loadHistory();
    if (!history.length) {
        historyListEl.innerHTML = '<li class="history-empty">Chưa có buổi tập nào. Bắt đầu ngay nhé!</li>';
        return;
    }
    historyListEl.innerHTML = history.map(h => {
        const d = new Date(h.date);
        const when = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        const name = EXERCISES[h.exercise]?.name || h.exercise;
        const icon = h.exercise === 'SQUAT' ? 'fa-person-arrow-down-to-line' : 'fa-dumbbell';
        return `<li>
            <span class="h-name"><i class="fa-solid ${icon}"></i> ${name}</span>
            <span class="h-reps">${h.reps} rep</span>
            <span class="h-meta">${formatTime(h.duration || 0)} · ${h.form ?? '--'}%</span>
            <span class="h-date">${when}${h.synced ? '' : ' <i class="fa-solid fa-cloud-arrow-up" title="Chưa đồng bộ"></i>'}</span>
        </li>`;
    }).join('');
}

window.clearHistory = async function () {
    if (!loadHistory().length) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
    renderHistory();
    if (sb && sbUserId) {
        const { error } = await sb.from(SESSIONS_TABLE).delete().eq('user_id', sbUserId);
        if (error) console.warn('Cloud delete failed', error);
    }
};

// Save progress if the page is closed mid-workout
window.addEventListener('pagehide', saveSession);

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    selectExercise('SQUAT');
    renderHistory();
    initCloud();
});
