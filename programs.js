// ==============================================================
// PROGRAMS: fitness profile (onboarding), daily combined plan,
// fat-burn HIIT by duration, guided workout runner
// ==============================================================
const PROFILE_TABLE = 'saitama_profiles';

let profile = null;          // { sex, age, height_cm, weight_kg, goal, level, minutes, equipment, completed: [] }

const GOALS = {
    lose:      { name: 'Giảm mỡ',       icon: 'fa-fire' },
    muscle:    { name: 'Tăng cơ',       icon: 'fa-dumbbell' },
    fit:       { name: 'Giữ dáng',      icon: 'fa-heart' },
    endurance: { name: 'Tăng sức bền',  icon: 'fa-bolt' }
};
const LEVELS = {
    beginner:     { name: 'Mới bắt đầu', mult: 0.7, sets: 2, rest: 40 },
    intermediate: { name: 'Trung bình',  mult: 1.0, sets: 3, rest: 30 },
    advanced:     { name: 'Nâng cao',    mult: 1.35, sets: 3, rest: 20 }
};
const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const WEEK_SPLIT = [
    { title: 'Phục hồi nhẹ',      groups: ['CORE', 'LEGS'], light: true },             // CN
    { title: 'Chân & Mông',       groups: ['LEGS', 'CORE'] },                          // T2
    { title: 'Ngực & Tay',        groups: ['CHEST', 'ARMS', 'CORE'] },                 // T3
    { title: 'Cardio & Bụng',     groups: ['CARDIO', 'CORE'] },                        // T4
    { title: 'Vai & Tay',         groups: ['SHOULDER', 'ARMS', 'CORE'] },              // T5
    { title: 'Toàn thân',         groups: ['LEGS', 'CHEST', 'SHOULDER', 'CORE'] },     // T6
    { title: 'Đốt mỡ toàn thân',  groups: ['CARDIO', 'LEGS', 'CORE', 'CHEST'] }        // T7
];
// Bodyweight-only week (shoulder/arm moves all need dumbbells)
const WEEK_SPLIT_BODYWEIGHT = [
    { title: 'Phục hồi nhẹ',      groups: ['CORE', 'LEGS'], light: true },
    { title: 'Chân & Mông',       groups: ['LEGS', 'CORE'] },
    { title: 'Ngực & Bụng',       groups: ['CHEST', 'CORE'] },
    { title: 'Cardio & Bụng',     groups: ['CARDIO', 'CORE'] },
    { title: 'Chân & Cardio',     groups: ['LEGS', 'CARDIO'] },
    { title: 'Toàn thân',         groups: ['LEGS', 'CHEST', 'CORE'] },
    { title: 'Đốt mỡ toàn thân',  groups: ['CARDIO', 'LEGS', 'CORE', 'CHEST'] }
];
const HIIT_OPTIONS = [7, 15, 20, 30];

// ---------- helpers ----------
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function seededRandom(seed) {
    let t = seed;
    return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
const isHold = (ex) => EXERCISES[ex].mode === 'hold';
const fmtMin = (sec) => `${Math.round(sec / 60)} phút`;

// ---------- body stats ----------
function bodyStats(p) {
    const h = p.height_cm / 100;
    const bmi = p.weight_kg / (h * h);
    // WHO Asia-Pacific cut-offs (phù hợp người Việt)
    const cat = bmi < 18.5 ? { name: 'Thiếu cân', cls: 'warn' }
        : bmi < 23 ? { name: 'Bình thường', cls: 'good' }
        : bmi < 25 ? { name: 'Thừa cân', cls: 'warn' }
        : bmi < 30 ? { name: 'Béo phì độ I', cls: 'bad' } : { name: 'Béo phì độ II', cls: 'bad' };
    const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
    const tdee = bmr * 1.375;
    const target = p.goal === 'lose' ? Math.max(bmr, tdee - 400) : p.goal === 'muscle' ? tdee + 250 : tdee;
    return {
        bmi: Math.round(bmi * 10) / 10, cat,
        bmr: Math.round(bmr), tdee: Math.round(tdee), targetKcal: Math.round(target),
        idealMin: Math.round(18.5 * h * h), idealMax: Math.round(22.9 * h * h),
        waterL: Math.round(p.weight_kg * 0.035 * 10) / 10
    };
}

// ---------- plan generation ----------
// Exercises for the given groups, interleaved group by group (primary group first),
// filtered by equipment, impact (heavier users) and level
function availableExercises(p, groups, rnd) {
    const st = bodyStats(p);
    const lowImpactOnly = st.bmi >= 27 || (p.level === 'beginner' && st.bmi >= 25);
    const ok = (k) => (p.equipment === 'dumbbell' || EXERCISES[k].equipment !== 'dumbbell')
        && (!lowImpactOnly || EXERCISE_PLAN[k].impact !== 'high')
        && !(p.level === 'beginner' && k === 'PUSHUP')        // easier push-up for beginners
        && !(p.level === 'advanced' && k === 'KNEE_PUSHUP');  // full push-up for advanced
    const perGroup = groups.map(g => {
        let items = (MUSCLE_GROUPS.find(x => x.key === g) || { items: [] }).items.filter(ok);
        // low-impact "cardio": continuous leg moves instead of jumping
        if (g === 'CARDIO' && !items.length) items = ['SQUAT', 'LUNGE', 'GLUTE_BRIDGE'].filter(ok);
        return shuffle(items, rnd);
    });
    // primary group gets two picks per round so the day matches its title
    const out = [];
    const cursor = perGroup.map(() => 0);
    const take = (gi) => {
        const l = perGroup[gi];
        while (cursor[gi] < l.length && out.includes(l[cursor[gi]])) cursor[gi]++;
        if (cursor[gi] < l.length) out.push(l[cursor[gi]++]);
    };
    while (perGroup.some((l, gi) => cursor[gi] < l.length)) {
        take(0); take(0);
        for (let gi = 1; gi < perGroup.length; gi++) take(gi);
    }
    return out;
}

const splitFor = (p) => (p.equipment === 'dumbbell' ? WEEK_SPLIT : WEEK_SPLIT_BODYWEIGHT);

function targetFor(p, ex, goalBoost = 1) {
    const lvl = LEVELS[p.level] || LEVELS.intermediate;
    const goalMult = { lose: 1.15, muscle: 0.9, fit: 1, endurance: 1.3 }[p.goal] || 1;
    const base = EXERCISE_PLAN[ex].base;
    const v = Math.round(base * lvl.mult * goalMult * goalBoost);
    return isHold(ex) ? Math.max(15, Math.round(v / 5) * 5) : Math.max(5, v);
}

// rough seconds per rep, used to turn "45 s of jumping jacks" into a rep goal
const CADENCE = { JUMPING_JACK: 1.2, HIGH_KNEES: 0.8, MOUNTAIN_CLIMBER: 0.8, SQUAT: 2.2, LUNGE: 2.6, PUSHUP: 2.5,
    KNEE_PUSHUP: 2.3, SITUP: 2.5, GLUTE_BRIDGE: 2.5, LEG_RAISE: 3 };
const secPerRep = (ex) => CADENCE[ex] || 3;
const workSeconds = (ex, target) => (isHold(ex) ? target : target * secPerRep(ex));
const repsIn = (ex, sec) => (isHold(ex) ? sec : Math.max(5, Math.round(sec / secPerRep(ex))));

function estimateKcal(steps, weight) {
    let kcal = 0;
    steps.forEach(s => {
        const sec = s.kind === 'rest' ? s.seconds : s.mode === 'time' ? s.seconds : workSeconds(s.ex, s.target);
        const met = s.kind === 'rest' ? 1.5 : EXERCISE_PLAN[s.ex].met;
        kcal += met * weight * sec / 3600;
    });
    return Math.round(kcal);
}

const planSeconds = (steps) => steps.reduce((t, s) => t + (s.kind === 'rest' ? s.seconds : s.mode === 'time' ? s.seconds : workSeconds(s.ex, s.target)) + (s.kind === 'work' ? 5 : 0), 0);

function buildDailyPlan(p, date = new Date()) {
    const day = splitFor(p)[date.getDay()];
    const rnd = seededRandom(hashString(todayKey(date) + (sbUserId || '')));
    const lvl = LEVELS[p.level] || LEVELS.intermediate;
    const budget = (day.light ? Math.min(p.minutes, 15) : p.minutes) * 60;
    const rest = p.goal === 'lose' ? Math.max(15, lvl.rest - 10) : p.goal === 'muscle' ? lvl.rest + 15 : lvl.rest;
    const sets = day.light ? 1 : (p.goal === 'muscle' && p.level !== 'beginner' ? lvl.sets + 1 : lvl.sets);
    const pool = availableExercises(p, day.groups, rnd);
    const steps = [];

    // Warm-up
    const warm = pool.includes('JUMPING_JACK') ? 'JUMPING_JACK' : (EXERCISE_PLAN.JUMPING_JACK && bodyStats(p).bmi < 27 && p.level !== 'beginner') ? 'JUMPING_JACK' : 'SQUAT';
    steps.push({ kind: 'work', ex: warm, mode: 'reps', target: repsIn(warm, 45), label: 'Khởi động' });
    steps.push({ kind: 'rest', seconds: 15 });

    // Main blocks: cycle through exercises while the next block still fits the time budget
    const finisher = p.goal === 'lose' && !day.light;
    const mainBudget = budget - (finisher ? 40 : 0);
    let i = 0;
    while (pool.length && i < 40) {
        const ex = pool[i % pool.length];
        const round = Math.floor(i / pool.length);
        const target = targetFor(p, ex, day.light ? 0.7 : 1 - round * 0.1);
        const block = [];
        for (let s = 1; s <= sets; s++) {
            block.push({ kind: 'work', ex, mode: 'reps', target, set: s, sets });
            block.push({ kind: 'rest', seconds: s === sets ? rest + 15 : rest });
        }
        const isFirst = !steps.some(s => s.mode === 'reps');
        if (!isFirst && planSeconds(steps) + planSeconds(block) > mainBudget * 1.08) break;
        steps.push(...block);
        i++;
    }

    // Fat-loss finisher
    if (finisher) {
        const fin = availableExercises(p, ['CARDIO', 'LEGS'], rnd).find(k => !isHold(k)) || 'SQUAT';
        steps.push({ kind: 'work', ex: fin, mode: 'reps', target: repsIn(fin, 40), label: 'Về đích đốt mỡ' });
    }
    if (steps[steps.length - 1].kind === 'rest') steps.pop();

    const exCount = new Set(steps.filter(s => s.kind === 'work').map(s => s.ex)).size;
    return {
        id: 'daily-' + todayKey(date), kind: 'daily', title: day.title, dayName: DAY_NAMES[date.getDay()],
        steps, seconds: planSeconds(steps), kcal: estimateKcal(steps, p.weight_kg), exCount
    };
}

function buildHiitPlan(p, minutes) {
    const rnd = seededRandom(hashString('hiit' + minutes + todayKey()));
    const beginner = p.level === 'beginner';
    const work = minutes === 7 ? 30 : beginner ? 30 : 40;
    const rest = minutes === 7 ? 10 : beginner ? 30 : 20;
    const bodyweight = { ...p, equipment: 'none' };
    // HIIT works best with continuous moves - holds only if nothing else is available
    let pool = availableExercises(bodyweight, ['CARDIO', 'LEGS', 'CORE', 'CHEST'], rnd);
    const dynamic = pool.filter(k => !isHold(k));
    if (dynamic.length >= 4) pool = dynamic.concat(pool.filter(isHold).slice(0, 1));
    // alternate high-effort and lighter moves
    const steps = [];
    const total = minutes * 60;
    let i = 0;
    while (planSeconds(steps) + work <= total && i < 200) {
        const ex = pool[i % pool.length];
        steps.push({ kind: 'work', ex, mode: 'reps', target: repsIn(ex, work), round: Math.floor(i / pool.length) + 1 });
        steps.push({ kind: 'rest', seconds: rest });
        i++;
    }
    if (steps.length && steps[steps.length - 1].kind === 'rest') steps.pop();
    const hiitSteps = steps.map(s => (s.kind === 'work' ? { ...s, hiit: true } : s));
    // HIIT burns more than steady reps: bump MET by ~25%
    const kcal = Math.round(estimateKcal(hiitSteps, p.weight_kg) * 1.25);
    return {
        id: `hiit-${minutes}-${todayKey()}`, kind: 'hiit', title: `Đốt mỡ ${minutes} phút`, dayName: 'HIIT',
        steps: hiitSteps, seconds: planSeconds(hiitSteps), kcal,
        exCount: new Set(hiitSteps.filter(s => s.kind === 'work').map(s => s.ex)).size, work, rest
    };
}

// ---------- profile storage ----------
const profileKey = () => `aiPoseFitness.profile.${sbUserId}`;

function loadLocalProfile() {
    try { return JSON.parse(localStorage.getItem(profileKey()) || 'null'); } catch (e) { return null; }
}
function storeLocalProfile(p) {
    try { localStorage.setItem(profileKey(), JSON.stringify(p)); } catch (e) {}
}

async function saveProfile(p) {
    p.updatedAt = Date.now();
    profile = p;
    storeLocalProfile(p);
    if (window.ProgressCard) ProgressCard.reset(); // calories depend on weight
    if (typeof actSettings !== 'undefined') { actSettings.weight = Math.round(p.weight_kg); saveActSettings(); }
    renderProgramPanel();
    if (!sbUserId) return;
    setProfileDirty(true);
    if (!sb) return;
    try {
        const { error } = await sb.from(PROFILE_TABLE).upsert({ user_id: sbUserId, profile: p, updated_at: new Date().toISOString() });
        if (error) throw error;
        setProfileDirty(false);
    } catch (e) { console.warn('Profile upload failed, will retry when online', e); }
}

async function loadProfile() {
    profile = loadLocalProfile();
    renderProgramPanel();
    if (!sb || !sbUserId) return;
    const uid = sbUserId;
    try {
        const { data, error } = await sb.from(PROFILE_TABLE).select('profile').eq('user_id', uid).maybeSingle();
        if (error) throw error;
        if (uid !== sbUserId) return;
        const remote = data && data.profile;
        if (profile && isProfileDirty()) {
            saveProfile(profile); // edited offline: local copy wins
        } else if (remote && (!profile || (remote.updatedAt || 0) >= (profile.updatedAt || 0))) {
            profile = remote;
            storeLocalProfile(profile);
        } else if (profile && !remote) {
            saveProfile(profile); // push local-only profile
        }
    } catch (e) { console.warn('Profile load failed', e); }
    if (uid !== sbUserId) return;
    renderProgramPanel();
    if (!profile) openProfileModal(true);
}

window.onProgramsUserChanged = function () {
    if (Runner.active) Runner.stop(true);
    profile = null;
    if (sbUserId) loadProfile();
    else renderProgramPanel();
};

// ---------- completion & streak ----------
function markCompleted(planKind) {
    if (!profile) return;
    const key = todayKey();
    profile.completed = (profile.completed || []).filter(c => c.date !== key || c.kind !== planKind);
    profile.completed.push({ date: key, kind: planKind });
    profile.completed = profile.completed.slice(-180);
    saveProfile(profile);
}

function streakDays() {
    if (!profile || !profile.completed) return 0;
    const days = new Set(profile.completed.map(c => c.date));
    let d = new Date();
    if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1); // streak still alive until tonight
    let n = 0;
    while (days.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
}
const doneToday = (kind) => !!(profile && (profile.completed || []).some(c => c.date === todayKey() && (!kind || c.kind === kind)));

// ---------- onboarding / profile modal ----------
let onboardingRequired = false;

window.openProfileModal = function (required) {
    onboardingRequired = !!required;
    const p = profile || { sex: 'male', age: 25, height_cm: 165, weight_kg: 60, goal: 'lose', level: 'beginner', minutes: 20, equipment: 'none' };
    const f = $('profile-form');
    f.age.value = p.age; f.height.value = p.height_cm; f.weight.value = p.weight_kg;
    setChoice('sex', p.sex); setChoice('goal', p.goal); setChoice('level', p.level);
    setChoice('minutes', String(p.minutes)); setChoice('equipment', p.equipment);
    $('profile-title').textContent = required ? 'Chào mừng! Tạo hồ sơ tập luyện' : 'Hồ sơ tập luyện';
    $('profile-cancel').hidden = required;
    $('profile-msg').textContent = '';
    updateProfilePreview();
    $('profile-modal').hidden = false;
    document.body.classList.add('modal-open');
};

window.closeProfileModal = function () {
    if (onboardingRequired && !profile) return;
    $('profile-modal').hidden = true;
    document.body.classList.remove('modal-open');
};

function setChoice(name, value) {
    document.querySelectorAll(`#profile-form [data-choice="${name}"] button`).forEach(b => {
        const on = b.dataset.value === value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
    });
}
const getChoice = (name) => (document.querySelector(`#profile-form [data-choice="${name}"] button.active`) || {}).dataset?.value;

function readProfileForm() {
    const f = $('profile-form');
    return {
        sex: getChoice('sex'), age: Number(f.age.value), height_cm: Number(f.height.value), weight_kg: Number(f.weight.value),
        goal: getChoice('goal'), level: getChoice('level'), minutes: Number(getChoice('minutes')), equipment: getChoice('equipment')
    };
}

function validProfile(p) {
    if (!(p.age >= 12 && p.age <= 90)) return 'Tuổi cần từ 12 đến 90.';
    if (!(p.height_cm >= 120 && p.height_cm <= 230)) return 'Chiều cao cần từ 120 đến 230 cm.';
    if (!(p.weight_kg >= 30 && p.weight_kg <= 250)) return 'Cân nặng cần từ 30 đến 250 kg.';
    return '';
}

function updateProfilePreview() {
    const p = readProfileForm();
    const el = $('profile-preview');
    if (validProfile(p)) { el.innerHTML = ''; return; }
    const st = bodyStats(p);
    el.innerHTML = `<div><span>BMI</span><strong>${st.bmi}</strong><em class="${st.cat.cls}">${st.cat.name}</em></div>
        <div><span>Cân nặng lý tưởng</span><strong>${st.idealMin}-${st.idealMax} kg</strong></div>
        <div><span>Calo/ngày nên ăn</span><strong>${st.targetKcal.toLocaleString('vi-VN')}</strong><em>kcal</em></div>`;
}

async function submitProfile(e) {
    e.preventDefault();
    const p = readProfileForm();
    const err = validProfile(p);
    if (err) { $('profile-msg').textContent = err; return; }
    p.completed = (profile && profile.completed) || [];
    p.createdAt = (profile && profile.createdAt) || Date.now();
    await saveProfile(p);
    onboardingRequired = false;
    closeProfileModal();
    showToast('Đã lưu hồ sơ. Giáo án hôm nay đã sẵn sàng!', 'info');
}

// ---------- program panel UI ----------
let hiitMinutes = 15;

function stepLabel(s) {
    const ex = EXERCISES[s.ex];
    if (s.mode === 'time') return `${s.label ? s.label + ': ' : ''}${ex.name} · ${s.seconds} giây`;
    const unit = unitOf(s.ex);
    return `${s.label ? s.label + ': ' : ''}${ex.name} · ${s.target} ${unit}${s.sets ? ` × ${s.sets} hiệp` : ''}`;
}

function planListHtml(plan) {
    const seen = new Set();
    return plan.steps.filter(s => s.kind === 'work').filter(s => {
        const special = s.mode === 'time' || s.label || s.round;
        const k = s.ex + (special ? 't' + (s.label || s.round || '') : '');
        if (!special && seen.has(k)) return false;
        seen.add(k);
        return true;
    }).map(s => `<li><i class="fa-solid ${EXERCISES[s.ex].icon}"></i> ${stepLabel(s)} <small>${groupOf(s.ex)}</small></li>`).join('');
}

function renderProgramPanel() {
    const panel = $('program-panel');
    if (!panel) return;
    if (!sbUserId) { panel.hidden = true; return; }
    panel.hidden = false;

    if (!profile) {
        $('profile-strip').innerHTML = `<span>Tạo hồ sơ để nhận giáo án hằng ngày theo chiều cao, cân nặng của bạn.</span>
            <button class="btn btn-primary" onclick="openProfileModal(true)">Tạo hồ sơ</button>`;
        $('today-card').hidden = true;
        $('hiit-card').hidden = true;
        return;
    }
    if (typeof renderGoal === 'function') renderGoal(); // default goals follow level / goal
    const st = bodyStats(profile);
    $('profile-strip').innerHTML = `
        <div class="ps-stats">
            <span><b>${profile.weight_kg}</b> kg</span>
            <span>BMI <b>${st.bmi}</b> <em class="${st.cat.cls}">${st.cat.name}</em></span>
            <span class="ps-streak" title="Chuỗi ngày tập liên tiếp"><i class="fa-solid fa-fire-flame-curved"></i> ${streakDays()} ngày</span>
        </div>
        <button class="ps-edit" onclick="openProfileModal(false)" aria-label="Sửa hồ sơ" title="Sửa hồ sơ"><i class="fa-solid fa-user-pen"></i></button>`;

    const plan = buildDailyPlan(profile);
    const done = doneToday('daily');
    $('today-card').hidden = false;
    $('today-card').innerHTML = `
        <div class="tc-head">
            <div>
                <span class="tc-day">${plan.dayName} · Giáo án hôm nay</span>
                <h3>${plan.title}</h3>
                <div class="tc-meta"><span><i class="fa-regular fa-clock"></i> ~${fmtMin(plan.seconds)}</span>
                    <span><i class="fa-solid fa-fire"></i> ~${plan.kcal} kcal</span></div>
            </div>
            ${done ? '<span class="tc-done"><i class="fa-solid fa-circle-check"></i> Đã xong</span>' : ''}
        </div>
        <details class="tc-list"><summary>Xem các bài</summary><ul>${planListHtml(plan)}</ul></details>
        <button class="btn btn-primary tc-start" onclick="startDailyPlan()"><i class="fa-solid fa-play"></i> <span>${done ? 'TẬP LẠI' : 'BẮT ĐẦU BUỔI TẬP'}</span></button>`;

    $('hiit-card').hidden = false;
    const hiit = buildHiitPlan(profile, hiitMinutes);
    $('hiit-card').innerHTML = `
        <div class="hc-head"><h3><i class="fa-solid fa-fire-flame-curved"></i> Đốt mỡ nhanh (HIIT)</h3>
            ${doneToday('hiit') ? '<span class="tc-done"><i class="fa-solid fa-circle-check"></i> Hôm nay</span>' : ''}</div>
        <div class="hc-options">${HIIT_OPTIONS.map(m => `<button class="${m === hiitMinutes ? 'active' : ''}" onclick="selectHiit(${m})">${m} phút</button>`).join('')}</div>
        <p class="hc-desc">~${hiit.work}s mỗi bài / ${hiit.rest}s nghỉ · ~<b>${hiit.kcal} kcal</b></p>
        <details class="tc-list"><summary>Xem các bài</summary><ul>${planListHtml(hiit)}</ul></details>
        <button class="btn btn-secondary tc-start" onclick="startHiitPlan()"><i class="fa-solid fa-bolt"></i> <span>BẮT ĐẦU ${hiitMinutes} PHÚT</span></button>`;
}

window.selectHiit = function (m) { hiitMinutes = m; renderProgramPanel(); };
window.startDailyPlan = function () { if (profile) Runner.start(buildDailyPlan(profile)); };
window.startHiitPlan = function () { if (profile) Runner.start(buildHiitPlan(profile, hiitMinutes)); };

// ==============================================================
// GUIDED WORKOUT RUNNER
// ==============================================================
const Runner = {
    active: false, plan: null, idx: -1, phase: 'idle', endsAt: 0, pausedLeft: 0, paused: false,
    setStartReps: 0, timer: null, startedAt: 0, lastSpoken: null,

    isResting() { return this.active && (this.paused || this.phase !== 'work'); },

    async start(plan) {
        if (!sbUserId) { showAuth('login'); return; }
        if (this.active) this.stop(true);
        this.plan = plan;
        this.active = true;
        this.idx = -1;
        this.paused = false;
        this.startedAt = Date.now();
        document.body.classList.add('runner-on');
        $('runner-panel').hidden = false;
        $('runner-summary').hidden = true;
        $('runner-live').hidden = false;
        $('runner-title').textContent = `${plan.title} · ~${fmtMin(plan.seconds)}`;
        setMode('camera');
        if (!isCameraActive) await startCamera();
        if (!isCameraActive) { this.stop(true); return; }
        armTraining(false);
        clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), 250);
        this.next();
    },

    stop(silent) {
        clearInterval(this.timer);
        this.timer = null;
        if (this.active && !silent) saveSession();
        this.active = false;
        this.phase = 'idle';
        document.body.classList.remove('runner-on');
        $('runner-overlay').hidden = true;
        if (window.DemoUI) { DemoUI.overlayKey = null; DemoUI.refresh(); }
        if (silent) $('runner-panel').hidden = true;
    },

    quit() {
        this.stop(false);
        $('runner-panel').hidden = true;
        if (isCameraActive) stopCamera();
        showToast('Đã dừng buổi tập. Các bài đã tập vẫn được lưu.', 'info');
    },

    togglePause() {
        if (!this.active) return;
        this.paused = !this.paused;
        if (this.paused) this.pausedLeft = Math.max(0, this.endsAt - Date.now());
        else this.endsAt = Date.now() + this.pausedLeft;
        $('runner-pause').innerHTML = this.paused ? '<i class="fa-solid fa-play"></i> <span>Tiếp tục</span>' : '<i class="fa-solid fa-pause"></i> <span>Tạm dừng</span>';
        this.render();
    },

    skip() { if (this.active) this.next(); },

    step() { return this.plan.steps[this.idx]; },

    nextWork(from) {
        for (let i = from; i < this.plan.steps.length; i++) if (this.plan.steps[i].kind === 'work') return this.plan.steps[i];
        return null;
    },

    next() {
        this.idx++;
        if (this.idx >= this.plan.steps.length) { this.finish(); return; }
        const s = this.step();
        this.paused = false;
        $('runner-pause').innerHTML = '<i class="fa-solid fa-pause"></i> <span>Tạm dừng</span>';
        if (s.kind === 'rest') {
            this.phase = 'rest';
            this.endsAt = Date.now() + s.seconds * 1000;
            const nw = this.nextWork(this.idx + 1);
            if (nw && nw.ex !== currentExercise) selectExercise(nw.ex); // show next move & its tips while resting
            speakText(`Nghỉ ${s.seconds} giây.${nw ? ' Tiếp theo: ' + EXERCISES[nw.ex].name : ''}`);
        } else {
            if (s.ex !== currentExercise) selectExercise(s.ex);
            this.phase = 'prep';
            this.endsAt = Date.now() + 4000;
            speakText(`${s.label ? s.label + '. ' : ''}${EXERCISES[s.ex].name}. Chuẩn bị`);
        }
        this.lastSpoken = null;
        this.render();
    },

    beginWork() {
        const s = this.step();
        this.phase = 'work';
        this.setStartReps = repCount;
        lastHoldTs = null;
        if (s.mode === 'time') this.endsAt = Date.now() + s.seconds * 1000;
        playBeep(1000, 0.2);
        speakText('Bắt đầu');
        this.render();
    },

    progress() { return Math.max(0, repCount - this.setStartReps); },

    // called by updateStatsDisplay() on every counted rep / held second
    onProgress() {
        if (!this.active || this.phase !== 'work') return;
        const s = this.step();
        if (s.mode === 'reps' && this.progress() >= s.target) {
            // finish this set after the rep count has been announced
            this.phase = 'advancing';
            this.render();
            setTimeout(() => {
                if (!this.active) return;
                playBeep(1200, 0.25);
                speakText('Hoàn thành');
                this.next();
            }, 900);
            return;
        }
        this.render();
    },

    tick() {
        if (!this.active) return;
        if (!isCameraActive && !this.paused) { this.togglePause(); showToast('Camera đã tắt - buổi tập tạm dừng.', 'warn'); }
        if (this.paused) return;
        const left = Math.ceil((this.endsAt - Date.now()) / 1000);
        if (this.phase === 'prep') {
            if (left <= 0) { this.beginWork(); return; }
            if (left <= 3 && this.lastSpoken !== left) { this.lastSpoken = left; speakText(String(left)); playBeep(700, 0.08); }
        } else if (this.phase === 'rest') {
            if (left <= 0) { this.next(); return; }
            if (left === 5 && this.lastSpoken !== 5) { this.lastSpoken = 5; speakText('Còn 5 giây'); }
        } else if (this.phase === 'work' && this.step().mode === 'time') {
            if (left <= 0) { playBeep(1200, 0.25); this.next(); return; }
            if (left === 10 && this.lastSpoken !== 10) { this.lastSpoken = 10; speakText('Còn 10 giây'); }
        }
        this.render();
    },

    render() {
        if (!this.active || !this.plan) return;
        const steps = this.plan.steps;
        const s = this.step();
        if (!s) return;
        const works = steps.filter(x => x.kind === 'work');
        const workIdx = steps.slice(0, this.idx + 1).filter(x => x.kind === 'work').length;
        $('runner-step').textContent = `Bài ${Math.max(1, workIdx)}/${works.length}`;
        const doneSec = planSeconds(steps.slice(0, this.idx));
        $('runner-bar').style.width = `${Math.min(100, Math.round(doneSec / this.plan.seconds * 100))}%`;
        $('runner-elapsed').textContent = formatTime(Math.floor((Date.now() - this.startedAt) / 1000));

        const left = Math.max(0, Math.ceil(((this.paused ? Date.now() + this.pausedLeft : this.endsAt) - Date.now()) / 1000));
        const ov = $('runner-overlay');
        const nw = s.kind === 'rest' ? this.nextWork(this.idx + 1) : s;

        if (s.kind === 'rest' || this.phase === 'prep' || this.paused) {
            ov.hidden = false;
            ov.className = `runner-overlay ${this.paused ? 'paused' : s.kind === 'rest' ? 'rest' : 'prep'}`;
            $('runner-ov-label').textContent = this.paused ? 'TẠM DỪNG' : s.kind === 'rest' ? 'NGHỈ' : 'CHUẨN BỊ';
            $('runner-ov-num').textContent = this.paused ? '❚❚' : left;
            $('runner-ov-next').textContent = nw ? `${s.kind === 'rest' ? 'Tiếp theo: ' : ''}${stepLabel(nw)}` : 'Sắp xong!';
            if (window.DemoUI) DemoUI.setOverlay(nw ? nw.ex : null); // show how the next move is done
        } else {
            ov.hidden = true;
            if (window.DemoUI) DemoUI.setOverlay(null);
        }

        const cur = nw || s;
        $('runner-ex').innerHTML = `<i class="fa-solid ${EXERCISES[cur.ex].icon}"></i> ${cur.label ? cur.label + ' · ' : ''}${EXERCISES[cur.ex].name}`;
        const unit = unitOf(cur.ex);
        if (s.kind === 'work' && this.phase === 'work') {
            if (s.mode === 'time') {
                $('runner-count').textContent = `${left}s`;
                $('runner-sub').textContent = `Làm liên tục · đã được ${this.progress()} ${unit}`;
            } else {
                const left = Math.max(0, s.target - this.progress());
                $('runner-count').textContent = left > 0 ? left : '✓';
                $('runner-sub').textContent = `${s.sets ? `Hiệp ${s.set}/${s.sets} · ` : ''}còn ${left}/${s.target} ${unit}`;
            }
        } else {
            $('runner-count').textContent = s.kind === 'rest' ? `${left}s` : '...';
            $('runner-sub').textContent = s.kind === 'rest' ? 'Nghỉ, hít thở sâu' : 'Vào tư thế trước camera';
        }
        const after = this.nextWork(this.idx + 1);
        $('runner-next').textContent = after && s.kind === 'work' ? `Tiếp theo: ${stepLabel(after)}` : '';
    },

    finish() {
        const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
        const plan = this.plan;
        this.stop(false);
        if (isCameraActive) stopCamera(); // leave the full-screen view
        markCompleted(plan.kind);
        $('runner-panel').hidden = false;
        setTimeout(() => $('runner-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        $('runner-live').hidden = true;
        $('runner-summary').hidden = false;
        $('runner-summary-text').innerHTML = `<b>${plan.title}</b> · ${formatTime(elapsed)} · ~${plan.kcal} kcal · ${plan.exCount} bài<br>
            Chuỗi tập: <b>${streakDays()} ngày</b> liên tiếp 🔥`;
        playBeep(880, 0.2); setTimeout(() => playBeep(1320, 0.3), 220);
        speakText('Chúc mừng! Bạn đã hoàn thành buổi tập hôm nay');
        renderProgramPanel();
    }
};
window.Runner = Runner;

window.closeRunnerSummary = function () { $('runner-panel').hidden = true; };

// ---------- free-training group tabs ----------
let selectedGroup = 'ALL';
window.selectGroup = function (key) {
    selectedGroup = key;
    document.querySelectorAll('#group-tabs button').forEach(b => b.classList.toggle('active', b.dataset.group === key));
    const items = key === 'ALL' ? EXERCISE_ORDER : (MUSCLE_GROUPS.find(g => g.key === key) || { items: [] }).items;
    document.querySelectorAll('#exercise-picker .exercise-btn').forEach(b => { b.hidden = !items.includes(b.dataset.ex); });
};

function renderGroupTabs() {
    $('group-tabs').innerHTML = `<button data-group="ALL" class="active" onclick="selectGroup('ALL')">Tất cả</button>` +
        MUSCLE_GROUPS.map(g => `<button data-group="${g.key}" onclick="selectGroup('${g.key}')"><i class="fa-solid ${g.icon}"></i> ${g.name}</button>`).join('');
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', () => {
    renderGroupTabs();
    $('profile-form').addEventListener('submit', submitProfile);
    $('profile-form').addEventListener('input', updateProfilePreview);
    document.querySelectorAll('#profile-form [data-choice] button').forEach(b => {
        b.type = 'button';
        b.addEventListener('click', () => { setChoice(b.parentElement.dataset.choice, b.dataset.value); updateProfilePreview(); });
    });
    renderProgramPanel();
});
