// ==============================================================
// AI POSE FITNESS - LOGIC CONTROLLER (MediaPipe Skeleton AI)
// ==============================================================

// App Configuration & State
let currentExercise = 'SQUAT'; // 'SQUAT' or 'CURL'
let selectedArmMode = 'BOTH';  // 'BOTH', 'RIGHT', 'LEFT'
let isCameraActive = false;
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let isVoiceEnabled = true;

// Workout Metrics
let repCount = 0;
let durationSeconds = 0;
let timerInterval = null;
let formScores = []; // tracks depth quality of each rep

// Pose State Machine
let squatStage = 'UP'; // 'UP' or 'DOWN'
let squatMinAngle = 180;

let curlStage = 'DOWN'; // 'DOWN' or 'UP'
let curlMinAngle = 180;

// MediaPipe & WebRTC Stream
let poseInstance = null;
let activeMediaStream = null;
let animationFrameId = null;

// UI Elements Cache
const videoEl = document.getElementById('video-element');
const canvasEl = document.getElementById('output-canvas');
const canvasCtx = canvasEl.getContext('2d');

const placeholderEl = document.getElementById('camera-placeholder');
const loaderEl = document.getElementById('camera-loader');
const hudEl = document.getElementById('stage-hud');

const repNumberEl = document.getElementById('hud-rep-number');
const angleValEl = document.getElementById('hud-angle-val');
const gaugeFillEl = document.getElementById('gauge-fill');
const stageBadgeEl = document.getElementById('hud-stage-label');
const feedbackPillEl = document.getElementById('hud-feedback-pill');
const feedbackTextEl = document.getElementById('hud-feedback-text');
const jointLabelEl = document.getElementById('gauge-joint-label');
const targetTextEl = document.getElementById('gauge-target-text');

const statusBadgeEl = document.getElementById('ai-status-badge');
const statusTextEl = document.getElementById('ai-status-text');

const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnFlipCamera = document.getElementById('btn-flip-camera');
const btnToggleVoice = document.getElementById('btn-toggle-voice');

const statTimeEl = document.getElementById('stat-time');
const statCalsEl = document.getElementById('stat-cals');
const statAccuracyEl = document.getElementById('stat-accuracy');
const armPickerRow = document.getElementById('arm-picker-row');

// ==============================================================
// AUDIO & SPEECH SYNTHESIS FEEDBACK
// ==============================================================
function playBeep(freq = 700, duration = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        setTimeout(() => {
            osc.stop();
            audioCtx.close();
        }, duration * 1000);
    } catch (e) {
        console.warn("Audio Context not allowed or failed", e);
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
        console.warn("Speech synthesis error", e);
    }
}

// ==============================================================
// EXERCISE SELECTOR
// ==============================================================
window.selectExercise = function(type) {
    currentExercise = type;
    
    // Toggle active classes on buttons
    document.getElementById('btn-exercise-squat').classList.toggle('active', type === 'SQUAT');
    document.getElementById('btn-exercise-curl').classList.toggle('active', type === 'CURL');

    // Show arm selector only for Bicep Curl
    armPickerRow.style.display = type === 'CURL' ? 'flex' : 'none';

    // Update HUD target descriptions
    if (type === 'SQUAT') {
        jointLabelEl.textContent = "Góc đầu gối";
        targetTextEl.textContent = "Chuẩn: < 95°";
        stageBadgeEl.textContent = "UP (ĐỨNG)";
        squatStage = 'UP';
        squatMinAngle = 180;
    } else {
        jointLabelEl.textContent = "Góc khuỷu tay";
        targetTextEl.textContent = "Chuẩn: < 48°";
        stageBadgeEl.textContent = "DOWN (DUỖI)";
        curlStage = 'DOWN';
        curlMinAngle = 180;
    }

    resetCounter();
};

window.setArmMode = function(mode) {
    selectedArmMode = mode;
    document.querySelectorAll('.arm-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(mode === 'BOTH' ? '2 Tay' : (mode === 'RIGHT' ? 'Phải' : 'Trái')));
    });
};

// ==============================================================
// MEDIAPIPE INITIALIZATION & CAMERA WEBRTC
// ==============================================================
async function getPoseModel() {
    if (poseInstance) return poseInstance;

    if (typeof window.Pose === 'undefined') {
        throw new Error("Thư viện MediaPipe Pose chưa sẵn sàng. Vui lòng kiểm tra kết nối internet.");
    }

    poseInstance = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    poseInstance.setOptions({
        modelComplexity: 1, // 0: lite, 1: full (khuyên dùng cho browser)
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    poseInstance.onResults(onPoseResults);
    return poseInstance;
}

// Toggle Camera On/Off
window.toggleCamera = async function() {
    if (isCameraActive) {
        stopCamera();
    } else {
        await startCamera();
    }
};

async function startCamera() {
    loaderEl.style.display = 'flex';
    placeholderEl.style.display = 'none';
    statusTextEl.textContent = "Đang nạp AI...";

    try {
        await getPoseModel();

        if (activeMediaStream) {
            activeMediaStream.getTracks().forEach(t => t.stop());
        }

        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };

        activeMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = activeMediaStream;
        await videoEl.play();

        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 480;

        if (currentFacingMode === 'user') {
            canvasEl.classList.add('mirrored');
        } else {
            canvasEl.classList.remove('mirrored');
        }

        isCameraActive = true;
        loaderEl.style.display = 'none';
        hudEl.style.display = 'flex';

        btnToggleCamera.innerHTML = '<i class="fa-solid fa-stop"></i> <span>TẮT CAMERA / DỪNG</span>';
        btnToggleCamera.classList.add('running');

        statusBadgeEl.className = "status-badge running";
        statusTextEl.textContent = "AI Đang Hoạt Động";

        startTimer();
        runVideoLoop();
    } catch (err) {
        console.error("Camera error:", err);
        loaderEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
        statusTextEl.textContent = "Lỗi Camera";
        alert("Không thể mở Camera: " + (err.message || err.name) + "\nVui lòng cho phép quyền truy cập Camera trên trình duyệt!");
    }
}

function stopCamera() {
    isCameraActive = false;
    cancelAnimationFrame(animationFrameId);
    stopTimer();

    if (activeMediaStream) {
        activeMediaStream.getTracks().forEach(t => t.stop());
        activeMediaStream = null;
    }

    placeholderEl.style.display = 'flex';
    hudEl.style.display = 'none';
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    btnToggleCamera.innerHTML = '<i class="fa-solid fa-play"></i> <span>BẬT CAMERA & BẮT ĐẦU</span>';
    btnToggleCamera.classList.remove('running');

    statusBadgeEl.className = "status-badge ready";
    statusTextEl.textContent = "AI Đã Sẵn Sàng";
}

// Flip Camera (Front / Back)
window.flipCamera = async function() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (isCameraActive) {
        await startCamera();
    }
};

// Toggle Speech Voice
window.toggleVoice = function() {
    isVoiceEnabled = !isVoiceEnabled;
    btnToggleVoice.classList.toggle('active', isVoiceEnabled);
    btnToggleVoice.innerHTML = `<i class="fa-solid ${isVoiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i> <span>Giọng Đọc: ${isVoiceEnabled ? 'BẬT' : 'TẮT'}</span>`;
};

// Reset Counter
window.resetCounter = function() {
    repCount = 0;
    durationSeconds = 0;
    formScores = [];
    squatStage = 'UP';
    squatMinAngle = 180;
    curlStage = 'DOWN';
    curlMinAngle = 180;

    repNumberEl.textContent = "0";
    statTimeEl.textContent = "00:00";
    statCalsEl.textContent = "0 kcal";
    statAccuracyEl.textContent = "100%";
    gaugeFillEl.style.width = "0%";
    angleValEl.textContent = "180°";
};

// RequestAnimationFrame Frame Processing
async function runVideoLoop() {
    if (!isCameraActive) return;

    if (videoEl && videoEl.readyState >= 2 && poseInstance) {
        try {
            await poseInstance.send({ image: videoEl });
        } catch (e) {
            console.warn("Pose processing frame issue", e);
        }
    }
    animationFrameId = requestAnimationFrame(runVideoLoop);
}

// ==============================================================
// POSE RESULTS & SKELETON DRAWING
// ==============================================================
function onPoseResults(results) {
    if (!isCameraActive) return;

    const width = canvasEl.width;
    const height = canvasEl.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);

    // Draw camera image
    canvasCtx.drawImage(results.image, 0, 0, width, height);

    if (!results.poseLandmarks) {
        setFeedback("Không phát hiện người! Hãy đứng trước camera", "ready");
        canvasCtx.restore();
        return;
    }

    const lm = results.poseLandmarks;

    // Draw Glowing Neon Skeleton
    drawNeonSkeleton(canvasCtx, lm, width, height);

    // Process specific exercise counting
    if (currentExercise === 'SQUAT') {
        processSquat(lm, width, height);
    } else {
        processBicepCurl(lm, width, height);
    }

    canvasCtx.restore();
}

// Cyberpunk Neon Skeleton Drawing
function drawNeonSkeleton(ctx, lm, width, height) {
    const pairs = [
        [11, 12], // shoulders
        [11, 13], [13, 15], // left arm
        [12, 14], [14, 16], // right arm
        [11, 23], [12, 24], // torso
        [23, 24], // hips
        [23, 25], [25, 27], // left leg
        [24, 26], [26, 28]  // right leg
    ];

    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00F2FE';
    ctx.strokeStyle = '#00F2FE';

    pairs.forEach(([i, j]) => {
        const p1 = lm[i];
        const p2 = lm[j];
        if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
        }
    });

    // Draw dots at joints
    pairs.flat().forEach(idx => {
        const p = lm[idx];
        if (p && (p.visibility || 1) > 0.4) {
            const x = p.x * width;
            const y = p.y * height;

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#00F2FE';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
        }
    });
    ctx.restore();
}

// Vector Angle between 3 Points (A-B-C with B as vertex)
function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 180;
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(rad * 180.0 / Math.PI);
    if (deg > 180.0) deg = 360.0 - deg;
    return Math.round(deg);
}

// Draw Angle bubble directly on Canvas joint
function drawJointAngleLabel(ctx, x, y, angle, isTargetReached) {
    ctx.save();
    const text = `${angle}°`;
    ctx.font = 'bold 15px Outfit, sans-serif';
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = 'rgba(13, 14, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x + 10, y - 13, textWidth + 14, 24, 12);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isTargetReached ? '#00E676' : '#FF9500';
    ctx.stroke();

    ctx.fillStyle = isTargetReached ? '#00E676' : '#FFFFFF';
    ctx.fillText(text, x + 17, y + 4);

    // Glow on vertex joint
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = isTargetReached ? '#00E676' : '#FF9500';
    ctx.fill();
    ctx.restore();
}

// ==============================================================
// SQUAT COUNTING ALGORITHM
// ==============================================================
function processSquat(lm, width, height) {
    // Left leg: Hip (23), Knee (25), Ankle (27)
    // Right leg: Hip (24), Knee (26), Ankle (28)
    const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
    const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];

    const lVis = ((lHip?.visibility || 0) + (lKnee?.visibility || 0) + (lAnkle?.visibility || 0)) / 3;
    const rVis = ((rHip?.visibility || 0) + (rKnee?.visibility || 0) + (rAnkle?.visibility || 0)) / 3;

    if (lVis < 0.4 && rVis < 0.4) {
        setFeedback("Hãy lùi lại để camera thấy từ hông tới bàn chân", "ready");
        return;
    }

    const lAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rAngle = calculateAngle(rHip, rKnee, rAnkle);

    let currentAngle = 180;
    let activeKneePoint = null;

    if (lVis >= 0.4 && rVis >= 0.4) {
        currentAngle = Math.min(lAngle, rAngle);
        activeKneePoint = lAngle <= rAngle ? lKnee : rKnee;
    } else if (lVis >= 0.4) {
        currentAngle = lAngle;
        activeKneePoint = lKnee;
    } else {
        currentAngle = rAngle;
        activeKneePoint = rKnee;
    }

    if (activeKneePoint) {
        drawJointAngleLabel(canvasCtx, activeKneePoint.x * width, activeKneePoint.y * height, currentAngle, currentAngle <= 95);
    }

    // Gauge progress (170° = 0%, 95° = 100%)
    const pct = Math.max(0, Math.min(100, Math.round(((170 - currentAngle) / (170 - 95)) * 100)));
    angleValEl.textContent = `${currentAngle}°`;
    gaugeFillEl.style.width = `${pct}%`;

    // Squat State Machine
    if (currentAngle > 160) {
        // Standing Up
        if (squatStage === 'DOWN') {
            repCount++;
            squatStage = 'UP';
            
            const isGoodDepth = squatMinAngle <= 90;
            formScores.push(isGoodDepth ? 100 : 75);
            updateStatsDisplay();

            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(repCount);

            setFeedback(`Tuyệt vời! +1 Rep (Sâu: ${squatMinAngle}°)`, "good");
            squatMinAngle = 180;
        } else {
            stageBadgeEl.textContent = "UP (ĐỨNG)";
            setFeedback("Đang đứng thẳng. Hãy ngồi xổm xuống!", "ready");
        }
    } else if (currentAngle <= 95) {
        // Target Squat Depth Achieved!
        squatStage = 'DOWN';
        squatMinAngle = Math.min(squatMinAngle, currentAngle);
        stageBadgeEl.textContent = "DOWN (ĐẠT)";
        setFeedback("Đã đạt chuẩn sâu! Đứng thẳng dậy nào!", "good");
    } else {
        squatMinAngle = Math.min(squatMinAngle, currentAngle);
        if (squatStage === 'UP') {
            setFeedback("Xuống sâu hơn nữa (< 95°)!", "warning");
        }
    }
}

// ==============================================================
// BICEP CURL COUNTING ALGORITHM (Gập tạ tay)
// ==============================================================
function processBicepCurl(lm, width, height) {
    // Shoulder (11/12), Elbow (13/14), Wrist (15/16)
    const lSh = lm[11], lEl = lm[13], lWr = lm[15];
    const rSh = lm[12], rEl = lm[14], rWr = lm[16];

    const lVis = ((lSh?.visibility || 0) + (lEl?.visibility || 0) + (lWr?.visibility || 0)) / 3;
    const rVis = ((rSh?.visibility || 0) + (rEl?.visibility || 0) + (rWr?.visibility || 0)) / 3;

    if (lVis < 0.4 && rVis < 0.4) {
        setFeedback("Hãy đứng để camera thấy rõ cánh tay và khuỷu tay", "ready");
        return;
    }

    const lAngle = calculateAngle(lSh, lEl, lWr);
    const rAngle = calculateAngle(rSh, rEl, rWr);

    let currentAngle = 180;
    let activeElbowPoint = null;

    if (selectedArmMode === 'RIGHT') {
        currentAngle = rAngle;
        activeElbowPoint = rEl;
    } else if (selectedArmMode === 'LEFT') {
        currentAngle = lAngle;
        activeElbowPoint = lEl;
    } else {
        // BOTH
        if (lVis >= 0.4 && rVis >= 0.4) {
            currentAngle = Math.min(lAngle, rAngle);
            activeElbowPoint = lAngle <= rAngle ? lEl : rEl;
        } else if (rVis >= 0.4) {
            currentAngle = rAngle;
            activeElbowPoint = rEl;
        } else {
            currentAngle = lAngle;
            activeElbowPoint = lEl;
        }
    }

    if (activeElbowPoint) {
        drawJointAngleLabel(canvasCtx, activeElbowPoint.x * width, activeElbowPoint.y * height, currentAngle, currentAngle <= 48);
    }

    // Gauge (155° = 0%, 48° = 100%)
    const pct = Math.max(0, Math.min(100, Math.round(((155 - currentAngle) / (155 - 48)) * 100)));
    angleValEl.textContent = `${currentAngle}°`;
    gaugeFillEl.style.width = `${pct}%`;

    // Curl State Machine
    if (currentAngle > 150) {
        // Arm Extended (DOWN)
        if (curlStage === 'UP') {
            repCount++;
            curlStage = 'DOWN';

            const isPeakGood = curlMinAngle <= 45;
            formScores.push(isPeakGood ? 100 : 75);
            updateStatsDisplay();

            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(repCount);

            setFeedback(`Chuẩn đỉnh! +1 Rep (Gập: ${curlMinAngle}°)`, "good");
            curlMinAngle = 180;
        } else {
            stageBadgeEl.textContent = "DOWN (DUỖI)";
            setFeedback("Tay duỗi thẳng. Gập tạ lên nào!", "ready");
        }
    } else if (currentAngle <= 48) {
        // Peak flexion reached
        curlStage = 'UP';
        curlMinAngle = Math.min(curlMinAngle, currentAngle);
        stageBadgeEl.textContent = "UP (ĐỈNH GẬP)";
        setFeedback("Đã đạt đỉnh gập! Hạ tạ có kiểm soát!", "good");
    } else {
        curlMinAngle = Math.min(curlMinAngle, currentAngle);
        if (curlStage === 'DOWN') {
            setFeedback("Gập cao hơn nữa (< 48°)!", "warning");
        }
    }
}

// Helpers for UI & Animation
function setFeedback(text, status = 'ready') {
    feedbackTextEl.textContent = text;
    feedbackPillEl.className = `hud-feedback-pill ${status}`;
}

function triggerRepAnimation() {
    repNumberEl.textContent = repCount;
    repNumberEl.classList.add('pop-anim');
    setTimeout(() => {
        repNumberEl.classList.remove('pop-anim');
    }, 250);
}

function updateStatsDisplay() {
    repNumberEl.textContent = repCount;
    
    // Calorie formula (Squat ~ 0.35 cal/rep, Curl ~ 0.30 cal/rep)
    const factor = currentExercise === 'SQUAT' ? 0.35 : 0.30;
    const cals = Math.round(repCount * factor * 10) / 10;
    statCalsEl.textContent = `${cals} kcal`;

    if (formScores.length > 0) {
        const avg = Math.round(formScores.reduce((a, b) => a + b, 0) / formScores.length);
        statAccuracyEl.textContent = `${avg}%`;
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        durationSeconds++;
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        statTimeEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Initial Setup on load
document.addEventListener('DOMContentLoaded', () => {
    selectExercise('SQUAT');
});
