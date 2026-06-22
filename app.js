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
        ex_squat: "Đứng lên ngồi xuống",
        ex_crunch: "Gập bụng",
        ex_pushup: "Chống đẩy",
        ex_running: "Chạy bộ",
        ex_pullup: "Lên xà",
        ex_plank: "Plank",
        type_reps: "Đếm số lần",
        type_time: "Đếm thời gian",
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
        ex_squat: "Squat",
        ex_crunch: "Crunch",
        ex_pushup: "Push-up",
        ex_running: "Running",
        ex_pullup: "Pull-up",
        ex_plank: "Plank",
        type_reps: "Reps counting",
        type_time: "Time tracker",
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
    
    // Active Workout state
    activeWorkout: null, // { type, repCount, durationSeconds, distanceKm, timer, sensorListener, locationWatcher, startTimestamp }
    
    // Sync state
    syncPending: false
};

// Beep Feedback via Web Audio API (No files required!)
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); 

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, 100);
    } catch (e) {
        console.error("Audio Context beep failed", e);
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

// Format local date string
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
        const activeType = document.querySelector(".exercise-btn-select.active").dataset.type;
        goalInputLabel.textContent = activeType === "RUNNING" ? `${t.stat_distance} (m)` : (activeType === "PLANK" ? `${t.stat_duration} (s)` : `${t.stat_reps} (lần)`);
    }

    renderStreakCard();
    renderGoals();
    renderHistory();
    renderStats();
}

// ----------------------------------------------------
// SENSORS & MOTION DETECTION (Web Accelerometer)
// ----------------------------------------------------
function setupAccelerometer(type) {
    if (!window.DeviceMotionEvent) {
        console.warn("DeviceMotionEvent is not supported on this browser.");
        return null;
    }

    // Peak counter configuration
    const config = {
        SQUAT: { up: 2.5, down: 0.8, debounce: 1000 },
        CRUNCH: { up: 2.2, down: 0.6, debounce: 1200 },
        PUSH_UP: { up: 2.0, down: 0.5, debounce: 800 },
        PULL_UP: { up: 3.0, down: 1.0, debounce: 1200 }
    }[type] || { up: 2.0, down: 0.5, debounce: 800 };

    let isAboveThreshold = false;
    let lastRepTime = 0;
    
    // Low pass filter components
    const alpha = 0.15;
    const gravity = [0, 0, 0];

    const handleMotionEvent = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc || acc.x === null) return;

        // Low-pass filter to isolate gravity
        gravity[0] = alpha * gravity[0] + (1 - alpha) * acc.x;
        gravity[1] = alpha * gravity[1] + (1 - alpha) * acc.y;
        gravity[2] = alpha * gravity[2] + (1 - alpha) * acc.z;

        // Linear acceleration (gravity removed)
        const linearX = acc.x - gravity[0];
        const linearY = acc.y - gravity[1];
        const linearZ = acc.z - gravity[2];

        // Resultant magnitude
        const magnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);

        // Canvas Motion Graph rendering
        drawMotionWave(magnitude);

        // Threshold crossing detection
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

// Geolocation (Running)
function setupGeolocation() {
    if (!navigator.geolocation) return null;
    
    let lastCoords = null;
    
    const watcher = navigator.geolocation.watchPosition((position) => {
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

    return watcher;
}

// Calculate GPS distance using Haversine formula (km)
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

// Canvas Wave drawing
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
    
    // Wave amplitude based on sensor magnitude
    const amplitude = 5 + Math.min(sensorMagnitude * 3, 25);
    canvasPhase += 0.1;

    for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin((x / width) * 4 * Math.PI + canvasPhase) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// ----------------------------------------------------
// VIEW RENDERING
// ----------------------------------------------------
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
            if (exerciseMetadata[type].isRep) return acc + curr.rep_count;
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
                <span>+ Click to add your first goal today</span>
            </div>`;
        return;
    }

    // Fetch today's session summary
    const todaySessions = state.sessions.filter(s => {
        const d = new Date(s.start_time);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}` === today;
    });

    container.innerHTML = todayGoals.map(goal => {
        const type = goal.exercise_type;
        const metadata = exerciseMetadata[type];
        const doneVal = todaySessions.filter(s => s.exercise_type === type).reduce((acc, curr) => {
            if (metadata.isRep) return acc + curr.rep_count;
            if (type === "RUNNING") return acc + Math.round(curr.distance_km * 1000); // meters
            return acc + curr.duration_seconds; // seconds
        }, 0);

        const progress = Math.min((doneVal / goal.target_value) * 100, 100);
        const isDone = doneVal >= goal.target_value;

        const exName = t["ex_" + type.toLowerCase()];
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
        container.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--text-secondary);">${t.stats_history_empty}</div>`;
        return;
    }

    // Sort descending by start time
    const sorted = [...state.sessions].sort((a, b) => b.start_time - a.start_time);
    
    // Group by date
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
            const isRep = exerciseMetadata[type].isRep;
            
            const mins = Math.floor(s.duration_seconds / 60);
            const secs = s.duration_seconds % 60;
            const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const performance = isRep ? `${s.rep_count} reps` : (type === "RUNNING" ? `${s.distance_km.toFixed(2)} km` : timeStr);
            const isSynced = s.sync_status === "SYNCED";

            return `
                <div class="history-item-card">
                    <div class="history-item-left">
                        <div class="history-icon"><i class="fa-solid ${type === 'RUNNING' ? 'fa-person-running' : 'fa-dumbbell'}"></i></div>
                        <div class="history-details">
                            <h4>${t["ex_" + type.toLowerCase()]}</h4>
                            <p>${t.stat_duration}: ${timeStr} | ${String(Math.round(s.calories_burned))} kcal</p>
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
    
    // Aggregates
    let totalReps = 0;
    let totalDurationSeconds = 0;
    let totalCalories = 0;
    let totalDistance = 0;

    const prs = {}; // Peak records by ExerciseType

    state.sessions.forEach(s => {
        totalReps += s.rep_count;
        totalDurationSeconds += s.duration_seconds;
        totalCalories += s.calories_burned;
        totalDistance += s.distance_km || 0;

        // Personal record calculation
        const type = s.exercise_type;
        const currentPr = prs[type] || 0;
        if (exerciseMetadata[type].isRep) {
            prs[type] = Math.max(currentPr, s.rep_count);
        } else if (type === "RUNNING") {
            prs[type] = Math.max(currentPr, s.distance_km || 0);
        } else { // Plank
            prs[type] = Math.max(currentPr, s.duration_seconds);
        }
    });

    document.getElementById("stat-total-reps").textContent = totalReps;
    document.getElementById("stat-total-duration").textContent = Math.round(totalDurationSeconds / 60) + "m";
    document.getElementById("stat-total-calories").textContent = Math.round(totalCalories);
    document.getElementById("stat-total-distance").textContent = totalDistance.toFixed(1) + "km";

    // Draw Personal Records Card
    const prContainer = document.getElementById("pr-list");
    prContainer.innerHTML = Object.keys(prs).map(type => {
        const val = prs[type];
        const displayVal = exerciseMetadata[type].isRep ? `${val} reps` : (type === "RUNNING" ? `${val.toFixed(2)} km` : `${Math.floor(val/60)}m ${val%60}s`);
        return `
            <div class="pr-item-card">
                <div class="pr-item-left">
                    <div class="pr-badge-icon"><i class="fa-solid fa-trophy"></i></div>
                    <span class="pr-name">${t["ex_" + type.toLowerCase()]}</span>
                </div>
                <span class="pr-value">${displayVal}</span>
            </div>
        `;
    }).join("");

    // Draw Weekly Activity Chart
    renderWeeklyChart();
}

function renderWeeklyChart() {
    const wrapper = document.getElementById("weekly-chart");
    const last7Days = [];
    const dayNames = [];

    // Calculate dates for last 7 days
    const localeString = state.lang === 'vi' ? 'vi-VN' : 'en-US';
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push([date.getFullYear(), (date.getMonth() + 1).toString().padStart(2, '0'), date.getDate().toString().padStart(2, '0')].join('-'));
        dayNames.push(date.toLocaleDateString(localeString, { weekday: 'short' }).replace('.', ''));
    }

    // Aggregate calories burned per day
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

// ----------------------------------------------------
// WORKOUT CONTROLLER (Start / Stop)
// ----------------------------------------------------
function startWorkout(type) {
    document.getElementById("info-modal").classList.add("hidden");
    document.getElementById("workout-overlay").classList.remove("hidden");
    
    const t = translations[state.lang];
    document.getElementById("overlay-exercise-name").textContent = t["ex_" + type.toLowerCase()];
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
            
            // Calculate active workout calories burned on the fly
            const metadata = exerciseMetadata[type];
            let activeCals = 0;
            if (metadata.isRep) {
                activeCals = state.activeWorkout.repCount * metadata.caloriesPerUnit;
            } else {
                activeCals = state.activeWorkout.durationSeconds * metadata.caloriesPerUnit;
            }
            document.getElementById("overlay-calories").textContent = Math.round(activeCals) + " kcal";

            // If time-based, reflect seconds inside the main counter
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

    // Unbind sensors & location
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
        id: Date.now(), // Local key
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
    
    // Refresh display
    renderStreakCard();
    renderGoals();
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

// ----------------------------------------------------
// SUPABASE SYNCHRONIZATION
// ----------------------------------------------------
async function triggerSync() {
    if (!supabase || state.syncPending) return;
    state.syncPending = true;
    
    const indicator = document.getElementById("sync-indicator");
    indicator.className = "sync-badge syncing";

    try {
        // 1. Sync Sessions
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
            const { data, error } = await supabase.from("workout_sessions").insert([remoteObj]).select();
            if (!error) {
                s.sync_status = "SYNCED";
            } else {
                console.error("Supabase Session Upload Error", error);
            }
        }

        // 2. Sync Goals
        const unsyncedGoals = state.goals.filter(g => g.sync_status === "PENDING");
        for (let g of unsyncedGoals) {
            const remoteObj = {
                date_string: g.date_string,
                exercise_type: g.exercise_type,
                target_value: g.target_value,
                user_id: state.userId
            };
            const { data, error } = await supabase.from("daily_goals").insert([remoteObj]).select();
            if (!error) {
                g.sync_status = "SYNCED";
            } else {
                console.error("Supabase Goal Upload Error", error);
            }
        }

        // Update local cache
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

// ----------------------------------------------------
// EVENT LISTENERS & SETUP
// ----------------------------------------------------
function init() {
    // Navigation Tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;
            
            // Toggle view visibility
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            // Toggle bottom navigation active state
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

    // Open Add Goal Modal
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

    // Add Goal Selector type toggling
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
        
        // Remove prior goal of same exercise for today
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
            SQUAT: 100,
            CRUNCH: 100,
            PUSH_UP: 100,
            RUNNING: 10000, // 10km (10000m)
            PULL_UP: 50,
            PLANK: 300 // 5m
        };

        // Filter out prior goals for today
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

    // Exercise Selection details modal triggers
    document.querySelectorAll(".exercise-card").forEach(card => {
        card.addEventListener("click", () => {
            const exerciseType = card.dataset.exercise;
            const t = translations[state.lang];
            
            document.getElementById("modal-title").textContent = t["ex_" + exerciseType.toLowerCase()];
            document.getElementById("modal-guide-text").textContent = t["guide_" + exerciseType.toLowerCase()];
            document.getElementById("btn-modal-start").dataset.exercise = exerciseType;

            // iOS Web permission check display
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

    // Request permissions manually for iOS if needed
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

    // Start workout from Info Modal
    document.getElementById("btn-modal-start").addEventListener("click", (e) => {
        const type = e.target.dataset.exercise;
        startWorkout(type);
    });

    // Overlay Finish / Discard controllers
    document.getElementById("btn-overlay-finish").addEventListener("click", () => {
        stopAndSaveWorkout();
    });
    
    document.getElementById("btn-overlay-cancel").addEventListener("click", () => {
        if (confirm(state.lang === 'vi' ? 'Bạn có muốn hủy bỏ buổi tập này không?' : 'Do you want to discard this workout?')) {
            discardWorkout();
        }
    });

    // Initialize display content
    updateLocalization();
    triggerSync();
}

// Safely execute init after DOM is parsed to avoid race conditions
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
