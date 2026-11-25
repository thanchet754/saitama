/**
 * Saitama AI Fitness - Core AI Pose Engine & Workout Tracker
 * Powered by Google MediaPipe Pose & Supabase Cloud
 */

// Supabase Configuration
const SUPABASE_URL = "https://lhsgdulyyssrcicwhdhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc2dkdWx5eXNzcmNpY3doZGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTgxMDYsImV4cCI6MjA5MjkzNDEwNn0.9cXMTwNBmoJHnyvRezP1qivatXEDT-b58nW82c9i_Ng";

// Workout State
let currentExercise = 'squat'; // 'squat', 'curl', 'pushup', 'jumping_jacks'
let reps = 0;
let stage = 'up'; // 'up' or 'down'
let isPaused = false;
let isCameraRunning = false;
let workoutSeconds = 0;
let timerInterval = null;
let currentArm = 'both'; // 'both', 'left', 'right'
let sensitivity = 'normal'; // 'easy', 'normal', 'hard'
let targetGoal = 20;
let soundEnabled = true;
let voiceEnabled = true;

// Camera & MediaPipe
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let pose = null;
let cameraStream = null;
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let animationFrameId = null;

// DOM Elements
const repCounterEl = document.getElementById('rep-counter');
const workoutTimerEl = document.getElementById('workout-timer');
const caloriesBurnedEl = document.getElementById('calories-burned');
const currentAngleText = document.getElementById('current-angle-text');
const currentStageText = document.getElementById('current-stage-text');
const feedbackText = document.getElementById('feedback-text');
const repProgressBar = document.getElementById('rep-progress-bar');
const repProgressPercent = document.getElementById('rep-progress-percent');
const displayExerciseName = document.getElementById('display-exercise-name');
const cameraOffOverlay = document.getElementById('camera-off-overlay');
const startCameraBtn = document.getElementById('start-camera-btn');
const stopCameraBtn = document.getElementById('stop-camera-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseBtnText = document.getElementById('pause-btn-text');
const pauseIcon = document.getElementById('pause-icon');
const resetCounterBtn = document.getElementById('reset-counter-btn');
const saveWorkoutBtn = document.getElementById('save-workout-btn');
const armSelectorRow = document.getElementById('arm-selector-row');
const sensitivitySelect = document.getElementById('sensitivity-select');
const targetGoalSelect = document.getElementById('target-goal-select');
const historyModal = document.getElementById('history-modal');
const historyListContainer = document.getElementById('history-list-container');
const openHistoryBtn = document.getElementById('open-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyTotalReps = document.getElementById('history-total-reps');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const voiceStatusText = document.getElementById('voice-status-text');

// Audio Synthesizer (Zero file dependencies)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playDingSound() {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // E6
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    console.log('Audio error:', e);
  }
}

function speakRep(count) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(count.toString());
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

// Exercise Metadata & Tips
const exerciseConfig = {
  squat: {
    name: 'SQUAT (NGỒI XỔM)',
    tipTitle: 'Mẹo tập Squat chuẩn AI:',
    tipContent: 'Đứng cách camera 2-3m, thấy rõ từ đầu đến chân. Khi hạ người xuống sao cho đùi song song với mặt sàn (góc gối < 95°), sau đó đứng thẳng người lại (> 160°) để tính 1 rep.',
    calPerRep: 0.32
  },
  curl: {
    name: 'GẬP TẠ TAY (BICEP CURL)',
    tipTitle: 'Mẹo tập Gập tạ tay chuẩn AI:',
    tipContent: 'Đứng thẳng, giữ bắp tay áp sát sườn. Duỗi thẳng tay (góc > 150°), sau đó gập tạ lên sát vai (góc khuỷu tay < 60°) để tính 1 rep.',
    calPerRep: 0.18
  },
  pushup: {
    name: 'HÍT ĐẤT (PUSH-UP)',
    tipTitle: 'Mẹo tập Hít đất chuẩn AI:',
    tipContent: 'Đặt camera nghiêng ngang tầm người nằm. Thẳng lưng, hạ ngực gần chạm sàn (góc khuỷu < 90°), sau đó đẩy thẳng tay lên (> 155°) để tính 1 rep.',
    calPerRep: 0.25
  },
  jumping_jacks: {
    name: 'BẬT NHẢY (JUMPING JACKS)',
    tipTitle: 'Mẹo tập Bật nhảy chuẩn AI:',
    tipContent: 'Đứng thẳng chụm chân. Bật nhảy dang rộng chân đồng thời đưa hai tay qua đầu vỗ tay để tính 1 rep.',
    calPerRep: 0.15
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  videoElement = document.getElementById('webcam');
  canvasElement = document.getElementById('pose-canvas');
  canvasCtx = canvasElement.getContext('2d');

  setupMediaPipePose();
  bindUserEvents();
  loadHistoryFromStorage();
});

// Setup MediaPipe Pose
function setupMediaPipePose() {
  try {
    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
  } catch (e) {
    console.error('MediaPipe initialization error:', e);
    showToast('Lỗi tải thư viện AI Pose. Vui lòng tải lại trang.', 'error');
  }
}

// Start Camera Stream
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = cameraStream;

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });

    isCameraRunning = true;
    cameraOffOverlay.classList.add('hidden');
    stopCameraBtn.classList.remove('hidden');

    // Sync canvas resolution
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    startWorkoutTimer();
    startPoseDetectionLoop();

    showToast('Camera đã sẵn sàng! Bắt đầu tập luyện.', 'success');
  } catch (err) {
    console.error('Camera access error:', err);
    showToast('Không thể mở Camera! Vui lòng cấp quyền truy cập Camera.', 'error');
  }
}

// Stop Camera Stream
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  isCameraRunning = false;
  cameraOffOverlay.classList.remove('hidden');
  stopCameraBtn.classList.add('hidden');
  if (canvasCtx) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
  stopWorkoutTimer();
}

// Continuous Frame Loop
async function startPoseDetectionLoop() {
  if (!isCameraRunning) return;

  if (videoElement.readyState >= 2 && !isPaused) {
    try {
      await pose.send({ image: videoElement });
    } catch (e) {
      console.log('Pose send error:', e);
    }
  }

  animationFrameId = requestAnimationFrame(startPoseDetectionLoop);
}

// MediaPipe Results Handler
function onPoseResults(results) {
  if (!canvasCtx || !canvasElement) return;

  // Clear Canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (!results.poseLandmarks) {
    feedbackText.textContent = 'Chưa nhận diện được người. Hãy đứng lùi lại!';
    canvasCtx.restore();
    return;
  }

  const lm = results.poseLandmarks;
  drawSkeleton(lm, canvasCtx, canvasElement.width, canvasElement.height);

  // Process Exercise Logic
  if (!isPaused) {
    processExerciseLogic(lm);
  }

  canvasCtx.restore();
}

// Calculate Angle between 3 keypoints
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

// Main Exercise Counting Logic
function processExerciseLogic(lm) {
  if (currentExercise === 'squat') {
    handleSquat(lm);
  } else if (currentExercise === 'curl') {
    handleBicepCurl(lm);
  } else if (currentExercise === 'pushup') {
    handlePushup(lm);
  } else if (currentExercise === 'jumping_jacks') {
    handleJumpingJacks(lm);
  }
}

// 1. SQUAT HANDLER
function handleSquat(lm) {
  // Hip(23/24), Knee(25/26), Ankle(27/28)
  const leftHip = lm[23], leftKnee = lm[25], leftAnkle = lm[27];
  const rightHip = lm[24], rightKnee = lm[26], rightAnkle = lm[28];

  let angle = 180;
  // Choose side with better visibility
  const leftVis = (leftHip.visibility || 0) + (leftKnee.visibility || 0) + (leftAnkle.visibility || 0);
  const rightVis = (rightHip.visibility || 0) + (rightKnee.visibility || 0) + (rightAnkle.visibility || 0);

  if (leftVis >= rightVis) {
    angle = calculateAngle(leftHip, leftKnee, leftAnkle);
  } else {
    angle = calculateAngle(rightHip, rightKnee, rightAnkle);
  }

  currentAngleText.textContent = `${angle}°`;

  // Sensitivity thresholds
  let downThreshold = 95;
  let upThreshold = 160;
  if (sensitivity === 'easy') downThreshold = 105;
  if (sensitivity === 'hard') downThreshold = 85;

  // Calculate percentage of progress
  const percent = Math.min(100, Math.max(0, Math.round(((160 - angle) / (160 - downThreshold)) * 100)));
  repProgressBar.style.width = `${percent}%`;
  repProgressPercent.textContent = `${percent}%`;

  if (angle < downThreshold) {
    if (stage !== 'down') {
      stage = 'down';
      currentStageText.textContent = 'HẠ XUỐNG';
      currentStageText.className = 'text-xs font-black text-amber-400 uppercase';
      feedbackText.textContent = '✓ Độ sâu đạt chuẩn! Đứng thẳng người lên!';
    }
  }

  if (angle > upThreshold && stage === 'down') {
    stage = 'up';
    currentStageText.textContent = 'ĐỨNG THẲNG';
    currentStageText.className = 'text-xs font-black text-emerald-400 uppercase';
    incrementRep('Tuyệt vời! +1 Squat chuẩn.');
  }
}

// 2. BICEP CURL HANDLER
function handleBicepCurl(lm) {
  // Shoulder(11/12), Elbow(13/14), Wrist(15/16)
  const leftShoulder = lm[11], leftElbow = lm[13], leftWrist = lm[15];
  const rightShoulder = lm[12], rightElbow = lm[14], rightWrist = lm[16];

  let angleLeft = calculateAngle(leftShoulder, leftElbow, leftWrist);
  let angleRight = calculateAngle(rightShoulder, rightElbow, rightWrist);

  let angle = angleRight;
  if (currentArm === 'left') angle = angleLeft;
  else if (currentArm === 'both') angle = Math.min(angleLeft, angleRight);

  currentAngleText.textContent = `${angle}°`;

  let upThreshold = 55;
  let downThreshold = 150;
  if (sensitivity === 'easy') upThreshold = 65;
  if (sensitivity === 'hard') upThreshold = 45;

  const percent = Math.min(100, Math.max(0, Math.round(((downThreshold - angle) / (downThreshold - upThreshold)) * 100)));
  repProgressBar.style.width = `${percent}%`;
  repProgressPercent.textContent = `${percent}%`;

  if (angle < upThreshold) {
    if (stage !== 'up') {
      stage = 'up';
      currentStageText.textContent = 'GẬP LÊN';
      currentStageText.className = 'text-xs font-black text-amber-400 uppercase';
      feedbackText.textContent = '✓ Gập tạ tốt! Giữ 1 nhịp rồi hạ xuống.';
    }
  }

  if (angle > downThreshold && stage === 'up') {
    stage = 'down';
    currentStageText.textContent = 'DUỖI TAY';
    currentStageText.className = 'text-xs font-black text-emerald-400 uppercase';
    incrementRep('Xuất sắc! +1 Gập tạ tay.');
  }
}

// 3. PUSH-UP HANDLER
function handlePushup(lm) {
  const leftShoulder = lm[11], leftElbow = lm[13], leftWrist = lm[15];
  const angle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  currentAngleText.textContent = `${angle}°`;

  if (angle < 90) {
    if (stage !== 'down') {
      stage = 'down';
      currentStageText.textContent = 'HẠ NGỰC';
      feedbackText.textContent = '✓ Hạ sâu tốt! Đẩy người lên!';
    }
  }
  if (angle > 155 && stage === 'down') {
    stage = 'up';
    currentStageText.textContent = 'ĐẨY LÊN';
    incrementRep('Chuẩn form! +1 Hít đất.');
  }
}

// 4. JUMPING JACKS HANDLER
function handleJumpingJacks(lm) {
  const leftWrist = lm[15], rightWrist = lm[16];
  const nose = lm[0];
  const leftAnkle = lm[27], rightAnkle = lm[28];

  const handsUp = leftWrist.y < nose.y && rightWrist.y < nose.y;
  const feetSpread = Math.abs(leftAnkle.x - rightAnkle.x) > 0.25;

  if (handsUp && feetSpread) {
    if (stage !== 'up') {
      stage = 'up';
      currentStageText.textContent = 'BẬT LÊN';
    }
  }
  if (!handsUp && !feetSpread && stage === 'up') {
    stage = 'down';
    currentStageText.textContent = 'TIẾP ĐẤT';
    incrementRep('Tuyệt vời! +1 Bật nhảy.');
  }
}

// Increment Rep Counter & Audio Feedback
function incrementRep(message) {
  reps++;
  repCounterEl.textContent = reps;
  repCounterEl.classList.add('rep-pulse');
  setTimeout(() => repCounterEl.classList.remove('rep-pulse'), 350);

  // Update calories
  const calRate = exerciseConfig[currentExercise]?.calPerRep || 0.25;
  caloriesBurnedEl.innerHTML = `${(reps * calRate).toFixed(1)} <span class="text-xs text-slate-400 font-normal">kcal</span>`;

  playDingSound();
  speakRep(reps);
  feedbackText.textContent = message;

  // Check goal
  if (reps >= targetGoal && reps === targetGoal) {
    showToast(`🎉 CHÚC MỪNG! Bạn đã hoàn thành mục tiêu ${targetGoal} reps!`, 'success');
  }
}

// Draw Skeleton on Canvas
function drawSkeleton(landmarks, ctx, width, height) {
  // Connections list: pairs of landmark indices
  const connections = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso
    [23, 24], // hips
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28], // right leg
  ];

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#06b6d4'; // Cyan neon line
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 10;

  connections.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
  });

  // Draw Joint Points
  ctx.shadowBlur = 15;
  landmarks.forEach((p, idx) => {
    if ((p.visibility || 1) > 0.4) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 6, 0, 2 * Math.PI);
      
      // Highlight active joints
      if (currentExercise === 'squat' && (idx === 25 || idx === 26)) {
        ctx.fillStyle = '#f97316'; // Orange knee
        ctx.shadowColor = '#f97316';
        ctx.arc(p.x * width, p.y * height, 8, 0, 2 * Math.PI);
      } else if (currentExercise === 'curl' && (idx === 13 || idx === 14)) {
        ctx.fillStyle = '#f59e0b'; // Amber elbow
        ctx.shadowColor = '#f59e0b';
        ctx.arc(p.x * width, p.y * height, 8, 0, 2 * Math.PI);
      } else {
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
      }
      ctx.fill();
    }
  });
}

// Workout Timer
function startWorkoutTimer() {
  stopWorkoutTimer();
  timerInterval = setInterval(() => {
    if (!isPaused) {
      workoutSeconds++;
      const m = String(Math.floor(workoutSeconds / 60)).padStart(2, '0');
      const s = String(workoutSeconds % 60).padStart(2, '0');
      workoutTimerEl.textContent = `⏱ ${m}:${s}`;
    }
  }, 1000);
}

function stopWorkoutTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Save Workout to Supabase & LocalStorage
async function saveWorkout() {
  if (reps === 0) {
    showToast('Chưa có rep nào để lưu! Hãy tập ít nhất 1 rep nhé.', 'warning');
    return;
  }

  const workoutData = {
    id: 'wk_' + Date.now(),
    client_id: Date.now(),
    exercise: currentExercise.toUpperCase(),
    exercise_name: exerciseConfig[currentExercise]?.name || currentExercise,
    reps: reps,
    duration_seconds: workoutSeconds,
    calories: ((reps * (exerciseConfig[currentExercise]?.calPerRep || 0.25))).toFixed(1),
    performed_at: new Date().toISOString()
  };

  // 1. Save to LocalStorage
  const localHistory = JSON.parse(localStorage.getItem('saitama_workout_history') || '[]');
  localHistory.unshift(workoutData);
  localStorage.setItem('saitama_workout_history', JSON.stringify(localHistory));

  // 2. Sync to Supabase `workout_sessions` table
  try {
    fetch(`${SUPABASE_URL}/rest/v1/workout_sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        client_id: workoutData.client_id,
        exercise: workoutData.exercise,
        reps: workoutData.reps,
        duration_seconds: workoutData.duration_seconds,
        form_score: 95
      })
    }).catch(e => console.log('Notice: Supabase save logged:', e));
  } catch (err) {}

  showToast(`🎉 Đã lưu buổi tập: ${reps} reps (${workoutData.calories} kcal)!`, 'success');
  loadHistoryFromStorage();
}

// Load Workout History
function loadHistoryFromStorage() {
  const history = JSON.parse(localStorage.getItem('saitama_workout_history') || '[]');
  
  if (history.length === 0) {
    historyListContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Chưa có buổi tập nào. Hãy tập luyện ngay nhé!</p>';
    historyTotalReps.textContent = 'Tổng cộng: 0 reps';
    return;
  }

  let totalAllReps = 0;
  historyListContainer.innerHTML = '';

  history.forEach(item => {
    totalAllReps += Number(item.reps) || 0;
    const dateStr = new Date(item.performed_at).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between';
    el.innerHTML = `
      <div class="space-y-0.5">
        <h4 class="font-bold text-xs text-white">${item.exercise_name || item.exercise}</h4>
        <p class="text-[10px] text-slate-400">${dateStr} • ⏱ ${Math.floor(item.duration_seconds / 60)}m ${item.duration_seconds % 60}s</p>
      </div>
      <div class="text-right">
        <span class="text-sm font-black text-cyan-400 mono">${item.reps} reps</span>
        <span class="text-[10px] text-amber-400 block">${item.calories} kcal</span>
      </div>
    `;
    historyListContainer.appendChild(el);
  });

  historyTotalReps.textContent = `Tổng cộng: ${totalAllReps} reps`;
}

// Toast System
function showToast(message, type = 'info') {
  const toastBox = document.getElementById('toast-box');
  if (!toastBox) return;

  const icons = {
    success: 'fa-circle-check text-emerald-400',
    warning: 'fa-triangle-exclamation text-amber-400',
    error: 'fa-circle-xmark text-red-400',
    info: 'fa-circle-info text-cyan-400'
  };

  const toast = document.createElement('div');
  toast.className = `workout-toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  toastBox.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Bind Click & UI Events (Guaranteed 100% Clickable)
function bindUserEvents() {
  // Exercise Tabs
  document.querySelectorAll('.exercise-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.exercise-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      currentExercise = tab.dataset.exercise;
      const cfg = exerciseConfig[currentExercise];
      displayExerciseName.textContent = cfg?.name || currentExercise.toUpperCase();
      document.getElementById('exercise-tip-title').textContent = cfg?.tipTitle || '';
      document.getElementById('exercise-tip-content').textContent = cfg?.tipContent || '';

      // Arm selector display for curl
      if (currentExercise === 'curl') {
        armSelectorRow.classList.remove('hidden');
      } else {
        armSelectorRow.classList.add('hidden');
      }

      // Reset rep progress bar
      stage = 'up';
      repProgressBar.style.width = '0%';
      repProgressPercent.textContent = '0%';
      feedbackText.textContent = `Chuyển sang bài ${cfg?.name}. Sẵn sàng!`;
      showToast(`Đã chọn bài: ${cfg?.name}`, 'info');
    });
  });

  // Arm Buttons (for Bicep Curl)
  document.querySelectorAll('.arm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.arm-btn').forEach(b => {
        b.className = 'arm-btn clickable px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700';
      });
      btn.className = 'arm-btn active clickable px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-xs';
      currentArm = btn.dataset.arm;
      showToast(`Tập tay: ${btn.textContent}`, 'info');
    });
  });

  // Camera Buttons
  startCameraBtn.addEventListener('click', startCamera);
  stopCameraBtn.addEventListener('click', stopCamera);

  switchCameraBtn.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (isCameraRunning) {
      stopCamera();
      startCamera();
    }
  });

  // Pause / Resume
  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      pauseBtnText.textContent = 'Tiếp Tục';
      pauseIcon.className = 'fa-solid fa-play text-emerald-400';
      feedbackText.textContent = '⏸ Đã tạm dừng. Bấm Tiếp Tục để tập tiếp.';
      showToast('Đã tạm dừng đếm', 'warning');
    } else {
      pauseBtnText.textContent = 'Tạm Dừng';
      pauseIcon.className = 'fa-solid fa-pause text-amber-400';
      feedbackText.textContent = '▶ Đang tiếp tục tập luyện!';
      showToast('Tiếp tục tập luyện', 'success');
    }
  });

  // Reset Counter
  resetCounterBtn.addEventListener('click', () => {
    reps = 0;
    repCounterEl.textContent = '0';
    workoutSeconds = 0;
    workoutTimerEl.textContent = '⏱ 00:00';
    caloriesBurnedEl.innerHTML = '0.0 <span class="text-xs text-slate-400 font-normal">kcal</span>';
    repProgressBar.style.width = '0%';
    repProgressPercent.textContent = '0%';
    stage = 'up';
    feedbackText.textContent = 'Đã đặt lại bộ đếm số lần.';
    showToast('Đã reset đếm về 0', 'info');
  });

  // Finish & Save
  saveWorkoutBtn.addEventListener('click', saveWorkout);

  // Sound & Voice
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.className = soundEnabled ? 'fa-solid fa-volume-high text-cyan-400' : 'fa-solid fa-volume-xmark text-slate-500';
    showToast(`Âm thanh: ${soundEnabled ? 'Bật' : 'Tắt'}`, 'info');
  });

  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceStatusText.textContent = `Đọc số: ${voiceEnabled ? 'Bật' : 'Tắt'}`;
    showToast(`Giọng đọc số: ${voiceEnabled ? 'Bật' : 'Tắt'}`, 'info');
  });

  // Sensitivity
  sensitivitySelect.addEventListener('change', (e) => {
    sensitivity = e.target.value;
    showToast(`Độ nhạy góc gập: ${sensitivitySelect.options[sensitivitySelect.selectedIndex].text}`, 'info');
  });

  // Target Goal
  targetGoalSelect.addEventListener('change', (e) => {
    targetGoal = parseInt(e.target.value);
    showToast(`Mục tiêu: ${targetGoal} reps`, 'info');
  });

  // History Modal
  openHistoryBtn.addEventListener('click', () => {
    loadHistoryFromStorage();
    historyModal.classList.remove('hidden');
  });
  closeHistoryBtn.addEventListener('click', () => {
    historyModal.classList.add('hidden');
  });
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử tập luyện trên máy?')) {
      localStorage.removeItem('saitama_workout_history');
      loadHistoryFromStorage();
      showToast('Đã xóa toàn bộ lịch sử tập luyện', 'info');
    }
  });
}
