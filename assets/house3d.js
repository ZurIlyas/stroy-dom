/* 3D-модель каркасного дома для первого экрана.
   Дом собирается по прокрутке: фундамент → каркас → стропила → стены и окна → кровля.
   House3D.init(canvas) возвращает { set(p) }, где p — прогресс от 0 до 1. */
(function () {
  'use strict';

  function init(canvas) {
    const T = window.THREE;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

    scene.add(new T.HemisphereLight(0xffffff, 0x8f887c, 0.55));
    const sun = new T.DirectionalLight(0xfff1dc, 0.8);
    sun.position.set(9, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0006;
    scene.add(sun);

    const ground = new T.Mesh(new T.CircleGeometry(11, 48), new T.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const house = new T.Group();
    scene.add(house);

    // у каждого этапа свои материалы: этап проявляется целиком, меняя их прозрачность
    const mat = (color, o) => new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.82, metalness: 0.04, transparent: true }, o || {}));
    const M = {
      steel: mat(0x3a3d42, { roughness: 0.6, metalness: 0.35 }),
      deck: mat(0xb98f58),
      wood: mat(0xc9995a),
      rafter: mat(0xc9995a),
      facade: mat(0xa9652f),
      dark: mat(0x232528, { roughness: 0.65, metalness: 0.25 }),
      glass: mat(0x7fb0cc, { roughness: 0.12, metalness: 0.3 }),
      roof: mat(0x17181b, { roughness: 0.55, metalness: 0.35 })
    };
    M.glass.userData.max = 0.62;

    const parts = [];   // { mesh, t0, t1, from: Vector3, grow }
    function add(mesh, t0, t1, from, grow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.home = mesh.position.clone();
      house.add(mesh);
      parts.push({ mesh: mesh, t0: t0, t1: t1, from: from || null, grow: !!grow });
      return mesh;
    }
    function box(w, h, d, m, x, y, z) {
      const g = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      g.position.set(x, y, z);
      return g;
    }
    const up = (n) => new T.Vector3(0, n, 0);

    const L = 8, D = 6, BASE = 0.68, H = 2.8, TOP = BASE + H, RIDGE = TOP + 1.6;
    const hx = L / 2, hz = D / 2;

    // 1. фундамент: сваи и обвязка — видны сразу
    [-3.8, -1.27, 1.27, 3.8].forEach(function (x) {
      [-2.8, 0, 2.8].forEach(function (z) {
        const p = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.45, 16), M.steel);
        p.position.set(x, 0.225, z);
        add(p, -1, 0);
      });
      add(box(0.16, 0.15, D, M.steel, x, 0.525, 0), -1, 0);
    });
    [-2.8, 0, 2.8].forEach(function (z) { add(box(L, 0.15, 0.16, M.steel, 0, 0.525, z), -1, 0); });

    // 2. каркас: настил, обвязки, стойки растут снизу вверх
    add(box(L, 0.08, D, M.deck, 0, 0.64, 0), 0.02, 0.1, up(-0.4));

    // проёмы: стена, от, до (вдоль стены), низ и верх от пола
    const OPEN = {
      front: [{ a: -3.1, b: -0.7, y0: 0.15, y1: 2.35 }, { a: 0.5, b: 1.5, y0: 0, y1: 2.2, door: true }, { a: 2.2, b: 3.3, y0: 0.9, y1: 2.2 }],
      back: [{ a: -2.6, b: -1.4, y0: 0.9, y1: 2.2 }, { a: 1.4, b: 2.6, y0: 0.9, y1: 2.2 }],
      left: [{ a: -1.0, b: 1.0, y0: 0.9, y1: 2.2 }],
      right: [{ a: -1.0, b: 1.0, y0: 0.9, y1: 2.2 }]
    };
    const WALLS = [
      { key: 'front', along: 'x', at: hz - 0.07, half: hx, n: new T.Vector3(0, 0, 1) },
      { key: 'back', along: 'x', at: -hz + 0.07, half: hx, n: new T.Vector3(0, 0, -1) },
      { key: 'left', along: 'z', at: -hx + 0.07, half: hz - 0.14, n: new T.Vector3(-1, 0, 0) },
      { key: 'right', along: 'z', at: hx - 0.07, half: hz - 0.14, n: new T.Vector3(1, 0, 0) }
    ];
    const place = (w, u, y) => w.along === 'x' ? [u, y, w.at] : [w.at, y, u];
    const size = (w, len, h, th) => w.along === 'x' ? [len, h, th] : [th, h, len];

    let si = 0;
    WALLS.forEach(function (w) {
      const len = w.half * 2;
      [BASE + 0.04, TOP - 0.04].forEach(function (y, k) {
        const s = size(w, len, 0.08, 0.14), p = place(w, 0, y);
        add(box(s[0], s[1], s[2], M.wood, p[0], p[1], p[2]), k ? 0.2 : 0.06, k ? 0.3 : 0.14, up(k ? 0.8 : -0.3));
      });
      const n = Math.round(len / 0.6);
      for (let i = 0; i <= n; i++) {
        const u = -w.half + 0.03 + (len - 0.06) * i / n;
        if (OPEN[w.key].some(function (o) { return u > o.a + 0.02 && u < o.b - 0.02; })) continue;
        const geo = new T.BoxGeometry(w.along === 'x' ? 0.05 : 0.14, H - 0.16, w.along === 'x' ? 0.14 : 0.05);
        geo.translate(0, (H - 0.16) / 2, 0);
        const m = new T.Mesh(geo, M.wood), p = place(w, u, BASE + 0.08);
        m.position.set(p[0], p[1], p[2]);
        const t = 0.08 + 0.14 * (si++ % 60) / 60;
        add(m, t, t + 0.08, null, true);
      }
      OPEN[w.key].forEach(function (o) {
        const mid = (o.a + o.b) / 2, wd = o.b - o.a;
        [o.y1 + 0.06].concat(o.y0 > 0.2 ? [o.y0 - 0.06] : []).forEach(function (y) {
          const s = size(w, wd, 0.12, 0.14), p = place(w, mid, BASE + y);
          add(box(s[0], s[1], s[2], M.wood, p[0], p[1], p[2]), 0.2, 0.28, up(0.6));
        });
        [o.a, o.b].forEach(function (u) {
          const s = size(w, 0.05, H - 0.16, 0.14), p = place(w, u, BASE + H / 2);
          add(box(s[0], s[1], s[2], M.wood, p[0], p[1], p[2]), 0.16, 0.24, up(0.6));
        });
      });
    });

    // 3. стропила опускаются сверху
    const EAVE = hz + 0.4, slope = (RIDGE - TOP) / hz, eaveY = RIDGE - EAVE * slope;
    const rLen = Math.sqrt(EAVE * EAVE + (RIDGE - eaveY) * (RIDGE - eaveY)), ang = Math.atan2(RIDGE - eaveY, EAVE);
    const nT = 13;
    for (let i = 0; i < nT; i++) {
      const x = -hx - 0.3 + (L + 0.6) * i / (nT - 1), t = 0.3 + 0.12 * i / nT;
      [1, -1].forEach(function (s) {
        const r = box(0.05, 0.18, rLen, M.rafter, x, (RIDGE + eaveY) / 2, s * EAVE / 2);
        r.rotation.x = s * ang;
        add(r, t, t + 0.08, up(2.6));
      });
      if (x > -hx && x < hx) add(box(0.05, 0.14, D, M.rafter, x, TOP + 0.07, 0), t, t + 0.08, up(2.6));
    }
    add(box(L + 0.6, 0.2, 0.06, M.rafter, 0, RIDGE - 0.08, 0), 0.4, 0.48, up(2.6));

    // 4. стены и окна подъезжают снаружи
    WALLS.forEach(function (w, wi) {
      const m = w.along === 'x' ? M.facade : M.dark, half = w.half + (w.along === 'x' ? 0.13 : 0.14);
      const at = w.at + (w.along === 'x' ? 1 : 1) * 0.13 * (w.n.x + w.n.z), from = w.n.clone().multiplyScalar(2.6);
      const t0 = 0.5 + wi * 0.045;
      function seg(a, b, y0, y1, material, th) {
        if (b - a < 0.01 || y1 - y0 < 0.01) return;
        const W2 = { along: w.along, at: at }, s = size(W2, b - a, y1 - y0, th || 0.12), p = place(W2, (a + b) / 2, BASE + (y0 + y1) / 2);
        add(box(s[0], s[1], s[2], material || m, p[0], p[1], p[2]), t0, t0 + 0.12, from);
      }
      let prev = -half;
      OPEN[w.key].forEach(function (o) {
        seg(prev, o.a, 0, H);
        seg(o.a, o.b, 0, o.y0);
        seg(o.a, o.b, o.y1, H);
        seg(o.a, o.b, o.y0, o.y1, o.door ? M.dark : M.glass, 0.05);
        prev = o.b;
      });
      seg(prev, half, 0, H);
      // фронтоны на торцах
      if (w.along === 'z') {
        const sh = new T.Shape();
        sh.moveTo(-hz - 0.13, 0); sh.lineTo(hz + 0.13, 0); sh.lineTo(0, RIDGE - TOP - 0.02); sh.closePath();
        const g = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), M.dark);
        g.rotation.y = Math.PI / 2;
        g.position.set(at - 0.06, TOP, 0);
        add(g, t0 + 0.04, t0 + 0.16, from);
      }
    });
    // крыльцо
    add(box(2.2, 0.12, 1.1, M.deck, 1.0, 0.55, hz + 0.75), 0.62, 0.72, new T.Vector3(0, 0, 2));
    add(box(1.6, 0.12, 0.5, M.deck, 1.0, 0.27, hz + 1.5), 0.64, 0.74, new T.Vector3(0, 0, 2));

    // 5. кровля ложится последней
    [1, -1].forEach(function (s, k) {
      const off = 0.16;
      const r = box(L + 0.9, 0.07, rLen + 0.12, M.roof,
        0, (RIDGE + eaveY) / 2 + off * Math.cos(ang), s * (EAVE / 2 + off * Math.sin(ang)));
      r.rotation.x = s * ang;
      add(r, 0.76 + k * 0.06, 0.92 + k * 0.04, up(3.4));
    });
    add(box(L + 0.9, 0.09, 0.3, M.roof, 0, RIDGE + 0.15, 0), 0.9, 0.97, up(2));

    // материалы → этапы, чтобы плавно проявлять
    const fades = [
      [M.deck, 0.02, 0.1], [M.wood, 0.06, 0.16], [M.rafter, 0.3, 0.38],
      [M.facade, 0.5, 0.6], [M.dark, 0.52, 0.64], [M.glass, 0.56, 0.7], [M.roof, 0.76, 0.86]
    ];
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function draw(p) {
      fades.forEach(function (f) {
        f[0].opacity = ease(clamp((p - f[1]) / (f[2] - f[1]))) * (f[0].userData.max || 1);
      });
      parts.forEach(function (it) {
        const e = it.t0 < 0 ? 1 : ease(clamp((p - it.t0) / (it.t1 - it.t0)));
        it.mesh.visible = e > 0.001;
        if (it.grow) it.mesh.scale.y = Math.max(e, 0.001);
        if (it.from) it.mesh.position.copy(it.mesh.userData.home).addScaledVector(it.from, 1 - e);
      });
      house.rotation.y = -0.95 + p * 1.5;
      const r = 21.5 * Math.max(1, 1.2 / camera.aspect), elev = 0.4 - p * 0.1;
      camera.position.set(0, 2.2 + r * Math.sin(elev), r * Math.cos(elev));
      camera.lookAt(0, 2.2, 0);
      renderer.render(scene, camera);
    }

    let target = 0, cur = -1, raf = 0;
    function loop() {
      raf = 0;
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      draw(cur);
      if (cur !== target) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    resize();
    cur = 0;
    draw(0);
    window.addEventListener('resize', function () { resize(); draw(cur); });

    return {
      set: function (p) { target = clamp(p); kick(); },
      jump: function (p) { target = cur = clamp(p); resize(); draw(cur); }
    };
  }

  window.House3D = { init: init };
})();
