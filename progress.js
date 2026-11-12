// ==============================================================
// INSTALL AS APP (PWA) + WEEKLY PROGRESS CARD
// ==============================================================

// ---------- Add to Home Screen ----------
(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone || NativeApp.isNative) return;
    const btn = $('install-btn');
    let deferred = null;

    // Android / desktop Chrome: real install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
        if (deferred) {
            deferred.prompt();
            await deferred.userChoice.catch(() => {});
            deferred = null;
            btn.hidden = true;
        } else {
            showIosHint(true);
        }
    });
    window.addEventListener('appinstalled', () => { btn.hidden = true; });

    // iPhone / iPad Safari: no prompt exists, explain the Share-sheet step once
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    function showIosHint(force) {
        let seen = false;
        try { seen = localStorage.getItem('aiPoseFitness.iosHint') === '1'; } catch (e) {}
        if (seen && !force) return;
        $('ios-hint').hidden = false;
        try { localStorage.setItem('aiPoseFitness.iosHint', '1'); } catch (e) {}
    }
    if (isIos && isSafari) {
        btn.hidden = false;
        setTimeout(() => showIosHint(false), 4000);
    }
    window.closeIosHint = () => { $('ios-hint').hidden = true; };
})();

// ---------- Weekly progress ----------
const ProgressCard = (() => {
    const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    let timer = null;
    let lastKey = '';

    const weight = () => (typeof profile !== 'undefined' && profile && profile.weight_kg) ||
        (typeof actSettings !== 'undefined' && actSettings.weight) || 65;
    const sessionKcal = (ex, sec) => {
        const met = (typeof EXERCISE_PLAN !== 'undefined' && EXERCISE_PLAN[ex] && EXERCISE_PLAN[ex].met) || 5;
        return met * weight() * (sec / 3600);
    };
    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    async function collect() {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        since.setDate(since.getDate() - 6);
        let sessions = loadHistory().map(h => ({ date: h.date, sec: h.duration || 0, reps: h.reps || 0, ex: h.exercise, id: h.id }));
        let acts = (typeof loadActCache === 'function' ? loadActCache() : [])
            .map(a => ({ date: new Date(a.startedAt).toISOString(), sec: a.movingS || 0, kcal: a.calories || 0, id: a.clientId }));

        // the local cache keeps only recent items: complete the week from the cloud when online
        if (sb && sbUserId && navigator.onLine) {
            try {
                const [ws, ac] = await Promise.all([
                    sb.from(SESSIONS_TABLE).select('client_id, exercise, reps, duration_seconds, performed_at').gte('performed_at', since.toISOString()).limit(500),
                    sb.from(ACT_TABLE).select('client_id, moving_seconds, calories, started_at').gte('started_at', since.toISOString()).limit(200)
                ]);
                if (!ws.error) {
                    const ids = new Set(ws.data.map(r => Number(r.client_id)));
                    sessions = ws.data.map(r => ({ date: r.performed_at, sec: r.duration_seconds || 0, reps: r.reps || 0, ex: r.exercise }))
                        .concat(sessions.filter(s => !ids.has(Number(s.id))));
                }
                if (!ac.error) {
                    const ids = new Set(ac.data.map(r => Number(r.client_id)));
                    acts = ac.data.map(r => ({ date: r.started_at, sec: r.moving_seconds || 0, kcal: r.calories || 0 }))
                        .concat(acts.filter(a => !ids.has(Number(a.id))));
                }
            } catch (e) { /* offline or blocked: local data only */ }
        }

        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            days.push({ d, key: dayKey(d), min: 0, kcal: 0, reps: 0 });
        }
        const byKey = Object.fromEntries(days.map(x => [x.key, x]));
        sessions.forEach(s => {
            const day = byKey[dayKey(new Date(s.date))];
            if (!day) return;
            day.min += s.sec / 60;
            day.reps += s.reps;
            day.kcal += sessionKcal(s.ex, s.sec);
        });
        acts.forEach(a => {
            const day = byKey[dayKey(new Date(a.date))];
            if (!day) return;
            day.min += a.sec / 60;
            day.kcal += a.kcal;
        });
        return days;
    }

    function render(days) {
        const el = $('progress-card');
        if (!el) return;
        if (!sbUserId) { el.hidden = true; return; }
        el.hidden = false;
        const totMin = days.reduce((t, d) => t + d.min, 0);
        const totKcal = days.reduce((t, d) => t + d.kcal, 0);
        const totReps = days.reduce((t, d) => t + d.reps, 0);
        const active = days.filter(d => d.min >= 1).length;
        const max = Math.max(10, ...days.map(d => d.min));
        $('progress-total').innerHTML = `
            <div><strong>${Math.round(totMin)}</strong><span>phút</span></div>
            <div><strong>${Math.round(totKcal)}</strong><span>kcal</span></div>
            <div><strong>${totReps}</strong><span>rep</span></div>
            <div><strong>${active}/7</strong><span>ngày tập</span></div>`;
        $('progress-bars').innerHTML = days.map((d, i) => {
            const h = d.min > 0 ? Math.max(6, Math.round(d.min / max * 100)) : 0;
            const today = i === 6;
            const tip = `${DAYS[d.d.getDay()]} ${d.d.getDate()}/${d.d.getMonth() + 1}: ${Math.round(d.min)} phút · ${Math.round(d.kcal)} kcal`;
            return `<div class="pb${today ? ' today' : ''}" title="${tip}" aria-label="${tip}">
                <span class="pb-val">${d.min >= 1 ? Math.round(d.min) : ''}</span>
                <span class="pb-track"><span class="pb-fill" style="height:${h}%"></span></span>
                <span class="pb-day">${today ? 'Nay' : DAYS[d.d.getDay()]}</span>
            </div>`;
        }).join('');
    }

    async function refresh() {
        if (!sbUserId) { render([]); return; }
        const days = await collect();
        const key = JSON.stringify(days.map(d => [Math.round(d.min), Math.round(d.kcal), d.reps]));
        if (key !== lastKey) { lastKey = key; render(days); }
    }

    // called whenever history / activities change; batched
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(refresh, 600);
    }
    return { refresh, schedule, reset: () => { lastKey = ''; schedule(); } };
})();
window.ProgressCard = ProgressCard;
ProgressCard.reset();
