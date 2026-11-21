// ==============================================================
// MUSCLES + LIVE FORM GUIDES
// - which muscles each exercise works (used by the 3D demo and the camera view)
// - camera overlay: clear skeleton, glow on the working muscles, the tracked joint
//   drawn with its angle arc and a dashed "target" line
// - RepGauge: vertical ruler beside the camera (rest zone -> green target zone)
// ==============================================================

const MUSCLE_INFO = {
    quads:      'Đùi trước',
    hamstrings: 'Đùi sau',
    glutes:     'Mông',
    calves:     'Bắp chân',
    chest:      'Ngực',
    shoulders:  'Vai',
    back:       'Lưng',
    biceps:     'Tay trước',
    triceps:    'Tay sau',
    forearms:   'Cẳng tay',
    abs:        'Bụng',
    obliques:   'Eo (bụng chéo)'
};

// p = main muscles (bright), s = helpers (soft)
const EX_MUSCLES = {
    SQUAT:            { p: ['quads', 'glutes'], s: ['hamstrings', 'calves', 'abs'] },
    LUNGE:            { p: ['quads', 'glutes'], s: ['hamstrings', 'calves'] },
    PUSHUP:           { p: ['chest', 'triceps'], s: ['shoulders', 'abs'] },
    KNEE_PUSHUP:      { p: ['chest', 'triceps'], s: ['shoulders', 'abs'] },
    PLANK:            { p: ['abs'], s: ['obliques', 'shoulders', 'glutes'] },
    MOUNTAIN_CLIMBER: { p: ['abs', 'quads'], s: ['shoulders', 'obliques'] },
    HIGH_KNEES:       { p: ['quads', 'calves'], s: ['abs', 'glutes'] },
    JUMPING_JACK:     { p: ['calves', 'shoulders'], s: ['quads', 'glutes'] },
    CURL:             { p: ['biceps'], s: ['forearms'] },
    SHOULDER_PRESS:   { p: ['shoulders', 'triceps'], s: ['back', 'abs'] },
    LATERAL_RAISE:    { p: ['shoulders'], s: ['back'] },
    FRONT_RAISE:      { p: ['shoulders'], s: ['chest'] },
    TRICEP_EXT:       { p: ['triceps'], s: ['shoulders'] },
    SITUP:            { p: ['abs'], s: ['obliques', 'quads'] },
    LEG_RAISE:        { p: ['abs'], s: ['quads', 'obliques'] },
    GLUTE_BRIDGE:     { p: ['glutes', 'hamstrings'], s: ['abs'] },
    WALL_SIT:         { p: ['quads'], s: ['glutes', 'calves'] },
    SQUAT_CURL:       { p: ['quads', 'glutes', 'biceps'], s: ['hamstrings', 'forearms'] },
    SUMO_TWIST:       { p: ['glutes', 'quads', 'obliques'], s: ['hamstrings', 'shoulders'] },
    BENT_ALT_RAISE:   { p: ['shoulders', 'triceps'], s: ['back', 'hamstrings'] },
    REVERSE_FLY:      { p: ['back', 'shoulders'], s: ['hamstrings'] },
    OBLIQUE_KNEE:     { p: ['obliques', 'abs'], s: ['quads'] },
    STANDING_CRUNCH:  { p: ['abs', 'obliques'], s: ['quads', 'shoulders'] }
};

function musclesOf(k) { return EX_MUSCLES[k] || { p: [], s: [] }; }
const muscleNames = list => list.map(m => MUSCLE_INFO[m]).join(' · ');

// small "🔥 Đùi trước · Mông" chips
function muscleChipsHTML(k, withSecondary) {
    const m = musclesOf(k);
    let html = m.p.map(x => `<span class="mchip mchip-p">${MUSCLE_INFO[x]}</span>`).join('');
    if (withSecondary) html += m.s.map(x => `<span class="mchip mchip-s">${MUSCLE_INFO[x]}</span>`).join('');
    return html;
}

// ---------------- camera overlay ----------------
// which side of the measured joint usually moves: A = first point, C = last
const MOVING_ARM = { knee: 'A', elbow: 'C', shoulder: 'C', hip: 'C', body: 'C' };
const FORM_COLORS = { good: '#3DDC84', move: '#FF5C34', bad: '#A7A1A4' };

// landmark geometry for each muscle: segments [from, to] or blobs (single point)
// points may be a landmark index or a function lm -> {x, y, visibility}
const lerpLm = (a, b, t) => lm => {
    const p = lm[a], q = lm[b];
    if (!p || !q) return null;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, visibility: Math.min(p.visibility ?? 1, q.visibility ?? 1) };
};
const midLm = (a, b) => lerpLm(a, b, 0.5);
const MUSCLE_SHAPES = {
    quads:      { seg: [[23, 25], [24, 26]] },
    hamstrings: { seg: [[23, 25], [24, 26]] },
    calves:     { seg: [[25, 27], [26, 28]] },
    biceps:     { seg: [[11, 13], [12, 14]] },
    triceps:    { seg: [[11, 13], [12, 14]] },
    forearms:   { seg: [[13, 15], [14, 16]] },
    glutes:     { blob: [23, 24] },
    shoulders:  { blob: [11, 12] },
    chest:      { seg: [[lerpLm(11, 23, 0.2), lerpLm(12, 24, 0.2)]] },
    back:       { seg: [[lerpLm(11, 23, 0.25), lerpLm(12, 24, 0.25)], [11, lerpLm(11, 23, 0.55)], [12, lerpLm(12, 24, 0.55)]] },
    abs:        { seg: [[lm => mixMid(lm, 0.3), lm => mixMid(lm, 0.95)]] },
    obliques:   { seg: [[lerpLm(11, 23, 0.45), 23], [lerpLm(12, 24, 0.45), 24]] }
};
// point on the shoulder-mid -> hip-mid line
function mixMid(lm, t) {
    const s = midLm(11, 12)(lm), h = midLm(23, 24)(lm);
    if (!s || !h) return null;
    return { x: s.x + (h.x - s.x) * t, y: s.y + (h.y - s.y) * t, visibility: Math.min(s.visibility, h.visibility) };
}
const pickLm = (lm, ref) => typeof ref === 'function' ? ref(lm) : lm[ref];

// soft orange glow over the muscles this exercise works; brighter as the rep goes deeper
function drawMuscleGlow(ctx, lm, width, height, key, effort) {
    const m = musclesOf(key);
    if (!m.p.length) return;
    const len = (a, b) => (lm[a] && lm[b]) ? Math.hypot((lm[a].x - lm[b].x) * width, (lm[a].y - lm[b].y) * height) : 0;
    const torso = Math.max(len(11, 23), len(12, 24));
    if (!torso) return;
    const thick = Math.max(14, Math.min(80, torso * 0.3));
    const a = 0.28 + 0.42 * Math.max(0, Math.min(1, effort || 0));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle = `rgba(255, 92, 52, ${a})`;
    ctx.shadowColor = 'rgba(255, 92, 52, 0.9)';
    ctx.shadowBlur = thick * 0.6;
    ctx.lineWidth = thick;
    const drawn = new Set();
    m.p.forEach(name => {
        const sh = MUSCLE_SHAPES[name];
        if (!sh) return;
        (sh.seg || []).forEach(([i, j], n) => {
            const id = name.replace(/hamstrings/, 'quads').replace(/triceps/, 'biceps') + n;
            if (drawn.has(id)) return; // quads + hamstrings share a segment
            drawn.add(id);
            const p = pickLm(lm, i), q = pickLm(lm, j);
            if (!isDrawable(p) || !isDrawable(q)) return;
            const A = toPx(p, width, height), B = toPx(q, width, height);
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
        });
        (sh.blob || []).forEach(i => {
            const p = lm[i];
            if (!isDrawable(p)) return;
            const P = toPx(p, width, height);
            ctx.beginPath();
            ctx.arc(P.x, P.y, thick * 0.75, 0, Math.PI * 2);
            ctx.fill();
        });
    });
    ctx.restore();
}

// the joint being measured: thick coloured limb, angle wedge, dashed target line
function drawTrackedJoint(ctx, side, cfg, state, width, height, synthetic) {
    const color = FORM_COLORS[state];
    const [pa, pb, pc] = side.pts;
    const A = toPx(pa, width, height), B = toPx(pb, width, height), C = toPx(pc, width, height);
    const lenBA = Math.hypot(A.x - B.x, A.y - B.y), lenBC = Math.hypot(C.x - B.x, C.y - B.y);
    const r = Math.max(24, Math.min(70, Math.min(lenBA, lenBC) * 0.38));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // limb: dark outline + colour
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 13;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.stroke();

    if (!synthetic) {
        // wedge for the current angle
        const a1 = Math.atan2(A.y - B.y, A.x - B.x), a2 = Math.atan2(C.y - B.y, C.x - B.x);
        let d = a2 - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(B.x, B.y);
        ctx.arc(B.x, B.y, r, a1, a1 + d, d < 0);
        ctx.closePath();
        ctx.fillStyle = color + '55';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();

        // dashed line = where the MOVING limb has to reach, measured from the still one
        // (same normalised coordinates as the counter, so crossing it = target reached)
        const goal = cfg.holdRange ? (cfg.dir === 'down' ? cfg.holdRange[1] : cfg.holdRange[0]) : cfg.target;
        const movesA = (cfg.moving || MOVING_ARM[cfg.joint]) === 'A';
        const [still, moving] = movesA ? [pc, pa] : [pa, pc];
        const vx = still.x - pb.x, vy = still.y - pb.y, wx = moving.x - pb.x, wy = moving.y - pb.y;
        const sgn = (vx * wy - vy * wx) >= 0 ? 1 : -1;
        const phi = sgn * goal * Math.PI / 180;
        const nv = Math.hypot(vx, vy) || 1, nw = Math.hypot(wx, wy) || 1;
        const tx = (vx * Math.cos(phi) - vy * Math.sin(phi)) / nv * nw;
        const ty = (vx * Math.sin(phi) + vy * Math.cos(phi)) / nv * nw;
        const T = toPx({ x: pb.x + tx, y: pb.y + ty }, width, height);
        const tl = Math.hypot(T.x - B.x, T.y - B.y) || 1;
        const reach = Math.max(r * 1.8, Math.min(tl, r * 3));
        const ex = B.x + (T.x - B.x) / tl * reach, ey = B.y + (T.y - B.y) / tl * reach;
        ctx.setLineDash([9, 7]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = FORM_COLORS.good;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fillStyle = FORM_COLORS.good;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFF';
        ctx.stroke();
    }

    // joint dot + angle bubble
    ctx.beginPath();
    ctx.arc(B.x, B.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFF';
    ctx.stroke();

    const text = `${side.angle}°`;
    ctx.font = '800 20px Outfit, sans-serif';
    const tw = ctx.measureText(text).width;
    const bw = tw + 18, bh = 30;
    const bx = Math.max(4, Math.min(B.x + 16, ctx.canvas.width - bw - 4));
    const by = Math.max(4, B.y - bh - 10);
    ctx.fillStyle = 'rgba(28, 16, 22, 0.85)';
    ctx.beginPath();
    roundRectPath(ctx, bx, by, bw, bh, 15);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = state === 'good' ? color : '#FFF';
    ctx.fillText(text, bx + 9, by + 22);
    ctx.restore();
}

// ---------------- vertical ruler ----------------
// 0 (bottom) = past the rest position, 1 (top) = a bit past "perfect".
function gaugeScale(cfg) {
    const s = cfg.dir === 'down' ? -1 : 1; // progress = angle moving this way
    const goal = cfg.holdRange ? (s < 0 ? cfg.holdRange[1] : cfg.holdRange[0]) : cfg.target;
    const far = cfg.holdRange ? (s < 0 ? cfg.holdRange[0] : cfg.holdRange[1]) : cfg.perfect;
    const start = cfg.top - s * 15;
    const end = cfg.holdRange ? far + s * 12 : far + s * 15;
    const u = a => Math.max(0, Math.min(1, (a - start) / (end - start)));
    return { u, rest: u(cfg.top), goal: u(goal), far: u(far), hold: !!cfg.holdRange };
}

const restWord = cfg => {
    const m = /\(([^)]+)\)/.exec(cfg.restLabel);
    return (m ? m[1] : cfg.restLabel).toUpperCase();
};

const RepGauge = (() => {
    let el = null, cfgKey = null, scale = null, last = null, flashT = 0;
    const q = id => document.getElementById(id);

    function setup(cfg) {
        el = q('rep-gauge');
        if (!el) return;
        scale = gaugeScale(cfg);
        cfgKey = currentExercise;
        const pct = v => `${(v * 100).toFixed(1)}%`;
        q('rg-rest').style.height = pct(scale.rest);
        const zoneTop = scale.hold ? scale.far : 1;
        q('rg-zone').style.bottom = pct(scale.goal);
        q('rg-zone').style.height = pct(zoneTop - scale.goal);
        q('rg-goal').style.bottom = pct(scale.goal);
        q('rg-perfect').style.bottom = pct(scale.far);
        q('rg-perfect').hidden = scale.hold;
        q('rg-goal-txt').textContent = cfg.holdRange ? `GIỮ ${cfg.holdRange[0]}–${cfg.holdRange[1]}°` : `ĐẠT ${cfg.target}°`;
    }

    function update(cfg, angle, state) {
        if (!el || cfgKey !== currentExercise) setup(cfg);
        if (!el) return;
        const u = scale.u(angle);
        last = { u, state, angle };
        el.hidden = false;
        el.dataset.state = state;
        q('rg-fill').style.height = `${(u * 100).toFixed(1)}%`;
        q('rg-thumb').style.bottom = `${(u * 100).toFixed(1)}%`;
        q('rg-angle').textContent = `${angle}°`;
        [['rg-goal', scale.goal], ['rg-perfect', scale.far], ['rg-rest', scale.rest / 2]].forEach(([id, v]) => {
            const n = q(id).classList.contains('rg-rest') ? q(id).firstElementChild : q(id);
            n.classList.toggle('near', Math.abs(v - u) < 0.1);
        });
        let hint;
        if (state === 'bad') hint = 'SAI TƯ THẾ';
        else if (cfg.mode === 'hold') hint = state === 'good' ? '✓ GIỮ NGUYÊN' : '▲ TỚI VÙNG XANH';
        else if (state === 'good' || repStage === 'ACTIVE') hint = `✓ ĐẠT · VỀ ${restWord(cfg)}`;
        else hint = '▲ TỚI VẠCH XANH';
        q('rg-hint').textContent = hint;
    }

    function counted() {
        if (!el) return;
        flashT = performance.now();
        el.classList.remove('rg-flash');
        void el.offsetWidth;
        el.classList.add('rg-flash');
    }

    function reset() {
        last = null;
        cfgKey = null;
        const g = q('rep-gauge');
        if (g) g.hidden = true;
    }

    // same ruler drawn into the recorded video
    function drawRec(ctx, W, H, s) {
        if (!last || !scale) return;
        const w = 16 * s, h = Math.min(H * 0.42, 340 * s);
        const x = W - 28 * s - w, y = (H - h) / 2;
        const col = FORM_COLORS[last.state];
        const Y = v => y + h * (1 - v);
        fillRoundRect(ctx, x - 8 * s, y - 10 * s, w + 16 * s, h + 20 * s, 14 * s, 'rgba(28, 16, 22, 0.6)');
        fillRoundRect(ctx, x, y, w, h, w / 2, 'rgba(255,255,255,0.18)');
        ctx.fillStyle = 'rgba(61, 220, 132, 0.35)';
        ctx.fillRect(x, Y(scale.hold ? scale.far : 1), w, Y(scale.goal) - Y(scale.hold ? scale.far : 1));
        fillRoundRect(ctx, x, Y(last.u), w, h * last.u, w / 2, col);
        ctx.fillStyle = FORM_COLORS.good;
        ctx.fillRect(x - 6 * s, Y(scale.goal) - 1.5 * s, w + 12 * s, 3 * s);
        ctx.font = `800 ${15 * s}px Outfit, sans-serif`;
        const t = `${last.angle}°`;
        const tw = ctx.measureText(t).width;
        fillRoundRect(ctx, x - tw - 22 * s, Y(last.u) - 13 * s, tw + 14 * s, 26 * s, 13 * s, col);
        ctx.fillStyle = last.state === 'good' ? '#1C1016' : '#FFF';
        ctx.fillText(t, x - tw - 15 * s, Y(last.u) + 5 * s);
        if (performance.now() - flashT < 400) {
            ctx.strokeStyle = FORM_COLORS.good;
            ctx.lineWidth = 3 * s;
            ctx.strokeRect(x - 8 * s, y - 10 * s, w + 16 * s, h + 20 * s);
        }
    }

    return { update, counted, reset, drawRec, effort: () => last ? last.u : 0 };
})();
window.RepGauge = RepGauge;
