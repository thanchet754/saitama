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

Object.assign(EXERCISES, {
    GLUTE_BRIDGE: {
        name: 'Nâng hông', icon: 'fa-bridge',
        joint: 'hip', jointLabel: 'Góc hông', dir: 'up',
        top: 140, target: 160, perfect: 168, kcal: 0.3,
        restLabel: 'HẠ', activeLabel: 'NÂNG (ĐẠT)',
        view: 'Nằm ngửa, đặt camera sát sàn nhìn ngang từ bên cạnh.',
        tip: 'Co gối, bàn chân sát mông, đẩy hông lên tới khi vai - hông - gối thẳng hàng (> 160°), siết mông rồi hạ.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ vai, hông và gối',
            rest: 'Hông đang hạ. Đẩy hông lên!',
            reached: 'Siết mông! Hạ hông xuống!',
            deeper: 'Đẩy hông cao hơn nữa!',
            returning: 'Hạ hông xuống hẳn để tính rep!',
            counted: 'Tốt! +1 Nâng hông'
        }
    },
    WALL_SIT: {
        name: 'Ngồi tựa tường', icon: 'fa-chair', mode: 'hold', unit: 'giây',
        joint: 'knee', jointLabel: 'Góc đầu gối', dir: 'down', holdRange: [70, 115],
        top: 150, target: 115, perfect: 100, kcal: 0.1,
        restLabel: 'NGHỈ', activeLabel: 'GIỮ (ĐẠT)',
        view: 'Tựa lưng vào tường, đặt camera bên cạnh thấy từ hông tới bàn chân.',
        tip: 'Trượt lưng xuống tới khi đùi gần song song sàn (gối 70° - 115°) và giữ. Đồng hồ chỉ chạy khi đúng tư thế.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ hông, gối và cổ chân',
            position: 'Tựa lưng vào tường',
            deeper: 'Hạ người tới khi đùi song song sàn!',
            counted: 'Giữ vững!'
        }
    },
    KNEE_PUSHUP: {
        name: 'Hít đất quỳ gối', icon: 'fa-angle-down',
        joint: 'elbow', jointLabel: 'Góc khuỷu tay', dir: 'down',
        top: 150, target: 95, perfect: 85, kcal: 0.3, requireHorizontal: 'torso',
        restLabel: 'UP (CHỐNG)', activeLabel: 'DOWN (ĐẠT)',
        view: 'Đặt camera sát sàn, nhìn ngang từ bên cạnh.',
        tip: 'Quỳ gối, thân thẳng từ vai tới gối, hạ ngực tới khi khuỷu < 95° rồi đẩy lên. Bản dễ của hít đất.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ tay và thân người',
            position: 'Vào tư thế chống đẩy quỳ gối',
            rest: 'Tay thẳng. Hạ ngực xuống nào!',
            reached: 'Đủ sâu! Đẩy lên!',
            deeper: 'Hạ thấp hơn nữa!',
            returning: 'Duỗi thẳng tay để tính rep!',
            counted: 'Tốt! +1 Hít đất'
        }
    },
    TRICEP_EXT: {
        name: 'Duỗi tay sau đầu', icon: 'fa-hand-back-fist', equipment: 'dumbbell',
        joint: 'elbow', jointLabel: 'Góc khuỷu tay', dir: 'up', arm: true, requireElbowUp: true,
        top: 75, target: 150, perfect: 160, kcal: 0.25,
        restLabel: 'GẬP SAU ĐẦU', activeLabel: 'DUỖI (ĐẠT)',
        view: 'Đứng nghiêng hoặc đối diện camera, thấy rõ vai, khuỷu và cổ tay.',
        tip: 'Giữ khuỷu tay sát tai, hạ tạ ra sau đầu (< 75°) rồi duỗi thẳng tay lên (> 150°). Tập cơ tay sau.',
        msgs: {
            missing: 'Hãy để camera thấy rõ vai, khuỷu và cổ tay',
            position: 'Đưa khuỷu tay lên cao cạnh tai',
            rest: 'Tạ sau đầu. Duỗi thẳng tay lên!',
            reached: 'Duỗi thẳng! Hạ tạ ra sau đầu!',
            deeper: 'Duỗi thẳng tay hơn nữa!',
            returning: 'Hạ tạ ra sau đầu để tính rep!',
            counted: 'Chuẩn! +1 Duỗi tay'
        }
    },
    FRONT_RAISE: {
        name: 'Nâng tạ trước', icon: 'fa-arrow-up-long', equipment: 'dumbbell',
        joint: 'shoulder', jointLabel: 'Góc vai', dir: 'up', arm: true,
        top: 35, target: 80, perfect: 85, kcal: 0.2,
        restLabel: 'DOWN (THẢ)', activeLabel: 'UP (NGANG VAI)',
        view: 'Đứng nghiêng 90° so với camera để thấy tay nâng về phía trước.',
        tip: 'Tay gần thẳng, nâng tạ ra phía trước tới ngang vai (> 80°) rồi hạ chậm. Tập vai trước.',
        msgs: {
            missing: 'Đứng nghiêng để camera thấy rõ vai, khuỷu và hông',
            rest: 'Tay thả xuôi. Nâng tạ ra trước!',
            reached: 'Ngang vai rồi! Hạ chậm!',
            deeper: 'Nâng cao hơn tới ngang vai!',
            returning: 'Hạ tay xuống hẳn để tính rep!',
            counted: 'Đẹp! +1 Nâng tạ trước'
        }
    },
    LEG_RAISE: {
        name: 'Nâng chân', icon: 'fa-arrow-turn-up',
        joint: 'hip', jointLabel: 'Góc hông', dir: 'down', requireHorizontal: 'torso',
        top: 155, target: 100, perfect: 90, kcal: 0.3,
        restLabel: 'HẠ CHÂN', activeLabel: 'NÂNG (ĐẠT)',
        view: 'Nằm ngửa, đặt camera sát sàn nhìn ngang từ bên cạnh.',
        tip: 'Nằm ngửa, chân thẳng, nâng chân lên tới khi góc hông < 100° rồi hạ chậm, không chạm sàn. Tập bụng dưới.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ vai, hông và chân',
            position: 'Nằm ngửa trên sàn',
            rest: 'Chân duỗi. Nâng chân lên!',
            reached: 'Đạt! Hạ chân chậm thôi!',
            deeper: 'Nâng chân cao hơn!',
            returning: 'Hạ chân xuống để tính rep!',
            counted: 'Khỏe! +1 Nâng chân'
        }
    },
    MOUNTAIN_CLIMBER: {
        name: 'Leo núi', icon: 'fa-mountain',
        joint: 'hip', jointLabel: 'Góc hông', dir: 'down', requireHorizontal: 'torso',
        top: 140, target: 100, perfect: 90, kcal: 0.15,
        restLabel: 'CHÂN DUỖI', activeLabel: 'GỐI SÁT NGỰC',
        view: 'Đặt camera sát sàn, nhìn ngang từ bên cạnh.',
        tip: 'Ở tư thế chống đẩy, lần lượt kéo từng gối về sát ngực thật nhanh. Mỗi lần kéo gối = 1 rep.',
        msgs: {
            missing: 'Đặt camera bên cạnh để thấy rõ thân và chân',
            position: 'Vào tư thế chống đẩy',
            rest: 'Kéo gối về ngực!',
            reached: 'Đổi chân!',
            deeper: 'Kéo gối sát ngực hơn!',
            returning: 'Duỗi chân ra sau!',
            counted: '+1'
        }
    },
    HIGH_KNEES: {
        name: 'Nâng gối cao', icon: 'fa-person-running',
        joint: 'hip', jointLabel: 'Góc hông', dir: 'down',
        top: 150, target: 105, perfect: 95, kcal: 0.1,
        restLabel: 'CHÂN XUỐNG', activeLabel: 'GỐI CAO',
        view: 'Đứng đối diện hoặc nghiêng camera, thấy toàn thân.',
        tip: 'Chạy tại chỗ, nâng gối lên ngang hông (< 105°), đổi chân liên tục. Mỗi lần nâng gối = 1 rep.',
        msgs: {
            missing: 'Lùi lại để camera thấy toàn thân',
            rest: 'Nâng gối lên cao!',
            reached: 'Đổi chân!',
            deeper: 'Nâng gối cao hơn ngang hông!',
            returning: 'Hạ chân xuống!',
            counted: '+1'
        }
    }
});

// Dumbbell exercises (marked so plans can skip them for "no equipment")
['CURL', 'SHOULDER_PRESS', 'LATERAL_RAISE'].forEach(k => { EXERCISES[k].equipment = 'dumbbell'; });

// Muscle groups, plan defaults (reps or seconds per set) and intensity (MET)
const MUSCLE_GROUPS = [
    { key: 'LEGS',     name: 'Chân & Mông',      icon: 'fa-person-arrow-down-to-line', items: ['SQUAT', 'LUNGE', 'GLUTE_BRIDGE', 'WALL_SIT'] },
    { key: 'CHEST',    name: 'Ngực',             icon: 'fa-angles-down',               items: ['PUSHUP', 'KNEE_PUSHUP'] },
    { key: 'SHOULDER', name: 'Vai',              icon: 'fa-angles-up',                 items: ['SHOULDER_PRESS', 'LATERAL_RAISE', 'FRONT_RAISE'] },
    { key: 'ARMS',     name: 'Tay trước & sau',  icon: 'fa-dumbbell',                  items: ['CURL', 'TRICEP_EXT'] },
    { key: 'CORE',     name: 'Bụng & Core',      icon: 'fa-shield-halved',             items: ['SITUP', 'LEG_RAISE', 'PLANK', 'MOUNTAIN_CLIMBER'] },
    { key: 'CARDIO',   name: 'Cardio',           icon: 'fa-heart-pulse',               items: ['JUMPING_JACK', 'HIGH_KNEES', 'MOUNTAIN_CLIMBER'] }
];

const EXERCISE_PLAN = {
    SQUAT:            { base: 15, met: 5.0, impact: 'low' },
    LUNGE:            { base: 12, met: 4.0, impact: 'low' },
    GLUTE_BRIDGE:     { base: 15, met: 3.5, impact: 'low' },
    WALL_SIT:         { base: 30, met: 3.5, impact: 'low' },
    PUSHUP:           { base: 10, met: 8.0, impact: 'low' },
    KNEE_PUSHUP:      { base: 10, met: 4.0, impact: 'low' },
    SHOULDER_PRESS:   { base: 12, met: 4.0, impact: 'low' },
    LATERAL_RAISE:    { base: 12, met: 3.5, impact: 'low' },
    FRONT_RAISE:      { base: 12, met: 3.5, impact: 'low' },
    CURL:             { base: 12, met: 3.5, impact: 'low' },
    TRICEP_EXT:       { base: 12, met: 3.5, impact: 'low' },
    SITUP:            { base: 15, met: 3.8, impact: 'low' },
    LEG_RAISE:        { base: 12, met: 3.8, impact: 'low' },
    PLANK:            { base: 30, met: 3.8, impact: 'low' },
    MOUNTAIN_CLIMBER: { base: 20, met: 8.0, impact: 'high' },
    JUMPING_JACK:     { base: 30, met: 8.0, impact: 'high' },
    HIGH_KNEES:       { base: 30, met: 8.0, impact: 'high' }
};

const groupOf = (type) => (MUSCLE_GROUPS.find(g => g.items.includes(type)) || {}).name || '';

const EXERCISE_ORDER = MUSCLE_GROUPS.flatMap(g => g.items).filter((k, i, a) => a.indexOf(k) === i);

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

// Angle (deg) of the body line shoulder -> ankle (or hip) from horizontal; null if not visible.
// ref 'torso' measures shoulder -> hip only (legs may move: leg raise, mountain climber...)
function bodyTilt(lm, width, height, ref) {
    const sides = [[11, 23, 27], [12, 24, 28]].map(([s, h, a]) => ({
        s: lm[s], h: lm[h], a: lm[a],
        vis: ((lm[s]?.visibility ?? 0) + (lm[h]?.visibility ?? 0)) / 2
    })).sort((x, y) => y.vis - x.vis);
    const best = sides[0];
    if (!best || best.vis < VIS_THRESHOLD) return null;
    const end = ref !== 'torso' && isVisible(best.a) ? best.a : best.h;
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
    // Guided workout: don't count during rest / get-ready countdown / pause
    if (window.Runner && Runner.isResting()) {
        if (EXERCISES[currentExercise].mode === 'hold') lastHoldTs = null;
        return;
    }
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
        const tilt = bodyTilt(lm, width, height, cfg.requireHorizontal);
        positionOk = tilt !== null && tilt < 40;
    }
    if (cfg.requireElbowUp) {
        const [shoulder, elbow] = side.pts;
        positionOk = elbow.y < shoulder.y + 0.02;
    }
    let activeOk = true;
    if (cfg.requireWristAbove) {
        const [shoulder, , wrist] = side.pts;
        activeOk = wrist.y < shoulder.y;
    }

    const targetOk = cfg.holdRange ? side.angle >= cfg.holdRange[0] && side.angle <= cfg.holdRange[1] : isTargetAngle(cfg, side.angle);
    const reached = targetOk && positionOk && activeOk;
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
    const inRange = cfg.holdRange ? angle >= cfg.holdRange[0] && angle <= cfg.holdRange[1] : angle >= cfg.target;
    const ok = positionOk && inRange;
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
        const perfect = cfg.holdRange ? Math.abs(angle - cfg.perfect) <= 12 : angle >= cfg.perfect;
        formScores.push(perfect ? 100 : 80);
        updateStatsDisplay();
        if (secs % 10 === 0) {
            triggerRepAnimation();
            playBeep(800, 0.12);
            speakRep(secs);
        }
    }
    setFeedback(`${cfg.msgs.counted} ${secs} giây`, 'good');
}
