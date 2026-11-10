// ==============================================================
// EXERCISE LIBRARY - thresholds, coaching text & counting logic
// ==============================================================
// dir 'down': the tracked angle gets SMALLER to reach the target (squat, push-up...)
// dir 'up'  : the tracked angle gets BIGGER to reach the target (lateral raise...)
// mode 'hold': time based (plank) - "reps" = seconds held in good form

// MediaPipe landmark triplets [A, vertex, C] for left / right side
const JOINTS = {
    knee:     [[23, 25, 27], [24, 26, 28]], // hip - knee - ankle
    elbow:    [[11, 13, 15], [12, 14, 16]], // shoulder - elbow - wrist
    shoulder: [[23, 11, 13], [24, 12, 14]], // hip - shoulder - elbow
    hip:      [[11, 23, 25], [12, 24, 26]], // shoulder - hip - knee
    body:     [[11, 23, 27], [12, 24, 28]]  // shoulder - hip - ankle
};

const EXERCISES = {
    SQUAT: {
        name: 'Squat', icon: 'fa-person-arrow-down-to-line',
        joint: 'knee', jointLabel: 'Góc đầu gối', dir: 'down',
        top: 160, target: 95, perfect: 90, kcal: 0.35,
        restLabel: 'UP (ĐỨNG)', activeLabel: 'DOWN (ĐẠT)',
        view: 'Đặt camera phía trước hoặc chéo 45°, thấy toàn thân từ đầu tới chân.',
        tip: 'Hạ mông tới khi đùi song song sàn (gối < 95°) rồi đứng thẳng dậy.',
        msgs: {
            missing: 'Hãy lùi lại để camera thấy từ hông tới bàn chân',
            rest: 'Đang đứng thẳng. Hãy ngồi xổm xuống!',
            reached: 'Đã đạt chuẩn sâu! Đứng thẳng dậy nào!',
            deeper: 'Xuống sâu hơn nữa!',
            returning: 'Đứng thẳng hẳn lên để tính rep!',
            counted: 'Tuyệt vời! +1 Squat'
        }
    },
    LUNGE: {
        name: 'Chùng chân', icon: 'fa-person-walking',
        joint: 'knee', jointLabel: 'Góc gối trước', dir: 'down',
        top: 160, target: 100, perfect: 90, kcal: 0.4,
        restLabel: 'UP (ĐỨNG)', activeLabel: 'DOWN (ĐẠT)',
        view: 'Đặt camera bên cạnh hoặc chéo 45°, thấy toàn thân.',
        tip: 'Bước dài, hạ gối sau gần chạm sàn (gối trước < 100°), lưng thẳng, rồi đứng lên.',
        msgs: {
            missing: 'Hãy lùi lại để camera thấy rõ hai chân',
            rest: 'Đứng thẳng. Bước chân và hạ người xuống!',
            reached: 'Đạt độ sâu! Đẩy người đứng lên!',
            deeper: 'Hạ gối thấp hơn nữa!',
            returning: 'Đứng thẳng hẳn lên để tính rep!',
            counted: 'Chuẩn! +1 Lunge'
        }
    },
    PUSHUP: {
        name: 'Hít đất', icon: 'fa-angles-down',
        joint: 'elbow', jointLabel: 'Góc khuỷu tay', dir: 'down',
        top: 150, target: 90, perfect: 80, kcal: 0.45, requireHorizontal: true,
        restLabel: 'UP (CHỐNG)', activeLabel: 'DOWN (ĐẠT)',
        view: 'Đặt camera sát sàn, nhìn ngang từ bên cạnh, thấy từ vai tới bàn chân.',
        tip: 'Giữ thân thẳng, hạ ngực tới khi khuỷu tay < 90°, rồi đẩy lên duỗi thẳng tay.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ tay và thân người',
            position: 'Vào tư thế chống đẩy (thân nằm ngang)',
            rest: 'Tay thẳng. Hạ ngực xuống nào!',
            reached: 'Đủ sâu! Đẩy lên!',
            deeper: 'Hạ thấp hơn nữa (< 90°)!',
            returning: 'Duỗi thẳng tay hẳn để tính rep!',
            counted: 'Mạnh lắm! +1 Hít đất'
        }
    },
    CURL: {
        name: 'Gập tạ tay', icon: 'fa-dumbbell',
        joint: 'elbow', jointLabel: 'Góc khuỷu tay', dir: 'down', arm: true,
        top: 150, target: 48, perfect: 45, kcal: 0.3,
        restLabel: 'DOWN (DUỖI)', activeLabel: 'UP (ĐỈNH GẬP)',
        view: 'Đứng trước hoặc nghiêng camera, thấy rõ vai, khuỷu và cổ tay.',
        tip: 'Giữ khuỷu sát người, gập tạ lên sát vai (< 48°) rồi hạ có kiểm soát.',
        msgs: {
            missing: 'Hãy đứng để camera thấy rõ cánh tay và khuỷu tay',
            rest: 'Tay duỗi thẳng. Gập tạ lên nào!',
            reached: 'Đã đạt đỉnh gập! Hạ tạ có kiểm soát!',
            deeper: 'Gập cao hơn nữa!',
            returning: 'Duỗi thẳng tay hẳn xuống để tính rep!',
            counted: 'Chuẩn đỉnh! +1 Rep'
        }
    },
    SHOULDER_PRESS: {
        name: 'Đẩy vai', icon: 'fa-angles-up',
        joint: 'elbow', jointLabel: 'Góc khuỷu tay', dir: 'up', arm: true,
        top: 100, target: 155, perfect: 165, kcal: 0.3, requireWristAbove: true,
        restLabel: 'DOWN (NGANG VAI)', activeLabel: 'UP (DUỖI)',
        view: 'Đứng đối diện camera, thấy rõ từ hông tới đỉnh đầu và hai tay.',
        tip: 'Bắt đầu với tạ ngang vai (khuỷu < 100°), đẩy thẳng lên đầu (> 155°) rồi hạ về.',
        msgs: {
            missing: 'Hãy để camera thấy rõ vai và hai tay',
            rest: 'Tạ ngang vai. Đẩy lên nào!',
            reached: 'Duỗi thẳng rồi! Hạ tạ về ngang vai!',
            deeper: 'Đẩy cao hơn, duỗi thẳng tay!',
            returning: 'Hạ tạ về ngang vai để tính rep!',
            counted: 'Tốt lắm! +1 Đẩy vai'
        }
    },
    LATERAL_RAISE: {
        name: 'Nâng tạ ngang', icon: 'fa-arrows-left-right-to-line',
        joint: 'shoulder', jointLabel: 'Góc vai', dir: 'up', arm: true,
        top: 35, target: 80, perfect: 85, kcal: 0.2,
        restLabel: 'DOWN (THẢ)', activeLabel: 'UP (NGANG VAI)',
        view: 'Đứng đối diện camera, thấy rõ hai tay và hông.',
        tip: 'Tay hơi chùng, nâng tạ sang ngang tới ngang vai (> 80°) rồi hạ chậm.',
        msgs: {
            missing: 'Hãy để camera thấy rõ vai, khuỷu tay và hông',
            rest: 'Tay thả xuôi. Nâng sang ngang nào!',
            reached: 'Ngang vai rồi! Hạ chậm xuống!',
            deeper: 'Nâng cao hơn tới ngang vai!',
            returning: 'Hạ tay xuống hẳn để tính rep!',
            counted: 'Đẹp! +1 Nâng tạ'
        }
    },
    JUMPING_JACK: {
        name: 'Bật nhảy', icon: 'fa-child-reaching',
        joint: 'shoulder', jointLabel: 'Góc vai', dir: 'up',
        top: 50, target: 140, perfect: 150, kcal: 0.2,
        restLabel: 'KHÉP', activeLabel: 'DANG (ĐẠT)',
        view: 'Đứng đối diện camera, lùi xa để thấy toàn thân khi dang tay.',
        tip: 'Bật nhảy dang chân, vung hai tay qua đầu (> 140°), rồi khép lại.',
        msgs: {
            missing: 'Lùi xa hơn để camera thấy toàn thân',
            rest: 'Tay khép. Bật nhảy dang tay lên!',
            reached: 'Tay qua đầu! Khép lại!',
            deeper: 'Vung tay cao qua đầu!',
            returning: 'Khép tay xuống hẳn để tính rep!',
            counted: '+1 Jumping Jack'
        }
    },
    SITUP: {
        name: 'Gập bụng', icon: 'fa-rotate-left',
        joint: 'hip', jointLabel: 'Góc hông', dir: 'down',
        top: 115, target: 70, perfect: 60, kcal: 0.3,
        restLabel: 'NẰM', activeLabel: 'NGỒI (ĐẠT)',
        view: 'Đặt camera sát sàn, nhìn ngang từ bên cạnh, thấy từ đầu tới gối.',
        tip: 'Co gối, nằm xuống rồi gập người ngồi dậy tới khi góc hông < 70°.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ vai, hông và gối',
            rest: 'Đang nằm. Gập bụng ngồi dậy!',
            reached: 'Đạt! Nằm xuống có kiểm soát!',
            deeper: 'Gập người lên cao hơn!',
            returning: 'Nằm xuống hẳn để tính rep!',
            counted: 'Khỏe! +1 Gập bụng'
        }
    },
    PLANK: {
        name: 'Plank', icon: 'fa-stopwatch', mode: 'hold', unit: 'giây',
        joint: 'body', jointLabel: 'Độ thẳng thân', dir: 'up',
        top: 130, target: 160, perfect: 168, kcal: 0.08, requireHorizontal: true,
        restLabel: 'NGHỈ', activeLabel: 'GIỮ (ĐẠT)',
        view: 'Đặt camera sát sàn, nhìn ngang từ bên cạnh, thấy từ vai tới bàn chân.',
        tip: 'Chống khuỷu tay, giữ vai - hông - gót thẳng hàng (> 160°). Đồng hồ chỉ chạy khi đúng tư thế.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ vai, hông và chân',
            position: 'Vào tư thế plank (thân nằm ngang)',
            deeper: 'Thẳng lưng! Giữ vai - hông - gót thẳng hàng',
            counted: 'Giữ vững!'
        }
    }
};

const EXERCISE_ORDER = ['SQUAT', 'LUNGE', 'PUSHUP', 'CURL', 'SHOULDER_PRESS', 'LATERAL_RAISE', 'JUMPING_JACK', 'SITUP', 'PLANK'];

const unitOf = (type) => (EXERCISES[type] && EXERCISES[type].unit) || 'rep';

// ---------- counting state ----------
let repStage = 'REST';     // 'REST' | 'ACTIVE'
let bestAngleInRep = null; // deepest (down) / highest (up) angle of the current rep
let holdAccumMs = 0;       // plank: time held in good form
let lastHoldTs = null;

function resetExerciseState() {
    repStage = 'REST';
    bestAngleInRep = null;
    holdAccumMs = 0;
    lastHoldTs = null;
}

// Angle (deg) of the body line shoulder -> ankle (or hip) from horizontal; null if not visible
function bodyTilt(lm, width, height) {
    const sides = [[11, 23, 27], [12, 24, 28]].map(([s, h, a]) => ({
        s: lm[s], h: lm[h], a: lm[a],
        vis: ((lm[s]?.visibility ?? 0) + (lm[h]?.visibility ?? 0)) / 2
    })).sort((x, y) => y.vis - x.vis);
    const best = sides[0];
    if (!best || best.vis < VIS_THRESHOLD) return null;
    const end = isVisible(best.a) ? best.a : best.h;
    const dx = Math.abs(end.x - best.s.x) * width;
    const dy = Math.abs(end.y - best.s.y) * height;
    if (dx + dy < 1) return null;
    return Math.atan2(dy, dx) * 180 / Math.PI;
}

function gaugePercent(cfg, angle) {
    const start = cfg.dir === 'down' ? cfg.top + 10 : cfg.top - 10;
    const pct = (cfg.dir === 'down' ? start - angle : angle - start) / Math.abs(cfg.target - start) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
}

function isTargetAngle(cfg, angle) {
    return cfg.dir === 'down' ? angle <= cfg.target : angle >= cfg.target;
}

function updateGauge(cfg, angle) {
    angleValEl.textContent = `${angle}°`;
    gaugeFillEl.style.width = `${gaugePercent(cfg, angle)}%`;
}

// Called for every frame with landmarks
function processExercise(lm, width, height) {
    const cfg = EXERCISES[currentExercise];
    const [leftIdx, rightIdx] = JOINTS[cfg.joint];
    const side = pickSide(lm, leftIdx, rightIdx, cfg.arm ? selectedArmMode : 'BOTH');
    if (!side) {
        setFeedback(cfg.msgs.missing, 'ready');
        if (cfg.mode === 'hold') lastHoldTs = null;
        return;
    }
    const v = toPx(side.vertex, width, height);

    // Position gates (push-up / plank must be horizontal, press must be overhead)
    let positionOk = true;
    if (cfg.requireHorizontal) {
        const tilt = bodyTilt(lm, width, height);
        positionOk = tilt !== null && tilt < 40;
    }
    let activeOk = true;
    if (cfg.requireWristAbove) {
        const [shoulder, , wrist] = side.pts;
        activeOk = wrist.y < shoulder.y;
    }

    const reached = isTargetAngle(cfg, side.angle) && positionOk && activeOk;
    drawJointAngleLabel(canvasCtx, v.x, v.y, side.angle, reached);
    updateGauge(cfg, side.angle);

    if (cfg.mode === 'hold') {
        processHold(cfg, side.angle, positionOk);
        return;
    }
    if (!positionOk) {
        setFeedback(cfg.msgs.position, 'warning');
        return;
    }
    processRep(cfg, side.angle, activeOk);
}

function processRep(cfg, angle, activeOk) {
    const down = cfg.dir === 'down';
    const atRest = down ? angle > cfg.top : angle < cfg.top;
    const atTarget = isTargetAngle(cfg, angle) && activeOk;
    const trackBest = () => {
        bestAngleInRep = bestAngleInRep === null ? angle : (down ? Math.min(bestAngleInRep, angle) : Math.max(bestAngleInRep, angle));
    };

    if (atRest) {
        if (repStage === 'ACTIVE') {
            repCount++;
            repStage = 'REST';
            const good = down ? bestAngleInRep <= cfg.perfect : bestAngleInRep >= cfg.perfect;
            formScores.push(good ? 100 : 80);
            updateStatsDisplay();
            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(repCount);
            setFeedback(`${cfg.msgs.counted} (${bestAngleInRep}°)`, 'good');
        } else {
            setFeedback(cfg.msgs.rest, 'ready');
        }
        bestAngleInRep = null;
        stageBadgeEl.textContent = cfg.restLabel;
    } else if (atTarget) {
        repStage = 'ACTIVE';
        trackBest();
        stageBadgeEl.textContent = cfg.activeLabel;
        setFeedback(cfg.msgs.reached, 'good');
    } else {
        trackBest();
        setFeedback(repStage === 'REST' ? cfg.msgs.deeper : cfg.msgs.returning, repStage === 'REST' ? 'warning' : 'ready');
    }
}

// Plank: count seconds only while the body is straight and horizontal
function processHold(cfg, angle, positionOk) {
    const ok = positionOk && angle >= cfg.target;
    const now = performance.now();

    if (!ok) {
        lastHoldTs = null;
        stageBadgeEl.textContent = cfg.restLabel;
        setFeedback(positionOk ? cfg.msgs.deeper : cfg.msgs.position, 'warning');
        return;
    }

    if (lastHoldTs !== null) holdAccumMs += Math.min(now - lastHoldTs, 500); // ignore long frame gaps
    lastHoldTs = now;
    stageBadgeEl.textContent = cfg.activeLabel;

    const secs = Math.floor(holdAccumMs / 1000);
    if (secs > repCount) {
        repCount = secs;
        formScores.push(angle >= cfg.perfect ? 100 : 80);
        updateStatsDisplay();
        if (secs % 10 === 0) {
            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(secs);
        }
    }
    setFeedback(`${cfg.msgs.counted} ${secs} giây`, 'good');
}
