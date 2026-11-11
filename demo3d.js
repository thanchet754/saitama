// ==============================================================
// 3D EXERCISE DEMOS
// A jointed mannequin (three.js) animated from keyframed joint angles.
// One shared renderer; its canvas moves between containers:
// the home card, the guided-workout rest screen and the in-workout "?" panel.
// ==============================================================
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

// ---- short how-to steps shown next to the 3D demo ----
const DEMO_STEPS = {
    SQUAT: ['Đứng rộng bằng vai, mũi chân hơi mở', 'Đẩy hông ra sau, hạ tới khi đùi song song sàn', 'Đạp gót đứng lên, lưng luôn thẳng'],
    LUNGE: ['Bước một chân lên trước, chân sau kiễng gót', 'Hạ thẳng người tới khi hai gối gập ~90°', 'Đẩy chân trước đứng lên, rồi đổi chân'],
    PUSHUP: ['Hai tay rộng hơn vai, thân thẳng từ đầu đến gót', 'Gập khuỷu hạ ngực sát sàn', 'Đẩy mạnh lên, không võng hông'],
    KNEE_PUSHUP: ['Quỳ gối, hai tay rộng hơn vai', 'Giữ thẳng từ đầu tới gối, hạ ngực xuống', 'Đẩy lên tới khi duỗi thẳng tay'],
    PLANK: ['Chống cẳng tay, khuỷu ngay dưới vai', 'Siết bụng và mông, thân thẳng một đường', 'Giữ nguyên, thở đều'],
    MOUNTAIN_CLIMBER: ['Vào tư thế chống đẩy cao', 'Kéo gối về phía ngực rồi đổi chân thật nhanh', 'Giữ hông thấp, vai ngay trên cổ tay'],
    HIGH_KNEES: ['Đứng thẳng, chạy tại chỗ', 'Nâng gối cao ngang hông', 'Đánh tay nhịp nhàng, tiếp đất bằng mũi chân'],
    JUMPING_JACK: ['Đứng chụm chân, tay xuôi', 'Bật nhảy dang chân, vung tay qua đầu', 'Bật về tư thế đầu, lặp liên tục'],
    CURL: ['Đứng thẳng cầm tạ, lòng bàn tay hướng trước', 'Giữ khuỷu sát thân, gập tạ lên vai', 'Hạ chậm tới khi duỗi thẳng tay'],
    SHOULDER_PRESS: ['Tạ ngang vai, khuỷu ngay dưới cổ tay', 'Đẩy tạ thẳng lên qua đầu', 'Hạ chậm về ngang vai'],
    LATERAL_RAISE: ['Đứng thẳng, tạ hai bên hông', 'Nâng tay sang ngang tới ngang vai, khuỷu hơi cong', 'Hạ chậm, không vung người'],
    FRONT_RAISE: ['Đứng thẳng, tạ trước đùi', 'Nâng thẳng tay ra trước tới ngang vai', 'Hạ chậm về chỗ cũ'],
    TRICEP_EXT: ['Giơ tạ qua đầu, khuỷu hướng lên trần', 'Gập khuỷu hạ tạ ra sau đầu', 'Duỗi tay đẩy tạ lên, khuỷu giữ yên'],
    SITUP: ['Nằm ngửa, co gối, bàn chân đặt sàn', 'Siết bụng cuộn thân trên lên', 'Hạ chậm xuống, không giật cổ'],
    LEG_RAISE: ['Nằm ngửa, tay đặt dọc thân', 'Giữ chân thẳng, nâng lên tới ~90°', 'Hạ chậm, lưng dưới áp sàn'],
    GLUTE_BRIDGE: ['Nằm ngửa, co gối, bàn chân gần mông', 'Siết mông đẩy hông lên thành đường thẳng', 'Hạ chậm xuống rồi lặp lại'],
    WALL_SIT: ['Tựa lưng vào tường', 'Trượt xuống tới khi gối gập ~90°', 'Giữ nguyên, thở đều']
};

// ---- animations ----
// Angles in degrees. pitch: whole body (+ = lean forward / face down).
// Per side: sf shoulder raise forward, sa shoulder raise sideways, st arm twist,
// e elbow bend, hf hip raise forward (negative = leg back), ha leg out, k knee bend.
// supports: two points that must touch the floor (solves body tilt);
// anchor: point that stays in place horizontally.
const STAND_ARMS = { sa: 6, e: 8 };
const DEMOS = {
    SQUAT: {
        period: 2.6, flat: 'LR', anchor: 'heel', cam: { az: 38 },
        frames: [{ both: STAND_ARMS }, { pitch: 35, both: { hf: 118, k: 115, sf: 105, e: 0 } }]
    },
    LUNGE: {
        period: 2.8, flat: 'L', cam: { az: 70 },
        frames: [
            { L: { hf: 28, sa: 8 }, R: { hf: -22, sa: 8 } },
            { L: { hf: 88, k: 90, sa: 8 }, R: { hf: -12, k: 95, sa: 8 } }
        ]
    },
    PUSHUP: {
        period: 2.4, pitch: 90, supports: ['hand', 'toe'], anchor: 'hand', cam: { az: 80, el: 14 },
        frames: [{ both: { sf: 88, sa: 12 } }, { both: { sf: 12, sa: 12, e: 88 } }]
    },
    KNEE_PUSHUP: {
        period: 2.4, pitch: 90, supports: ['hand', 'knee'], anchor: 'hand', cam: { az: 80, el: 14 },
        frames: [{ both: { sf: 88, sa: 12, k: 95 } }, { both: { sf: 12, sa: 12, e: 88, k: 95 } }]
    },
    PLANK: {
        period: 3, pitch: 90, supports: ['elbow', 'toe'], anchor: 'elbow', cam: { az: 80, el: 14 },
        frames: [{ both: { sf: 90, e: 90 } }, { spine: 2, both: { sf: 90, e: 90 } }]
    },
    MOUNTAIN_CLIMBER: {
        period: 1.1, pitch: 90, supports: ['hand', 'toe*'], anchor: 'hand', cam: { az: 75, el: 14 },
        frames: [
            { both: { sf: 85, sa: 10 }, L: { hf: 95, k: 110 } },
            { both: { sf: 85, sa: 10 } },
            { both: { sf: 85, sa: 10 }, R: { hf: 95, k: 110 } },
            { both: { sf: 85, sa: 10 } }
        ]
    },
    HIGH_KNEES: {
        period: 0.9, flat: 'LR', cam: { az: 40 },
        frames: [
            { L: { hf: 90, k: 95, sf: -25, e: 85 }, R: { sf: 45, e: 85 } },
            { lift: 0.06, both: { sf: 10, e: 85 } },
            { R: { hf: 90, k: 95, sf: -25, e: 85 }, L: { sf: 45, e: 85 } },
            { lift: 0.06, both: { sf: 10, e: 85 } }
        ]
    },
    JUMPING_JACK: {
        period: 1.3, flat: 'LR', cam: { az: 15 },
        frames: [
            { both: { sa: 5 } },
            { lift: 0.1, both: { sa: 90, ha: 12 } },
            { both: { sa: 168, ha: 22 } },
            { lift: 0.1, both: { sa: 90, ha: 12 } }
        ]
    },
    CURL: {
        period: 2.4, flat: 'LR', dumbbell: true, cam: { az: 35 },
        frames: [{ both: { sf: 4, sa: 6, e: 5 } }, { both: { sf: 8, sa: 6, e: 140 } }]
    },
    SHOULDER_PRESS: {
        period: 2.4, flat: 'LR', dumbbell: true, cam: { az: 20 },
        frames: [{ both: { sa: 88, st: 90, e: 95 } }, { both: { sa: 168, st: 90, e: 10 } }]
    },
    LATERAL_RAISE: {
        period: 2.4, flat: 'LR', dumbbell: true, cam: { az: 15 },
        frames: [{ both: { sa: 10, e: 12 } }, { both: { sa: 86, e: 15 } }]
    },
    FRONT_RAISE: {
        period: 2.4, flat: 'LR', dumbbell: true, cam: { az: 60 },
        frames: [{ both: { sf: 5, sa: 4 } }, { both: { sf: 90, sa: 4 } }]
    },
    TRICEP_EXT: {
        period: 2.4, flat: 'LR', dumbbell: true, cam: { az: 65 },
        frames: [{ both: { sf: 168, sa: 8, e: 135 } }, { both: { sf: 168, sa: 8, e: 8 } }]
    },
    SITUP: {
        period: 2.4, pitch: -90, flat: 'LR', cam: { az: 75, el: 16 },
        frames: [
            { both: { hf: 55, k: 110, sf: 20 } },
            { spine: 58, neck: 12, both: { hf: 55, k: 110, sf: 55 } }
        ]
    },
    LEG_RAISE: {
        period: 2.6, pitch: -90, cam: { az: 75, el: 16 },
        frames: [{ both: { hf: 6, sa: 6 } }, { both: { hf: 85, sa: 6 } }]
    },
    GLUTE_BRIDGE: {
        period: 2.4, pitch: -90, flat: 'LR', supports: ['shoulder', 'heel'], cam: { az: 75, el: 16 },
        frames: [{ both: { hf: 72, k: 118, sa: 8 } }, { both: { hf: 8, k: 92, sa: 8 } }]
    },
    WALL_SIT: {
        period: 3, flat: 'LR', wall: true, cam: { az: 70 },
        frames: [
            { both: { hf: 90, k: 90, sf: 55, e: 25 } },
            { spine: 1, both: { hf: 90, k: 90, sf: 55, e: 25 } }
        ]
    }
};

const POSE_KEYS = ['pitch', 'spine', 'neck', 'lift'];
const SIDE_KEYS = ['sf', 'sa', 'st', 'e', 'hf', 'ha', 'k'];

function normalizePose(f, basePitch) {
    const p = { pitch: basePitch || 0, spine: 0, neck: 0, lift: 0 };
    POSE_KEYS.forEach(k => { if (f[k] !== undefined) p[k] = f[k]; });
    ['L', 'R'].forEach(s => SIDE_KEYS.forEach(k => {
        const v = (f[s] && f[s][k] !== undefined) ? f[s][k] : (f.both && f.both[k] !== undefined ? f.both[k] : 0);
        p[s + k] = v;
    }));
    return p;
}

const ExerciseDemo = (() => {
    let THREE = null, loading = null;
    let renderer, scene, camera, rig, floor, wall, dumbbells = [];
    let container = null, key = null, demo = null, poses = null;
    let anchorRef = null, raf = 0, lastFrame = 0, startTs = 0;
    let az = 0, el = 12, dist = 3, target = null, resizeObs = null;
    const rad = d => d * Math.PI / 180;

    async function load() {
        if (THREE) return;
        if (!loading) loading = import(THREE_URL).then(m => { THREE = m; build(); });
        await loading;
    }

    // ---------- mannequin ----------
    function build() {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.className = 'demo-canvas';

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
        target = new THREE.Vector3(0, 0.8, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.8);
        sun.position.set(2.5, 5, 3);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
        scene.add(sun, sun.target);

        floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48),
            new THREE.MeshStandardMaterial({ color: 0x8a90a0, transparent: true, opacity: 0.28, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.9, transparent: true, opacity: 0.55 }));
        wall.receiveShadow = true;
        scene.add(wall);

        const skin = new THREE.MeshStandardMaterial({ color: 0xd8dce6, roughness: 0.55 });
        const shirt = new THREE.MeshStandardMaterial({ color: 0xff5e3a, roughness: 0.6 });
        const shorts = new THREE.MeshStandardMaterial({ color: 0x2c3140, roughness: 0.7 });
        const shoe = new THREE.MeshStandardMaterial({ color: 0x00c2d1, roughness: 0.5 });
        const metal = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.35, metalness: 0.6 });

        const G = () => new THREE.Group();
        const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
        // capsule hanging from its joint along -Y (or +Y)
        const limb = (len, r, mat, up) => {
            const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 12), mat);
            m.position.y = (up ? 1 : -1) * len / 2;
            return m;
        };
        const marker = (parent, x, y, z, r) => { const o = G(); o.position.set(x, y, z); o.userData.r = r; parent.add(o); return o; };

        rig = { m: {} };
        const root = rig.root = G();
        scene.add(root);
        root.add(mesh(new THREE.SphereGeometry(0.135, 20, 14), shorts)).scale.set(1.15, 0.8, 0.8);
        rig.m.pelvis = marker(root, 0, -0.03, 0, 0.11);

        const spine = rig.spine = G();
        spine.position.y = 0.04;
        root.add(spine);
        const torso = limb(0.46, 0.14, shirt, true);
        torso.scale.set(1.2, 1, 0.8);
        spine.add(torso);
        rig.m.mid = marker(spine, 0, 0.2, 0, 0.12);
        rig.m.chest = marker(spine, 0, 0.36, 0, 0.12);

        const neck = rig.neck = G();
        neck.position.y = 0.46;
        spine.add(neck);
        neck.add(limb(0.1, 0.05, skin, true));
        const head = mesh(new THREE.SphereGeometry(0.11, 20, 16), skin);
        head.position.y = 0.17;
        head.scale.set(0.9, 1.05, 1);
        neck.add(head);
        rig.m.head = marker(neck, 0, 0.17, 0, 0.11);

        rig.L = {}; rig.R = {};
        ['L', 'R'].forEach(side => {
            const s = side === 'L' ? 1 : -1;
            const S = rig[side];
            // arm
            S.shoulder = G();
            S.shoulder.position.set(0.2 * s, 0.4, 0);
            spine.add(S.shoulder);
            S.shoulder.add(limb(0.3, 0.055, shirt));
            S.shoulder.add(mesh(new THREE.SphereGeometry(0.068, 14, 10), shirt));
            rig.m['shoulder' + side] = marker(S.shoulder, 0, 0, 0, 0.07);
            S.elbow = G();
            S.elbow.position.y = -0.3;
            S.shoulder.add(S.elbow);
            S.elbow.add(limb(0.27, 0.045, skin));
            S.elbow.add(mesh(new THREE.SphereGeometry(0.052, 12, 10), skin));
            rig.m['elbow' + side] = marker(S.elbow, 0, 0, 0, 0.05);
            const hand = mesh(new THREE.SphereGeometry(0.045, 12, 10), skin);
            hand.position.y = -0.29;
            S.elbow.add(hand);
            rig.m['hand' + side] = marker(S.elbow, 0, -0.3, 0, 0.04);
            // dumbbell across the fist
            const db = G();
            db.position.y = -0.3;
            const bar = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), metal);
            bar.rotation.z = Math.PI / 2;
            db.add(bar);
            [-0.09, 0.09].forEach(x => { const w = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), metal); w.rotation.z = Math.PI / 2; w.position.x = x; db.add(w); });
            S.elbow.add(db);
            dumbbells.push(db);
            // leg
            S.hip = G();
            S.hip.position.set(0.1 * s, -0.06, 0);
            root.add(S.hip);
            S.hip.add(limb(0.44, 0.075, shorts));
            S.hip.add(mesh(new THREE.SphereGeometry(0.085, 14, 10), shorts));
            S.knee = G();
            S.knee.position.y = -0.44;
            S.hip.add(S.knee);
            S.knee.add(limb(0.43, 0.06, skin));
            S.knee.add(mesh(new THREE.SphereGeometry(0.068, 12, 10), skin));
            rig.m['knee' + side] = marker(S.knee, 0, 0, 0, 0.06);
            S.ankle = G();
            S.ankle.position.y = -0.43;
            S.knee.add(S.ankle);
            const foot = mesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 10), shoe);
            foot.rotation.x = Math.PI / 2;
            foot.position.set(0, -0.04, 0.06);
            S.ankle.add(foot);
            rig.m['heel' + side] = marker(S.ankle, 0, -0.04, -0.03, 0.045);
            rig.m['toe' + side] = marker(S.ankle, 0, -0.04, 0.15, 0.04);
        });
        rig.markers = Object.values(rig.m);

        // drag to rotate
        const el0 = renderer.domElement;
        let dragX = null;
        el0.addEventListener('pointerdown', e => { dragX = e.clientX; el0.setPointerCapture(e.pointerId); });
        el0.addEventListener('pointermove', e => { if (dragX === null) return; az -= (e.clientX - dragX) * 0.5; dragX = e.clientX; });
        const end = () => { dragX = null; };
        el0.addEventListener('pointerup', end);
        el0.addEventListener('pointercancel', end);
    }

    // ---------- posing ----------
    function applyPose(p) {
        const root = rig.root;
        root.rotation.set(rad(p.pitch), 0, 0, 'YXZ');
        rig.spine.rotation.x = rad(p.spine);
        rig.neck.rotation.x = rad(p.neck);
        ['L', 'R'].forEach(side => {
            const s = side === 'L' ? 1 : -1, S = rig[side];
            const g = k => rad(p[side + k]);
            S.shoulder.rotation.set(-g('sf'), s * g('st'), s * g('sa'), 'ZXY');
            S.elbow.rotation.x = -g('e');
            S.hip.rotation.set(-g('hf'), 0, s * g('ha'), 'ZXY');
            S.knee.rotation.x = g('k');
            // flat foot: cancel the leg chain's forward/back tilt
            S.ankle.rotation.x = demo.flat && demo.flat.includes(side) ? -(rad(p.pitch) - g('hf') + g('k')) : 0;
        });
    }

    const tmp = () => new THREE.Vector3();
    function worldOf(name, p) {
        if (name.endsWith('*')) { // the planted side = leg raised the least
            const base = name.slice(0, -1);
            return worldOf(base + (p.Lhf <= p.Rhf ? 'L' : 'R'), p);
        }
        if (rig.m[name]) return rig.m[name].getWorldPosition(tmp());
        const a = rig.m[name + 'L'].getWorldPosition(tmp()), b = rig.m[name + 'R'].getWorldPosition(tmp());
        return a.add(b).multiplyScalar(0.5);
    }
    const radiusOf = (name) => { const n = name.replace('*', ''); const m = rig.m[n] || rig.m[n + 'L']; return m ? m.userData.r : 0; };
    const supportY = (name, p) => worldOf(name, p).y - radiusOf(name);

    function solveSupports(p) {
        if (!demo.supports) return;
        const [a, b] = demo.supports;
        const base = p.pitch;
        const f = d => { p.pitch = base + d; applyPose(p); rig.root.updateMatrixWorld(true); return supportY(a, p) - supportY(b, p); };
        let lo = -50, hi = 50, flo = f(lo), fhi = f(hi);
        if (flo * fhi > 0) { p.pitch = base; applyPose(p); return; }
        for (let i = 0; i < 22; i++) {
            const mid = (lo + hi) / 2, fm = f(mid);
            if (fm * flo <= 0) { hi = mid; } else { lo = mid; flo = fm; }
        }
        p.pitch = base + (lo + hi) / 2;
        applyPose(p);
    }

    function place(p) {
        const root = rig.root;
        root.position.set(0, 0, 0);
        applyPose(p);
        root.updateMatrixWorld(true);
        solveSupports(p);
        root.updateMatrixWorld(true);
        let minY = Infinity;
        rig.markers.forEach(mk => { const v = mk.getWorldPosition(tmp()); minY = Math.min(minY, v.y - mk.userData.r); });
        root.position.y = -minY + (p.lift || 0);
        if (demo.anchor && anchorRef) {
            root.updateMatrixWorld(true);
            const v = worldOf(demo.anchor, p);
            root.position.x += anchorRef.x - v.x;
            root.position.z += anchorRef.z - v.z;
        }
        root.updateMatrixWorld(true);
    }

    function poseAt(t) {
        const n = poses.length;
        const x = (t / demo.period % 1) * n;
        const i = Math.floor(x), j = (i + 1) % n;
        let u = x - i;
        u = u * u * (3 - 2 * u); // ease in-out
        const a = poses[i], b = poses[j], out = {};
        for (const k in a) out[k] = a[k] + (b[k] - a[k]) * u;
        return out;
    }

    function setExercise(k) {
        key = k;
        demo = DEMOS[k] || DEMOS.SQUAT;
        poses = demo.frames.map(f => normalizePose(f, demo.pitch));
        dumbbells.forEach(d => { d.visible = !!demo.dumbbell; });
        anchorRef = null;
        // reference + framing from a couple of sampled poses
        place({ ...poses[0] });
        if (demo.anchor) anchorRef = worldOf(demo.anchor, poses[0]).clone();
        const box = new THREE.Box3();
        for (let s = 0; s < 6; s++) {
            place(poseAt(demo.period * s / 6));
            rig.markers.forEach(mk => box.expandByPoint(mk.getWorldPosition(tmp())));
        }
        box.expandByScalar(0.12);
        const c = box.getCenter(tmp()), size = box.getSize(tmp());
        target.copy(c);
        floor.position.set(c.x, 0.002, c.z);
        floor.scale.setScalar(Math.min(1, Math.max(0.45, Math.max(size.x, size.z) / 2.6)));
        wall.visible = !!demo.wall;
        if (demo.wall) {
            place({ ...poses[0] });
            const back = Math.min(worldOf('pelvis', poses[0]).z, worldOf('chest', poses[0]).z) - 0.17;
            wall.position.set(c.x, 0.95, back - 0.03);
        }
        az = demo.cam.az;
        el = demo.cam.el ?? 10;
        dist = null; // computed in fitCamera()
        frameSize = Math.max(size.x, size.y, size.z);
        startTs = performance.now();
    }

    let frameSize = 2;
    function fitCamera() {
        const w = container.clientWidth || 300, h = container.clientHeight || 300;
        camera.aspect = w / h;
        const vfov = rad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        const fov = Math.min(vfov, hfov);
        const d = (frameSize * 0.58) / Math.tan(fov / 2);
        const ea = rad(el), aa = rad(az);
        camera.position.set(
            target.x + d * Math.cos(ea) * Math.sin(aa),
            target.y + d * Math.sin(ea),
            target.z + d * Math.cos(ea) * Math.cos(aa));
        camera.lookAt(target);
        camera.updateProjectionMatrix();
    }

    function resize() {
        if (!container) return;
        const w = container.clientWidth, h = container.clientHeight;
        if (w && h) renderer.setSize(w, h, false);
    }

    function loop(now) {
        raf = requestAnimationFrame(loop);
        if (document.hidden || now - lastFrame < 30) return; // ~30 fps is plenty
        lastFrame = now;
        place(poseAt((now - startTs) / 1000));
        fitCamera();
        renderer.render(scene, camera);
    }

    async function show(el, exKey) {
        if (!el) return;
        const want = { el, exKey };
        pending = want;
        try { await load(); } catch (e) { console.warn('3D demo unavailable', e); return; }
        if (pending !== want) return;
        if (container !== el) {
            container = el;
            el.appendChild(renderer.domElement);
            if (resizeObs) resizeObs.disconnect();
            resizeObs = new ResizeObserver(resize);
            resizeObs.observe(el);
            resize();
        }
        if (exKey !== key) setExercise(exKey);
        if (!raf) raf = requestAnimationFrame(loop);
    }
    let pending = null;

    function hide() {
        pending = null;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (renderer && renderer.domElement.parentNode) renderer.domElement.remove();
        if (resizeObs) resizeObs.disconnect();
        container = null;
    }

    // test hook: render one exercise at a given phase (0..1) right now
    function renderAt(k, phase) {
        if (!container) return false;
        if (k !== key) setExercise(k);
        place(poseAt(demo.period * phase));
        fitCamera();
        renderer.render(scene, camera);
        return renderer.domElement;
    }

    return { show, hide, renderAt, has: k => !!DEMOS[k], steps: k => DEMO_STEPS[k] || [], frames: k => (DEMOS[k] || DEMOS.SQUAT).frames.length };
})();
window.ExerciseDemo = ExerciseDemo;

// ---------- where the demo appears ----------
// Home card (exercise picker), guided-workout rest/prep screen, and the
// in-workout "?" panel. Callers just say what they want shown.
const DemoUI = {
    wsOpen: false,
    overlayKey: null,

    renderHomeText(k) {
        const ex = EXERCISES[k];
        if (!ex) return;
        $('demo-name').innerHTML = `<i class="fa-solid ${ex.icon}"></i> ${ex.name}`;
        $('demo-steps').innerHTML = ExerciseDemo.steps(k).map(s => `<li>${s}</li>`).join('');
    },

    // decide which container gets the 3D view right now
    refresh() {
        const k = currentExercise;
        const training = document.body.classList.contains('workout-on');
        if (this.overlayKey) ExerciseDemo.show($('runner-ov-demo'), this.overlayKey);
        else if (training && this.wsOpen) ExerciseDemo.show($('ws-demo-stage'), k);
        else if (!training && !document.body.classList.contains('runner-on') && !$('mode-camera').hidden) ExerciseDemo.show($('demo-stage'), k);
        else ExerciseDemo.hide();
        $('ws-demo').hidden = !(training && this.wsOpen && !this.overlayKey);
        if (!training && !this.overlayKey) this.renderHomeText(k);
    },

    setOverlay(k) {
        if (k === this.overlayKey) return;
        this.overlayKey = k;
        this.refresh();
    },

    toggleWs() {
        this.wsOpen = !this.wsOpen;
        $('btn-demo').classList.toggle('active', this.wsOpen);
        this.refresh();
    }
};
window.DemoUI = DemoUI;
window.toggleDemo = () => DemoUI.toggleWs();
DemoUI.refresh();
