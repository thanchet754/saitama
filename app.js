// Supabase Initialization Credentials
const SUPABASE_URL = "https://oyqgpzgqmbfzrncnxedh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cWdwemdxbWJmenJuY254ZWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDE1MzQsImV4cCI6MjA5NzcxNzUzNH0.gHmcr_529fI8w6czHRyKIZpbkL4I24tHLy1hBK36LWM";

let supabase = null;
try {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error("Failed to initialize Supabase client", e);
}

// Translations
const translations = {
    vi: {
        home_greeting: "Chào Anh Hùng!",
        home_sub_greeting: "Hôm nay bạn đã sẵn sàng vượt qua giới hạn chưa?",
        quick_start: "Bắt đầu nhanh",
        btn_set_automatic: "Thử thách Saitama",
        daily_goals_title: "Mục tiêu hôm nay",
        ai_badge: "AI POSE SKELETON",
        ai_hero_title: "Đếm Bằng Khung Xương AI",
        ai_hero_desc: "Mở camera để AI tự vẽ khung xương, kiểm tra góc gập và đếm số rep tự động!",
        category_ai: "Bài Tập AI Camera (Khung Xương)",
        category_sensor: "Bài Tập Cảm Biến Bỏ Túi",
        ex_ai_squat: "Đứng lên ngồi xuống (Squat AI)",
        ex_ai_bicep_curl: "Gập tạ tay (Bicep Curl AI)",
        ai_squat_hint: "Đo góc khớp háng - đầu gối - cổ chân",
        ai_curl_hint: "Đo góc khuỷu tay trái, phải hoặc 2 tay",
        ex_squat: "Squat cảm biến",
        ex_crunch: "Gập bụng",
        ex_pushup: "Chống đẩy",
        ex_running: "Chạy bộ",
        ex_pullup: "Lên xà",
        ex_plank: "Plank",
        type_reps: "Đếm số lần",
        type_time: "Định vị GPS / Thời gian",
        nav_home: "Trang chủ",
        nav_workout: "Tập luyện",
        nav_history: "Lịch sử",
        nav_stats: "Thống kê",
        stats_records: "Kỷ lục cá nhân",
        stat_reps: "Số lần",
        stat_duration: "Thời gian",
        stat_calories: "Lượng Calo",
        stat_distance: "Quãng đường",
        sync_now: "Đồng bộ",
        weekly_summary: "Tổng kết tuần (kcal)",
        btn_cancel: "Hủy bỏ",
        btn_finish: "Hoàn thành",
        btn_start: "Bắt đầu",
        btn_save: "Lưu lại",
        set_goal_title: "Thiết lập mục tiêu ngày",
        permission_needed: "Ứng dụng cần quyền truy cập cảm biến chuyển động để đếm số lần tự động.",
        btn_grant: "Cho phép",
        guide_squat: "Cầm điện thoại trước ngực.",
        guide_crunch: "Đặt điện thoại trên ngực hoặc bụng.",
        guide_pushup: "Bỏ điện thoại vào túi quần hoặc đeo băng bắp tay.",
        guide_running: "Bỏ điện thoại vào túi quần.",
        guide_pullup: "Bỏ điện thoại vào túi quần.",
        guide_plank: "Đặt điện thoại bên cạnh bạn trên sàn.",
        streak_count: "Chuỗi tập: {streak} Ngày",
        today_progress_txt: "Hôm nay: Đã xong {done}/{total} bài tập",
    },
    en: {
        home_greeting: "Hello, Hero!",
        home_sub_greeting: "Ready to break your limits today?",
        quick_start: "Quick Start",
        btn_set_automatic: "Saitama Challenge",
        daily_goals_title: "Today's Goals",
        ai_badge: "AI POSE SKELETON",
        ai_hero_title: "AI Skeleton Rep Counter",
        ai_hero_desc: "Turn on your camera for real-time skeleton tracking, angle checking and automatic rep counting!",
        category_ai: "AI Camera (Pose Skeleton)",
        category_sensor: "Pocket Sensor Workouts",
        ex_ai_squat: "AI Squat (Pose Camera)",
        ex_ai_bicep_curl: "AI Bicep Curl (Pose Camera)",
        ai_squat_hint: "Tracks Hip - Knee - Ankle joint angles",
        ai_curl_hint: "Tracks Left, Right or Both Elbow angles",
        ex_squat: "Sensor Squat",
        ex_crunch: "Crunch",
        ex_pushup: "Push-up",
        ex_running: "Running",
        ex_pullup: "Pull-up",
        ex_plank: "Plank",
        type_reps: "Reps counting",
        type_time: "GPS / Time tracker",
        nav_home: "Home",
        nav_workout: "Workout",
        nav_history: "History",
        nav_stats: "Statistics",
        stats_records: "Personal Records",
        stat_reps: "Reps",
        stat_duration: "Duration",
        stat_calories: "Calories",
        stat_distance: "Distance",
        sync_now: "Sync Now",
        weekly_summary: "Weekly Summary (kcal)",
        btn_cancel: "Cancel",
        btn_finish: "Finish",
        btn_start: "Start",
        btn_save: "Save",
        set_goal_title: "Set Daily Goal",
        permission_needed: "Motion sensor access is required for automatic repetition counting.",
        btn_grant: "Grant Permission",
        guide_squat: "Hold phone in front of chest.",
        guide_crunch: "Place phone on your chest or stomach.",
        guide_pushup: "Place phone in your pocket or upper arm strap.",
        guide_running: "Put phone in your pocket.",
        guide_pullup: "Put phone in your pocket.",
        guide_plank: "Place phone beside you on the floor.",
        streak_count: "Streak: {streak} Days",
        today_progress_txt: "Today: {done}/{total} exercises completed",
    }
};

// Exercise metadata
const exerciseMetadata = {
    AI_SQUAT: { caloriesPerUnit: 0.35, isRep: true },
    AI_BICEP_CURL: { caloriesPerUnit: 0.30, isRep: true },
    SQUAT: { caloriesPerUnit: 0.32, isRep: true },
    CRUNCH: { caloriesPerUnit: 0.25, isRep: true },
    PUSH_UP: { caloriesPerUnit: 0.36, isRep: true },
    RUNNING: { caloriesPerUnit: 0.12, isRep: false }, // per second
    PULL_UP: { caloriesPerUnit: 0.98, isRep: true },
    PLANK: { caloriesPerUnit: 0.08, isRep: false } // per second
};

// Global App State
const state = {
    lang: localStorage.getItem("saitama_lang") || "vi",
    userId: getOrCreateUserId(),
    currentTab: "tab-home",
    
    // Database items
    goals: JSON.parse(localStorage.getItem("saitama_goals")) || [],
    sessions: JSON.parse(localStorage.getItem("saitama_sessions")) || [],
    
    // Active Accelerometer Workout state
    activeWorkout: null,
    
    // Sync state
    syncPending: false
};

// ==============================================================
// AUDIO FEEDBACK & TEXT-TO-SPEECH
// ==============================================================
function playBeep(frequency = 600, duration = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); 

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, duration * 1000);
    } catch (e) {
        console.warn("Audio Context beep failed", e);
    }
}

// Speak rep number using Web Speech Synthesis API
function speakCount(number) {
    if (!aiIsVoiceEnabled || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(number));
        utterance.lang = state.lang === 'vi' ? 'vi-VN' : 'en-US';
        utterance.rate = 1.15;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Speech synthesis error", e);
    }
}

// Speak voice feedback prompt
function speakFeedback(textVi, textEn) {
    if (!aiIsVoiceEnabled || !window.speechSynthesis) return;
    try {
        const text = state.lang === 'vi' ? textVi : textEn;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = state.lang === 'vi' ? 'vi-VN' : 'en-US';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Speech synthesis error", e);
    }
}

// Get/Create stable Device ID
function getOrCreateUserId() {
    let id = localStorage.getItem("saitama_user_id");
    if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("saitama_user_id", id);
    }
    return id;
}

// Format local date string (YYYY-MM-DD)
function getTodayDateString() {
    const d = new Date();
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

// ----------------------------------------------------
// TRANSLATION ENGINE
// ----------------------------------------------------
function updateLocalization() {
    const t = translations[state.lang];
    
    // Language toggle text
    document.getElementById("lang-toggle").textContent = state.lang === "vi" ? "EN" : "VI";
    
    // Apply static translation keys
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    // Home greeting & sub
    document.getElementById("home-title").textContent = t.home_greeting;
    document.getElementById("home-sub").textContent = t.home_sub_greeting;

    // Goals label dialog
    const goalInputLabel = document.getElementById("goal-input-label");
    if (goalInputLabel) {
        const activeType = document.querySelector(".exercise-btn-select.active")?.dataset.type || "SQUAT";
        goalInputLabel.textContent = activeType === "RUNNING" ? `${t.stat_distance} (m)` : (activeType === "PLANK" ? `${t.stat_duration} (s)` : `${t.stat_reps} (lần)`);
    }

    renderStreakCard();
    renderGoals();
    renderHistory();
    renderStats();
}

// ==============================================================
// AI CAMERA POSE SKELETON ENGINE (MediaPipe Pose Detection)
// ==============================================================

let poseModel = null;
let cameraStream = null;
let isAiRunning = false;
let isAiPaused = false;
let aiExerciseType = 'AI_SQUAT'; // 'AI_SQUAT' or 'AI_BICEP_CURL'
let aiSelectedArm = 'BOTH'; // 'BOTH', 'RIGHT', 'LEFT'
let aiFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let aiIsVoiceEnabled = true;

// Active AI Workout Session State
let aiRepCount = 0;
let aiDurationSeconds = 0;
let aiTimer = null;
let aiStartTimestamp = 0;
let aiAccuracyScores = []; // tracks form depth for each rep

// Pose Stage tracking
let squatStage = 'UP'; // 'UP' or 'DOWN'
let squatMinAngleThisRep = 180;

let curlStageRight = 'DOWN'; // 'DOWN' or 'UP'
let curlStageLeft = 'DOWN';
let curlStageBoth = 'DOWN';
let curlMinAngleThisRep = 180;

let lastFeedbackTime = 0;

// Vector Angle Calculator (A-B-C with B as vertex)
function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 180;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return Math.round(angle);
}

// Initialize MediaPipe Pose Model
async function initPoseModel() {
    if (poseModel) return poseModel;

    if (typeof window.Pose === 'undefined') {
        throw new Error("MediaPipe Pose library is loading or failed to load. Check your internet connection.");
    }

    poseModel = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    poseModel.setOptions({
        modelComplexity: 1, // 0: lite, 1: full, 2: heavy
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    poseModel.onResults(onPoseResults);
    return poseModel;
}

// Open Fullscreen AI Camera Studio
window.openAiWorkout = async function(type = 'AI_SQUAT') {
    aiExerciseType = type;
    const overlay = document.getElementById("ai-workout-overlay");
    overlay.classList.remove("hidden");
    
    // Reset state
    aiRepCount = 0;
    aiDurationSeconds = 0;
    aiAccuracyScores = [];
    isAiPaused = false;
    squatStage = 'UP';
    squatMinAngleThisRep = 180;
    curlStageRight = 'DOWN';
    curlStageLeft = 'DOWN';
    curlStageBoth = 'DOWN';
    curlMinAngleThisRep = 180;

    document.getElementById("ai-rep-counter").textContent = "0";
    document.getElementById("ai-duration").textContent = "00:00";
    document.getElementById("ai-calories").textContent = "0 kcal";
    document.getElementById("ai-form-accuracy").textContent = "100%";
    document.getElementById("ai-loading-overlay").classList.remove("hidden");

    // UI Pill selection
    updateAiExercisePill();

    // Start Timer
    aiStartTimestamp = Date.now();
    clearInterval(aiTimer);
    aiTimer = setInterval(() => {
        if (!isAiPaused) {
            aiDurationSeconds++;
            const mins = Math.floor(aiDurationSeconds / 60);
            const secs = aiDurationSeconds % 60;
            document.getElementById("ai-duration").textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            // Calculate real-time calories burned
            const cals = aiRepCount * (exerciseMetadata[aiExerciseType]?.caloriesPerUnit || 0.35);
            document.getElementById("ai-calories").textContent = Math.round(cals * 10) / 10 + " kcal";
        }
    }, 1000);

    try {
        await initPoseModel();
        await startCameraStream();
    } catch (err) {
        console.error("Failed to start AI Workout:", err);
        alert(state.lang === 'vi' 
            ? "Lỗi khởi tạo AI Camera: " + err.message 
            : "AI Camera Error: " + err.message);
        closeAiWorkout();
    }
};

// Switch between Squat and Bicep Curl inside AI Camera
window.switchAiExercise = function(type) {
    aiExerciseType = type;
    squatStage = 'UP';
    squatMinAngleThisRep = 180;
    curlStageRight = 'DOWN';
    curlStageLeft = 'DOWN';
    curlStageBoth = 'DOWN';
    curlMinAngleThisRep = 180;
    updateAiExercisePill();
};

function updateAiExercisePill() {
    const isSquat = aiExerciseType === 'AI_SQUAT';
    document.getElementById("ai-select-squat").classList.toggle("active", isSquat);
    document.getElementById("ai-select-curl").classList.toggle("active", !isSquat);
    
    // Arm selector only visible for Bicep Curl
    document.getElementById("ai-arm-selector").classList.toggle("hidden", isSquat);
    
    // Gauge target label
    if (isSquat) {
        document.getElementById("ai-gauge-joint-name").textContent = state.lang === 'vi' ? "Khớp Gối (Knee)" : "Knee Joint";
        document.getElementById("ai-target-rule").textContent = state.lang === 'vi' ? "Mục tiêu: < 95° để tính rep" : "Target: < 95° for rep";
        document.getElementById("ai-stage-badge").textContent = "UP";
    } else {
        document.getElementById("ai-gauge-joint-name").textContent = state.lang === 'vi' ? "Khớp Khuỷu Tay (Elbow)" : "Elbow Joint";
        document.getElementById("ai-target-rule").textContent = state.lang === 'vi' ? "Mục tiêu: < 48° để đạt đỉnh" : "Target: < 48° for peak";
        document.getElementById("ai-stage-badge").textContent = "DOWN";
    }
}

// Start Camera Stream via WebRTC
async function startCameraStream() {
    const video = document.getElementById("ai-video");
    const canvas = document.getElementById("ai-canvas");

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: aiFacingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
    await video.play();

    // Match canvas dimensions to video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    if (aiFacingMode === 'user') {
        canvas.classList.add("mirrored");
    } else {
        canvas.classList.remove("mirrored");
    }

    document.getElementById("ai-loading-overlay").classList.add("hidden");
    isAiRunning = true;

    // Run render frame loop
    runPoseLoop();
}

// RequestAnimationFrame Camera Frame Loop
async function runPoseLoop() {
    if (!isAiRunning) return;
    const video = document.getElementById("ai-video");
    
    if (video && video.readyState >= 2 && !isAiPaused) {
        try {
            await poseModel.send({ image: video });
        } catch (e) {
            console.warn("Pose frame evaluation issue", e);
        }
    }
    requestAnimationFrame(runPoseLoop);
}

// ==============================================================
// MEDIAPIPE ONRESULTS: POSE LOGIC, SKELETON DRAWING & REP COUNTING
// ==============================================================
function onPoseResults(results) {
    const canvas = document.getElementById("ai-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw raw camera frame
    ctx.drawImage(results.image, 0, 0, width, height);

    if (!results.poseLandmarks) {
        setAiFeedback(
            state.lang === 'vi' ? "Không thấy cơ thể! Vui lòng đứng trước camera." : "No body detected! Step in front of camera.",
            "ready"
        );
        ctx.restore();
        return;
    }

    const lm = results.poseLandmarks;

    // 2. Draw Glowing Cyberpunk Neon Skeleton
    drawNeonSkeleton(ctx, lm, width, height);

    // 3. Process Workout Logic based on Exercise Type
    if (aiExerciseType === 'AI_SQUAT') {
        processSquatLogic(ctx, lm, width, height);
    } else if (aiExerciseType === 'AI_BICEP_CURL') {
        processBicepCurlLogic(ctx, lm, width, height);
    }

    ctx.restore();
}

// Draw Glowing Skeleton Connectors and Joints
function drawNeonSkeleton(ctx, lm, width, height) {
    // Body skeleton pairs
    const connections = [
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

    connections.forEach(([i, j]) => {
        const p1 = lm[i];
        const p2 = lm[j];
        if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
        }
    });

    // Draw Joint Dots
    connections.flat().forEach(idx => {
        const p = lm[idx];
        if (p && (p.visibility || 1) > 0.4) {
            const x = p.x * width;
            const y = p.y * height;
            
            // Outer glow
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#00F2FE';
            ctx.fill();

            // Inner bright core
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
        }
    });
    ctx.restore();
}

// ----------------------------------------------------
// SQUAT REPETITION LOGIC
// ----------------------------------------------------
function processSquatLogic(ctx, lm, width, height) {
    // Landmarks:
    // Left: Hip (23), Knee (25), Ankle (27)
    // Right: Hip (24), Knee (26), Ankle (28)
    const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
    const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];

    const lVis = ((lHip?.visibility || 0) + (lKnee?.visibility || 0) + (lAnkle?.visibility || 0)) / 3;
    const rVis = ((rHip?.visibility || 0) + (rKnee?.visibility || 0) + (rAnkle?.visibility || 0)) / 3;

    if (lVis < 0.45 && rVis < 0.45) {
        setAiFeedback(
            state.lang === 'vi' ? "Hãy lùi lại để camera thấy từ hông đến bàn chân" : "Step back so camera sees from hips to feet",
            "ready"
        );
        return;
    }

    const lAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rAngle = calculateAngle(rHip, rKnee, rAnkle);

    // Pick clearest leg, or the deeper squat knee if both are visible
    let activeKneeAngle = 180;
    let activeKneePoint = null;

    if (lVis >= 0.45 && rVis >= 0.45) {
        activeKneeAngle = Math.min(lAngle, rAngle);
        activeKneePoint = lAngle <= rAngle ? lKnee : rKnee;
    } else if (lVis >= 0.45) {
        activeKneeAngle = lAngle;
        activeKneePoint = lKnee;
    } else {
        activeKneeAngle = rAngle;
        activeKneePoint = rKnee;
    }

    // Draw Angle Arc on the Knee
    if (activeKneePoint) {
        drawAngleLabel(ctx, activeKneePoint.x * width, activeKneePoint.y * height, activeKneeAngle, activeKneeAngle <= 95);
    }

    // Update gauge
    // 170° = 0%, 90° = 100%
    const gaugePercent = Math.max(0, Math.min(100, Math.round(((170 - activeKneeAngle) / (170 - 90)) * 100)));
    document.getElementById("ai-current-angle").textContent = `${activeKneeAngle}°`;
    document.getElementById("ai-gauge-fill").style.width = `${gaugePercent}%`;

    // Squat State Machine
    if (activeKneeAngle > 160) {
        // Standing position
        if (squatStage === 'DOWN') {
            // Rep completed!
            aiRepCount++;
            squatStage = 'UP';
            
            // Check form depth quality
            const isDeepGood = squatMinAngleThisRep <= 90;
            aiAccuracyScores.push(isDeepGood ? 100 : 75);
            updateFormAccuracyDisplay();

            // Pop animation on counter
            triggerRepPopAnimation();
            
            // Audio Feedback
            playBeep(750, 0.12);
            speakCount(aiRepCount);

            setAiFeedback(
                state.lang === 'vi' ? `Tuyệt vời! +1 Rep (Sâu: ${squatMinAngleThisRep}°)` : `Awesome! +1 Rep (Depth: ${squatMinAngleThisRep}°)`,
                "good"
            );
            squatMinAngleThisRep = 180;
        } else {
            document.getElementById("ai-stage-badge").textContent = "UP (Đứng)";
            setAiFeedback(
                state.lang === 'vi' ? "Đứng thẳng người. Hạ mông ngồi xổm xuống!" : "Standing straight. Squat down!",
                "ready"
            );
        }
    } else if (activeKneeAngle <= 95) {
        // Deep Squat Target reached!
        squatStage = 'DOWN';
        squatMinAngleThisRep = Math.min(squatMinAngleThisRep, activeKneeAngle);
        document.getElementById("ai-stage-badge").textContent = "DOWN (Đạt)";
        setAiFeedback(
            state.lang === 'vi' ? "Tốt lắm! Giữ chắc và đứng thẳng lên!" : "Good depth! Push up and stand straight!",
            "good"
        );
    } else {
        // In-between motion
        squatMinAngleThisRep = Math.min(squatMinAngleThisRep, activeKneeAngle);
        if (squatStage === 'UP') {
            setAiFeedback(
                state.lang === 'vi' ? "Xuống sâu hơn nữa (< 95°)!" : "Go deeper (< 95°)!",
                "warning"
            );
        }
    }
}

// ----------------------------------------------------
// BICEP CURL REPETITION LOGIC (Gập tạ tay)
// ----------------------------------------------------
function processBicepCurlLogic(ctx, lm, width, height) {
    // Landmarks:
    // Left: Shoulder (11), Elbow (13), Wrist (15)
    // Right: Shoulder (12), Elbow (14), Wrist (16)
    const lSh = lm[11], lEl = lm[13], lWr = lm[15];
    const rSh = lm[12], rEl = lm[14], rWr = lm[16];

    const lVis = ((lSh?.visibility || 0) + (lEl?.visibility || 0) + (lWr?.visibility || 0)) / 3;
    const rVis = ((rSh?.visibility || 0) + (rEl?.visibility || 0) + (rWr?.visibility || 0)) / 3;

    if (lVis < 0.45 && rVis < 0.45) {
        setAiFeedback(
            state.lang === 'vi' ? "Hãy đứng lùi lại để camera thấy cánh tay và khuỷu tay" : "Step back so camera sees your arms and elbows",
            "ready"
        );
        return;
    }

    const lAngle = calculateAngle(lSh, lEl, lWr);
    const rAngle = calculateAngle(rSh, rEl, rWr);

    let activeAngle = 180;
    let activeElbowPoint = null;

    if (aiSelectedArm === 'RIGHT') {
        activeAngle = rAngle;
        activeElbowPoint = rEl;
    } else if (aiSelectedArm === 'LEFT') {
        activeAngle = lAngle;
        activeElbowPoint = lEl;
    } else {
        // BOTH / AUTO: Pick arm with deepest flexion
        if (lVis >= 0.45 && rVis >= 0.45) {
            activeAngle = Math.min(lAngle, rAngle);
            activeElbowPoint = lAngle <= rAngle ? lEl : rEl;
        } else if (rVis >= 0.45) {
            activeAngle = rAngle;
            activeElbowPoint = rEl;
        } else {
            activeAngle = lAngle;
            activeElbowPoint = lEl;
        }
    }

    // Draw Angle Arc on Elbow
    if (activeElbowPoint) {
        drawAngleLabel(ctx, activeElbowPoint.x * width, activeElbowPoint.y * height, activeAngle, activeAngle <= 48);
    }

    // Update gauge
    // 160° = 0%, 40° = 100%
    const gaugePercent = Math.max(0, Math.min(100, Math.round(((160 - activeAngle) / (160 - 40)) * 100)));
    document.getElementById("ai-current-angle").textContent = `${activeAngle}°`;
    document.getElementById("ai-gauge-fill").style.width = `${gaugePercent}%`;

    // Curl State Machine
    if (activeAngle > 150) {
        // Arm Extended (DOWN position)
        if (curlStageBoth === 'UP') {
            aiRepCount++;
            curlStageBoth = 'DOWN';

            const isPeakGood = curlMinAngleThisRep <= 45;
            aiAccuracyScores.push(isPeakGood ? 100 : 75);
            updateFormAccuracyDisplay();

            triggerRepPopAnimation();
            playBeep(750, 0.12);
            speakCount(aiRepCount);

            setAiFeedback(
                state.lang === 'vi' ? `Chuẩn đỉnh! +1 Rep (Gập: ${curlMinAngleThisRep}°)` : `Great peak! +1 Rep (Curl: ${curlMinAngleThisRep}°)`,
                "good"
            );
            curlMinAngleThisRep = 180;
        } else {
            document.getElementById("ai-stage-badge").textContent = "DOWN (Duỗi)";
            setAiFeedback(
                state.lang === 'vi' ? "Tay duỗi thẳng. Bắt đầu gập tạ lên!" : "Arm extended. Curl weight up!",
                "ready"
            );
        }
    } else if (activeAngle <= 48) {
        // Peak Flexion Target reached!
        curlStageBoth = 'UP';
        curlMinAngleThisRep = Math.min(curlMinAngleThisRep, activeAngle);
        document.getElementById("ai-stage-badge").textContent = "UP (Đỉnh gập)";
        setAiFeedback(
            state.lang === 'vi' ? "Đạt đỉnh gập! Hạ tạ xuống có kiểm soát!" : "Peak reached! Lower down with control!",
            "good"
        );
    } else {
        curlMinAngleThisRep = Math.min(curlMinAngleThisRep, activeAngle);
        if (curlStageBoth === 'DOWN') {
            setAiFeedback(
                state.lang === 'vi' ? "Gập cao lên nữa (< 48°)!" : "Curl higher to peak (< 48°)!",
                "warning"
            );
        }
    }
}

// Draw Angle degree bubble directly next to joint on canvas
function drawAngleLabel(ctx, x, y, angle, isTargetAchieved) {
    ctx.save();
    const text = `${angle}°`;
    ctx.font = 'bold 16px Outfit, sans-serif';
    const textWidth = ctx.measureText(text).width;

    // Background pill
    ctx.fillStyle = 'rgba(15, 15, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x + 12, y - 14, textWidth + 16, 26, 13);
    ctx.fill();

    // Border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isTargetAchieved ? '#00E676' : '#FF9500';
    ctx.stroke();

    // Text
    ctx.fillStyle = isTargetAchieved ? '#00E676' : '#FFFFFF';
    ctx.fillText(text, x + 20, y + 5);

    // Mini circle on the joint itself
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = isTargetAchieved ? '#00E676' : '#FF9500';
    ctx.fill();
    ctx.restore();
}

// Set feedback text with animated status pill
function setAiFeedback(text, status = 'ready') {
    const pill = document.getElementById("ai-feedback-pill");
    const label = document.getElementById("ai-feedback-text");
    if (label.textContent !== text) {
        label.textContent = text;
        pill.className = `ai-feedback-pill ${status}`;
    }
}

// Pop animation when rep counter increments
function triggerRepPopAnimation() {
    const counter = document.getElementById("ai-rep-counter");
    counter.textContent = aiRepCount;
    counter.classList.add("pop-effect");
    setTimeout(() => {
        counter.classList.remove("pop-effect");
    }, 250);
}

// Update average form accuracy
function updateFormAccuracyDisplay() {
    if (aiAccuracyScores.length === 0) return;
    const avg = Math.round(aiAccuracyScores.reduce((a, b) => a + b, 0) / aiAccuracyScores.length);
    document.getElementById("ai-form-accuracy").textContent = `${avg}%`;
}

// Close & Stop AI Workout
window.closeAiWorkout = function() {
    isAiRunning = false;
    clearInterval(aiTimer);

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    const overlay = document.getElementById("ai-workout-overlay");
    overlay.classList.add("hidden");
};

// Finish & Save AI Workout
window.finishAiWorkout = function() {
    if (aiRepCount === 0 && aiDurationSeconds < 5) {
        closeAiWorkout();
        return;
    }

    clearInterval(aiTimer);
    isAiRunning = false;

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    const calPerUnit = exerciseMetadata[aiExerciseType]?.caloriesPerUnit || 0.35;
    const totalCalories = Math.round(aiRepCount * calPerUnit * 10) / 10;
    const avgAccuracy = aiAccuracyScores.length > 0 
        ? Math.round(aiAccuracyScores.reduce((a, b) => a + b, 0) / aiAccuracyScores.length) 
        : 100;

    const session = {
        id: Date.now(),
        exercise_type: aiExerciseType,
        start_time: aiStartTimestamp,
        end_time: Date.now(),
        duration_seconds: aiDurationSeconds,
        rep_count: aiRepCount,
        calories_burned: totalCalories,
        form_accuracy: avgAccuracy,
        sync_status: "PENDING"
    };

    state.sessions.push(session);
    localStorage.setItem("saitama_sessions", JSON.stringify(state.sessions));

    document.getElementById("ai-workout-overlay").classList.add("hidden");

    // Success Notification & Celebration
    playBeep(880, 0.25);
    alert(state.lang === 'vi' 
        ? `🎉 Chúc mừng! Bạn đã hoàn thành ${aiRepCount} reps ${aiExerciseType === 'AI_SQUAT' ? 'Squat' : 'Gập tạ tay'}.\n🔥 Đốt cháy: ${totalCalories} kcal\n🎯 Chuẩn form: ${avgAccuracy}%`
        : `🎉 Great workout! You completed ${aiRepCount} reps.\n🔥 Burned: ${totalCalories} kcal\n🎯 Form Accuracy: ${avgAccuracy}%`);

    renderStreakCard();
    renderGoals();
    renderHistory();
    renderStats();
    triggerSync();
};

// ==============================================================
// DASHBOARD RENDERING (Home, Goals, History, Stats)
// ==============================================================
function renderStreakCard() {
    const today = getTodayDateString();
    
    // Calculate Streak
    const completedDates = [...new Set(state.sessions.map(s => {
        const d = new Date(s.start_time);
        return [d.getFullYear(), (d.getMonth() + 1).toString().padStart(2, '0'), d.getDate().toString().padStart(2, '0')].join('-');
    }))].sort().reverse();

    let streak = 0;
    let checkDate = new Date();
    const formatDate = (dateObj) => [dateObj.getFullYear(), (dateObj.getMonth() + 1).toString().padStart(2, '0'), dateObj.getDate().toString().padStart(2, '0')].join('-');

    let dateStr = formatDate(checkDate);
    if (!completedDates.includes(dateStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        dateStr = formatDate(checkDate);
    }

    while (completedDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        dateStr = formatDate(checkDate);
    }

    // Completed goals count
    const todaySessions = state.sessions.filter(s => {
        const d = new Date(s.start_time);
        return formatDate(d) === today;
    });

    const todayGoals = state.goals.filter(g => g.date_string === today);
    let doneCount = 0;

    todayGoals.forEach(goal => {
        const type = goal.exercise_type;
        const totalDone = todaySessions.filter(s => s.exercise_type === type).reduce((acc, curr) => {
            if (exerciseMetadata[type]?.isRep) return acc + curr.rep_count;
            if (type === "RUNNING") return acc + Math.round(curr.distance_km * 1000);
            return acc + curr.duration_seconds;
        }, 0);

        if (totalDone >= goal.target_value) {
            doneCount++;
        }
    });

    const t = translations[state.lang];
    document.getElementById("streak-count").textContent = t.streak_count.replace("{streak}", streak);
    document.getElementById("today-progress-txt").textContent = t.today_progress_txt.replace("{done}", doneCount).replace("{total}", todayGoals.length);
    
    const progressPercent = todayGoals.length > 0 ? (doneCount / todayGoals.length) * 100 : 0;
    document.getElementById("today-progress-bar").style.width = `${progressPercent}%`;
}

function renderGoals() {
    const today = getTodayDateString();
    const todayGoals = state.goals.filter(g => g.date_string === today);
    const container = document.getElementById("goals-list");
    const t = translations[state.lang];
    
    if (todayGoals.length === 0) {
        container.innerHTML = `
            <div class="goal-progress-card" style="justify-content: center; opacity: 0.6; cursor: pointer;" onclick="document.getElementById('goal-modal').classList.remove('hidden')">
                <span>+ ${state.lang === 'vi' ? 'Bấm để thêm mục tiêu hôm nay' : 'Click to add today target'}</span>
            </div>`;
        return;
    }

    const todaySessions = state.sessions.filter(s => {
        const d = new Date(s.start_time);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}` === today;
    });

    container.innerHTML = todayGoals.map(goal => {
        const type = goal.exercise_type;
        const metadata = exerciseMetadata[type] || { isRep: true };
        const doneVal = todaySessions.filter(s => s.exercise_type === type).reduce((acc, curr) => {
            if (metadata.isRep) return acc + curr.rep_count;
            if (type === "RUNNING") return acc + Math.round(curr.distance_km * 1000); // meters
            return acc + curr.duration_seconds; // seconds
        }, 0);

        const progress = Math.min((doneVal / goal.target_value) * 100, 100);
        const isDone = doneVal >= goal.target_value;

        const exName = t["ex_" + type.toLowerCase()] || type;
        const unit = type === "RUNNING" ? "m" : (type === "PLANK" ? "s" : "reps");

        return `
            <div class="goal-progress-card">
                <div class="goal-card-left">
                    <span class="goal-title">${exName}</span>
                    <span class="goal-value ${isDone ? 'completed' : ''}">${doneVal} / ${goal.target_value} ${unit}</span>
                    <div class="goal-progress-track">
                        <div class="goal-progress-fill ${isDone ? 'completed' : ''}" style="width: ${progress}%"></div>
                    </div>
                </div>
                <button class="btn-edit" onclick="editGoalValue('${type}', ${goal.target_value})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        `;
    }).join("");
}

window.editGoalValue = (type, val) => {
    document.querySelectorAll(".exercise-btn-select").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === type);
    });
    document.getElementById("goal-input").value = val;
    document.getElementById("goal-modal").classList.remove("hidden");
    updateLocalization();
};

function renderHistory() {
    const container = document.getElementById("history-list");
    const t = translations[state.lang];
    
    if (state.sessions.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--text-secondary);">${state.lang === 'vi' ? 'Chưa có lịch sử tập luyện' : 'No workout records found'}</div>`;
        return;
    }

    const sorted = [...state.sessions].sort((a, b) => b.start_time - a.start_time);
    const grouped = {};
    
    sorted.forEach(s => {
        const dateObj = new Date(s.start_time);
        const dayStr = dateObj.toLocaleDateString(state.lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!grouped[dayStr]) grouped[dayStr] = [];
        grouped[dayStr].push(s);
    });

    container.innerHTML = Object.keys(grouped).map(day => {
        const itemsHtml = grouped[day].map(s => {
            const type = s.exercise_type;
            const isRep = (exerciseMetadata[type] || {}).isRep ?? true;
            
            const mins = Math.floor(s.duration_seconds / 60);
            const secs = s.duration_seconds % 60;
            const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const performance = isRep ? `${s.rep_count} reps` : (type === "RUNNING" ? `${(s.distance_km || 0).toFixed(2)} km` : timeStr);
            const isSynced = s.sync_status === "SYNCED";
            const isAi = type.startsWith("AI_");

            return `
                <div class="history-item-card">
                    <div class="history-item-left">
                        <div class="history-icon" style="${isAi ? 'color:#00F2FE; background:rgba(0,242,254,0.1);' : ''}">
                            <i class="fa-solid ${isAi ? 'fa-robot' : (type === 'RUNNING' ? 'fa-person-running' : 'fa-dumbbell')}"></i>
                        </div>
                        <div class="history-details">
                            <h4>${t["ex_" + type.toLowerCase()] || type} ${isAi ? '<span style="color:#00F2FE; font-size:10px;">[AI CAMERA]</span>' : ''}</h4>
                            <p>${t.stat_duration}: ${timeStr} | ${Math.round(s.calories_burned)} kcal</p>
                        </div>
                    </div>
                    <div class="history-item-right">
                        <span class="history-performance">${performance}</span>
                        <span class="sync-status-icon ${isSynced ? 'synced' : 'pending'}" title="${isSynced ? 'Synced' : 'Pending'}">
                            <i class="fa-solid ${isSynced ? 'fa-cloud-done' : 'fa-cloud-upload'}"></i>
                        </span>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div class="history-date-header">${day}</div>
            ${itemsHtml}
        `;
    }).join("");
}

function renderStats() {
    const t = translations[state.lang];
    
    let totalReps = 0;
    let totalDurationSeconds = 0;
    let totalCalories = 0;
    let totalDistance = 0;

    const prs = {};

    state.sessions.forEach(s => {
        totalReps += s.rep_count;
        totalDurationSeconds += s.duration_seconds;
        totalCalories += s.calories_burned;
        totalDistance += s.distance_km || 0;

        const type = s.exercise_type;
        const currentPr = prs[type] || 0;
        const isRep = (exerciseMetadata[type] || {}).isRep ?? true;
        
        if (isRep) {
            prs[type] = Math.max(currentPr, s.rep_count);
        } else if (type === "RUNNING") {
            prs[type] = Math.max(currentPr, s.distance_km || 0);
        } else {
            prs[type] = Math.max(currentPr, s.duration_seconds);
        }
    });

    document.getElementById("stat-total-reps").textContent = totalReps;
    document.getElementById("stat-total-duration").textContent = Math.round(totalDurationSeconds / 60) + "m";
    document.getElementById("stat-total-calories").textContent = Math.round(totalCalories);
    document.getElementById("stat-total-distance").textContent = totalDistance.toFixed(1) + "km";

    // Personal Records
    const prContainer = document.getElementById("pr-list");
    prContainer.innerHTML = Object.keys(prs).map(type => {
        const val = prs[type];
        const isRep = (exerciseMetadata[type] || {}).isRep ?? true;
        const displayVal = isRep ? `${val} reps` : (type === "RUNNING" ? `${val.toFixed(2)} km` : `${Math.floor(val/60)}m ${val%60}s`);
        return `
            <div class="pr-item-card">
                <div class="pr-item-left">
                    <div class="pr-badge-icon"><i class="fa-solid fa-trophy"></i></div>
                    <span class="pr-name">${t["ex_" + type.toLowerCase()] || type}</span>
                </div>
                <span class="pr-value">${displayVal}</span>
            </div>
        `;
    }).join("");

    renderWeeklyChart();
}

function renderWeeklyChart() {
    const wrapper = document.getElementById("weekly-chart");
    const last7Days = [];
    const dayNames = [];

    const localeString = state.lang === 'vi' ? 'vi-VN' : 'en-US';
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push([date.getFullYear(), (date.getMonth() + 1).toString().padStart(2, '0'), date.getDate().toString().padStart(2, '0')].join('-'));
        dayNames.push(date.toLocaleDateString(localeString, { weekday: 'short' }).replace('.', ''));
    }

    const dailyCalories = last7Days.map(dateStr => {
        return state.sessions.filter(s => {
            const d = new Date(s.start_time);
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${day}` === dateStr;
        }).reduce((acc, curr) => acc + curr.calories_burned, 0);
    });

    const maxCal = Math.max(...dailyCalories, 50);

    wrapper.innerHTML = dailyCalories.map((cals, index) => {
        const heightPercent = (cals / maxCal) * 100;
        return `
            <div class="chart-bar-column">
                <span class="chart-bar-value">${cals > 0 ? Math.round(cals) : ''}</span>
                <div class="chart-bar-fill" style="height: ${heightPercent}%"></div>
                <span class="chart-bar-label">${dayNames[index]}</span>
            </div>
        `;
    }).join("");
}

// ==============================================================
// SENSOR WORKOUT (ACCELEROMETER FALLBACK)
// ==============================================================
function startWorkout(type) {
    document.getElementById("info-modal").classList.add("hidden");
    document.getElementById("workout-overlay").classList.remove("hidden");
    
    const t = translations[state.lang];
    document.getElementById("overlay-exercise-name").textContent = t["ex_" + type.toLowerCase()] || type;
    document.getElementById("counter-label").textContent = exerciseMetadata[type].isRep ? t.stat_reps : t.stat_duration;
    document.getElementById("counter-value").textContent = "0";

    const isRunning = type === "RUNNING";
    document.getElementById("overlay-distance-box").classList.toggle("hidden", !isRunning);

    state.activeWorkout = {
        type: type,
        repCount: 0,
        durationSeconds: 0,
        distanceKm: 0,
        startTimestamp: Date.now(),
        timer: setInterval(() => {
            state.activeWorkout.durationSeconds++;
            
            const mins = Math.floor(state.activeWorkout.durationSeconds / 60);
            const secs = state.activeWorkout.durationSeconds % 60;
            document.getElementById("overlay-duration").textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const metadata = exerciseMetadata[type];
            let activeCals = 0;
            if (metadata.isRep) {
                activeCals = state.activeWorkout.repCount * metadata.caloriesPerUnit;
            } else {
                activeCals = state.activeWorkout.durationSeconds * metadata.caloriesPerUnit;
            }
            document.getElementById("overlay-calories").textContent = Math.round(activeCals) + " kcal";

            if (!metadata.isRep && type !== "RUNNING") {
                document.getElementById("counter-value").textContent = state.activeWorkout.durationSeconds;
            }
        }, 1000),
        
        sensorListener: exerciseMetadata[type].isRep ? setupAccelerometer(type) : null,
        locationWatcher: isRunning ? setupGeolocation() : null
    };
}

function stopAndSaveWorkout() {
    if (!state.activeWorkout) return;
    clearInterval(state.activeWorkout.timer);

    if (state.activeWorkout.sensorListener) {
        window.removeEventListener("devicemotion", state.activeWorkout.sensorListener);
    }
    if (state.activeWorkout.locationWatcher !== null) {
        navigator.geolocation.clearWatch(state.activeWorkout.locationWatcher);
    }

    const type = state.activeWorkout.type;
    const reps = state.activeWorkout.repCount;
    const dur = state.activeWorkout.durationSeconds;
    const dist = state.activeWorkout.distanceKm;

    const calories = exerciseMetadata[type].isRep ? (reps * exerciseMetadata[type].caloriesPerUnit) : (dur * exerciseMetadata[type].caloriesPerUnit);

    const session = {
        id: Date.now(),
        exercise_type: type,
        start_time: state.activeWorkout.startTimestamp,
        end_time: Date.now(),
        duration_seconds: dur,
        rep_count: reps,
        calories_burned: calories,
        distance_km: type === "RUNNING" ? dist : null,
        sync_status: "PENDING"
    };

    state.sessions.push(session);
    localStorage.setItem("saitama_sessions", JSON.stringify(state.sessions));

    state.activeWorkout = null;
    document.getElementById("workout-overlay").classList.add("hidden");
    
    renderStreakCard();
    renderGoals();
    renderHistory();
    renderStats();
    triggerSync();
}

function discardWorkout() {
    if (!state.activeWorkout) return;
    clearInterval(state.activeWorkout.timer);

    if (state.activeWorkout.sensorListener) {
        window.removeEventListener("devicemotion", state.activeWorkout.sensorListener);
    }
    if (state.activeWorkout.locationWatcher !== null) {
        navigator.geolocation.clearWatch(state.activeWorkout.locationWatcher);
    }

    state.activeWorkout = null;
    document.getElementById("workout-overlay").classList.add("hidden");
}

function setupAccelerometer(type) {
    if (!window.DeviceMotionEvent) return null;

    const config = {
        SQUAT: { up: 2.5, down: 0.8, debounce: 1000 },
        CRUNCH: { up: 2.2, down: 0.6, debounce: 1200 },
        PUSH_UP: { up: 2.0, down: 0.5, debounce: 800 },
        PULL_UP: { up: 3.0, down: 1.0, debounce: 1200 }
    }[type] || { up: 2.0, down: 0.5, debounce: 800 };

    let isAboveThreshold = false;
    let lastRepTime = 0;
    const alpha = 0.15;
    const gravity = [0, 0, 0];

    const handleMotionEvent = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc || acc.x === null) return;

        gravity[0] = alpha * gravity[0] + (1 - alpha) * acc.x;
        gravity[1] = alpha * gravity[1] + (1 - alpha) * acc.y;
        gravity[2] = alpha * gravity[2] + (1 - alpha) * acc.z;

        const linearX = acc.x - gravity[0];
        const linearY = acc.y - gravity[1];
        const linearZ = acc.z - gravity[2];

        const magnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);
        drawMotionWave(magnitude);

        const now = Date.now();
        if (magnitude > config.up && !isAboveThreshold) {
            isAboveThreshold = true;
        } else if (magnitude < config.down && isAboveThreshold) {
            isAboveThreshold = false;
            if (now - lastRepTime > config.debounce) {
                state.activeWorkout.repCount += 1;
                document.getElementById("counter-value").textContent = state.activeWorkout.repCount;
                playBeep();
                lastRepTime = now;
            }
        }
    };

    window.addEventListener("devicemotion", handleMotionEvent);
    return handleMotionEvent;
}

function setupGeolocation() {
    if (!navigator.geolocation) return null;
    let lastCoords = null;
    
    return navigator.geolocation.watchPosition((position) => {
        const coords = position.coords;
        if (lastCoords) {
            const dist = calculateDistance(lastCoords.latitude, lastCoords.longitude, coords.latitude, coords.longitude);
            state.activeWorkout.distanceKm += dist;
            document.getElementById("overlay-distance").textContent = state.activeWorkout.distanceKm.toFixed(2) + " km";
        }
        lastCoords = coords;
    }, (err) => {
        console.error("GPS Watch failed", err);
    }, {
        enableHighAccuracy: true,
        maximumAge: 1000
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

let canvasPhase = 0;
function drawMotionWave(sensorMagnitude) {
    const canvas = document.getElementById("motion-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#FF5E3A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const amplitude = 5 + Math.min(sensorMagnitude * 3, 25);
    canvasPhase += 0.1;

    for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin((x / width) * 4 * Math.PI + canvasPhase) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// ==============================================================
// SUPABASE AUTO SYNC
// ==============================================================
async function triggerSync() {
    if (!supabase || state.syncPending) return;
    state.syncPending = true;
    
    const indicator = document.getElementById("sync-indicator");
    indicator.className = "sync-badge syncing";

    try {
        const unsyncedSessions = state.sessions.filter(s => s.sync_status === "PENDING");
        for (let s of unsyncedSessions) {
            const remoteObj = {
                exercise_type: s.exercise_type,
                start_time: s.start_time,
                end_time: s.end_time,
                duration_seconds: s.duration_seconds,
                rep_count: s.rep_count,
                calories_burned: s.calories_burned,
                distance_km: s.distance_km,
                user_id: state.userId
            };
            const { error } = await supabase.from("workout_sessions").insert([remoteObj]).select();
            if (!error) {
                s.sync_status = "SYNCED";
            }
        }

        const unsyncedGoals = state.goals.filter(g => g.sync_status === "PENDING");
        for (let g of unsyncedGoals) {
            const remoteObj = {
                date_string: g.date_string,
                exercise_type: g.exercise_type,
                target_value: g.target_value,
                user_id: state.userId
            };
            const { error } = await supabase.from("daily_goals").insert([remoteObj]).select();
            if (!error) {
                g.sync_status = "SYNCED";
            }
        }

        localStorage.setItem("saitama_sessions", JSON.stringify(state.sessions));
        localStorage.setItem("saitama_goals", JSON.stringify(state.goals));

        indicator.className = "sync-badge synced";
    } catch (e) {
        console.error("Sync process failed", e);
        indicator.className = "sync-badge pending";
    } finally {
        state.syncPending = false;
        renderHistory();
    }
}

// ==============================================================
// EVENT LISTENERS & SETUP
// ==============================================================
function init() {
    // Navigation Tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;
            
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            state.currentTab = targetTab;
            updateLocalization();
        });
    });

    // Language Toggle Button
    document.getElementById("lang-toggle").addEventListener("click", () => {
        state.lang = state.lang === "vi" ? "en" : "vi";
        localStorage.setItem("saitama_lang", state.lang);
        updateLocalization();
    });

    // Add Goal Dialog Modal
    document.getElementById("btn-add-goal").addEventListener("click", () => {
        document.getElementById("goal-input").value = "";
        document.getElementById("goal-modal").classList.remove("hidden");
    });
    
    document.getElementById("btn-goal-close").addEventListener("click", () => {
        document.getElementById("goal-modal").classList.add("hidden");
    });
    document.getElementById("btn-goal-cancel").addEventListener("click", () => {
        document.getElementById("goal-modal").classList.add("hidden");
    });

    // Goal selector type buttons
    document.querySelectorAll(".exercise-btn-select").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".exercise-btn-select").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateLocalization();
        });
    });

    // Save Goal Target
    document.getElementById("btn-goal-save").addEventListener("click", () => {
        const type = document.querySelector(".exercise-btn-select.active").dataset.type;
        const val = parseInt(document.getElementById("goal-input").value);
        if (!val || val <= 0) return;
        
        const today = getTodayDateString();
        state.goals = state.goals.filter(g => !(g.date_string === today && g.exercise_type === type));

        const goal = {
            id: Date.now(),
            date_string: today,
            exercise_type: type,
            target_value: val,
            sync_status: "PENDING"
        };

        state.goals.push(goal);
        localStorage.setItem("saitama_goals", JSON.stringify(state.goals));

        document.getElementById("goal-modal").classList.add("hidden");
        renderGoals();
        renderStreakCard();
        triggerSync();
    });

    // Quick Start -> jump to workout select tab
    document.getElementById("btn-quick-start").addEventListener("click", () => {
        document.querySelector(".nav-tab[data-tab='tab-workout']").click();
    });

    // Saitama Challenge
    document.getElementById("btn-saitama-challenge").addEventListener("click", () => {
        const today = getTodayDateString();
        const challenge = {
            AI_SQUAT: 100,
            AI_BICEP_CURL: 100,
            CRUNCH: 100,
            PUSH_UP: 100,
            RUNNING: 10000,
            PULL_UP: 50,
            PLANK: 300
        };

        state.goals = state.goals.filter(g => g.date_string !== today);
        Object.keys(challenge).forEach(type => {
            state.goals.push({
                id: Date.now() + Math.random(),
                date_string: today,
                exercise_type: type,
                target_value: challenge[type],
                sync_status: "PENDING"
            });
        });

        localStorage.setItem("saitama_goals", JSON.stringify(state.goals));
        renderGoals();
        renderStreakCard();
        triggerSync();
    });

    // Force Sync button
    document.getElementById("btn-force-sync").addEventListener("click", () => {
        triggerSync();
    });

    // Sensor Workout Selection Cards
    document.querySelectorAll(".exercise-card[data-exercise]").forEach(card => {
        card.addEventListener("click", () => {
            const exerciseType = card.dataset.exercise;
            const t = translations[state.lang];
            
            document.getElementById("modal-title").textContent = t["ex_" + exerciseType.toLowerCase()] || exerciseType;
            document.getElementById("modal-guide-text").textContent = t["guide_" + exerciseType.toLowerCase()] || "";
            document.getElementById("btn-modal-start").dataset.exercise = exerciseType;

            const sensorBox = document.getElementById("sensor-request-box");
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                sensorBox.classList.remove("hidden");
            } else {
                sensorBox.classList.add("hidden");
            }

            document.getElementById("info-modal").classList.remove("hidden");
        });
    });

    document.getElementById("btn-modal-close").addEventListener("click", () => {
        document.getElementById("info-modal").classList.add("hidden");
    });

    document.getElementById("btn-grant-sensors").addEventListener("click", () => {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        document.getElementById("sensor-request-box").classList.add("hidden");
                    }
                })
                .catch(console.error);
        }
    });

    document.getElementById("btn-modal-start").addEventListener("click", (e) => {
        const type = e.target.dataset.exercise;
        startWorkout(type);
    });

    // Accelerometer Workout Finish / Discard
    document.getElementById("btn-overlay-finish").addEventListener("click", () => {
        stopAndSaveWorkout();
    });
    
    document.getElementById("btn-overlay-cancel").addEventListener("click", () => {
        if (confirm(state.lang === 'vi' ? 'Bạn có muốn hủy bỏ buổi tập này không?' : 'Do you want to discard this workout?')) {
            discardWorkout();
        }
    });

    // AI Camera HUD Controls
    document.getElementById("btn-ai-back").addEventListener("click", () => {
        if (confirm(state.lang === 'vi' ? 'Bạn muốn thoát buổi tập AI này?' : 'Do you want to exit this AI workout?')) {
            closeAiWorkout();
        }
    });

    // Switch Camera Front / Back
    document.getElementById("btn-ai-switch-camera").addEventListener("click", async () => {
        aiFacingMode = aiFacingMode === 'user' ? 'environment' : 'user';
        document.getElementById("ai-loading-overlay").classList.remove("hidden");
        try {
            await startCameraStream();
        } catch (e) {
            console.error("Camera flip error", e);
        }
    });

    // Voice Speech Toggle
    document.getElementById("btn-ai-voice").addEventListener("click", () => {
        aiIsVoiceEnabled = !aiIsVoiceEnabled;
        const btn = document.getElementById("btn-ai-voice");
        btn.classList.toggle("active", aiIsVoiceEnabled);
        btn.innerHTML = `<i class="fa-solid ${aiIsVoiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>`;
    });

    // Pause / Resume AI Workout
    document.getElementById("btn-ai-pause").addEventListener("click", () => {
        isAiPaused = !isAiPaused;
        const btn = document.getElementById("btn-ai-pause");
        if (isAiPaused) {
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Tiếp tục';
            setAiFeedback(state.lang === 'vi' ? 'Buổi tập đang tạm dừng' : 'Workout paused', 'warning');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-pause"></i> Tạm dừng';
        }
    });

    // Finish AI Workout
    document.getElementById("btn-ai-finish").addEventListener("click", () => {
        finishAiWorkout();
    });

    // Bicep Curl Arm Selector Buttons (Both, Right, Left)
    document.querySelectorAll(".arm-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".arm-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            aiSelectedArm = btn.dataset.arm;
        });
    });

    // Initial render
    updateLocalization();
    triggerSync();
}

// Safely execute init after DOM is parsed
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered successfully', reg.scope))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}
