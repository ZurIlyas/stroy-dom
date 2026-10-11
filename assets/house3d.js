/* 3D-модель каркасного дома для первого экрана.
   Дом собирается по прокрутке: фундамент → каркас → стропила → утеплитель → стены и окна → кровля → детали.
   House3D.init(canvas) возвращает { set(p), jump(p) }, где p — прогресс от 0 до 1. */
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
    const camera = new T.PerspectiveCamera(28, 1, 0.1, 120);

    scene.add(new T.HemisphereLight(0xeaf4ff, 0xa9b9cf, 0.72));
    const sun = new T.DirectionalLight(0xfff6ea, 0.78);
    sun.position.set(10, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 45;
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new T.DirectionalLight(0x8cc8ff, 0.28);
    fill.position.set(-9, 6, -4);
    scene.add(fill);

    const world = new T.Group();   // площадка и дом вращаются вместе
    scene.add(world);
    const house = new T.Group();
    world.add(house);

    // полосатая текстура: доски, сайдинг, фальц кровли
    function stripes(base, line, lw) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 8;
      const g = c.getContext('2d');
      g.fillStyle = base; g.fillRect(0, 0, 64, 8);
      g.fillStyle = line; g.fillRect(0, 0, lw, 8);
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.encoding = T.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    const mat = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0.03, transparent: true }, o));
    const M = {
      plate: new T.MeshStandardMaterial({ color: 0xe9f2fc, roughness: 0.95 }),
      plateEdge: new T.MeshStandardMaterial({ color: 0xbcd9f7, roughness: 0.9 }),
      concrete: mat({ color: 0xdfe6ee, roughness: 0.9 }),
      steel: mat({ color: 0x16335e, roughness: 0.5, metalness: 0.4 }),
      deck: mat({ map: stripes('#d2a56b', '#b98a50', 3) }),
      wood: mat({ color: 0xdcae6c }),
      rafter: mat({ color: 0xdcae6c }),
      ins: mat({ color: 0x8fd0ff, roughness: 0.95 }),
      wall: mat({ map: stripes('#f6f9fd', '#cfdcea', 3), roughness: 0.7 }),
      navy: mat({ map: stripes('#12305c', '#0b2145', 3), roughness: 0.55, metalness: 0.2 }),
      frame: mat({ color: 0x0f2a52, roughness: 0.5, metalness: 0.2 }),
      door: mat({ color: 0x2f95f0, roughness: 0.45, metalness: 0.1 }),
      glass: mat({ color: 0x8fd3ff, roughness: 0.08, metalness: 0.1, emissive: 0x16508c, emissiveIntensity: 0.35 }),
      roof: mat({ map: stripes('#12305c', '#1d4480', 4), roughness: 0.45, metalness: 0.35 }),
      trim: mat({ color: 0xffffff, roughness: 0.6 })
    };
    M.glass.userData.max = 0.66;

    // площадка-подиум с сеткой, как на чертеже
    const plate = new T.Mesh(new T.CylinderGeometry(7.3, 7.3, 0.18, 96), [M.plateEdge, M.plate, M.plate]);
    plate.position.y = -0.09;
    plate.receiveShadow = true;
    world.add(plate);
    const grid = new T.GridHelper(16, 16, 0x9cc6ef, 0xbfd9f3);
    grid.position.y = 0.004;
    grid.material.transparent = true;
    grid.material.opacity = 0.75;
    world.add(grid);
    grid.scale.setScalar(0.62);

    const parts = [];
    function add(mesh, t0, t1, from, grow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.home = mesh.position.clone();
      house.add(mesh);
      parts.push({ mesh: mesh, t0: t0, t1: t1, from: from || null, grow: !!grow });
      return mesh;
    }
    // развёртка по реальным размерам, чтобы полосы шли с одним шагом на всех деталях
    function worldUV(mesh, k) {
      const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, p = mesh.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + p.x, y = pos.getY(i) + p.y, z = pos.getZ(i) + p.z;
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
        if (nx > 0.5) uv.setXY(i, z * k, y * k);
        else if (ny > 0.5) uv.setXY(i, x * k, z * k);
        else uv.setXY(i, x * k, y * k);
      }
      uv.needsUpdate = true;
    }
    function box(w, h, d, m, x, y, z, k) {
      const g = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      g.position.set(x, y, z);
      if (m.map) worldUV(g, k || 4);
      return g;
    }
    const up = (n) => new T.Vector3(0, n, 0);

    const L = 8, D = 6, BASE = 0.72, H = 2.8, TOP = BASE + H, RIDGE = TOP + 1.7;
    const hx = L / 2, hz = D / 2;

    // 1. фундамент: сваи с оголовками и ростверк — видны сразу
    [-3.8, -1.27, 1.27, 3.8].forEach(function (x) {
      [-2.8, 0, 2.8].forEach(function (z) {
        const p = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.44, 20), M.steel);
        p.position.set(x, 0.22, z);
        add(p, -1, 0);
        add(box(0.34, 0.05, 0.34, M.steel, x, 0.465, z), -1, 0);
      });
      add(box(0.2, 0.18, D, M.concrete, x, 0.58, 0), -1, 0);
    });
    [-2.8, 0, 2.8].forEach(function (z) { add(box(L, 0.18, 0.2, M.concrete, 0, 0.58, z), -1, 0); });

    // 2. каркас: лаги, настил, обвязки, стойки растут снизу вверх
    for (let i = 0; i < 14; i++) add(box(0.05, 0.1, D - 0.1, M.wood, -hx + 0.1 + (L - 0.2) * i / 13, 0.7, 0), 0.02 + i * 0.003, 0.08 + i * 0.003, up(-0.3));
    add(box(L, 0.05, D, M.deck, 0, BASE - 0.025, 0, 5), 0.07, 0.13, up(0.6));

    // проёмы: от, до (вдоль стены), низ и верх от пола
    const OPEN = {
      front: [{ a: -3.2, b: -0.8, y0: 0.12, y1: 2.35, bars: 2 }, { a: 0.45, b: 1.45, y0: 0, y1: 2.2, door: true }, { a: 2.15, b: 3.25, y0: 0.9, y1: 2.2, bars: 1 }],
      back: [{ a: -2.6, b: -1.4, y0: 0.9, y1: 2.2, bars: 1 }, { a: 1.4, b: 2.6, y0: 0.9, y1: 2.2, bars: 1 }],
      left: [{ a: -1.0, b: 1.0, y0: 0.9, y1: 2.2, bars: 1 }],
      right: [{ a: -1.0, b: 1.0, y0: 0.9, y1: 2.2, bars: 1 }]
    };
    const WALLS = [
      { key: 'front', along: 'x', at: hz - 0.07, half: hx, n: new T.Vector3(0, 0, 1) },
      { key: 'back', along: 'x', at: -hz + 0.07, half: hx, n: new T.Vector3(0, 0, -1) },
      { key: 'left', along: 'z', at: -hx + 0.07, half: hz - 0.14, n: new T.Vector3(-1, 0, 0) },
      { key: 'right', along: 'z', at: hx - 0.07, half: hz - 0.14, n: new T.Vector3(1, 0, 0) }
    ];
    const place = (w, u, y, at) => w.along === 'x' ? [u, y, at] : [at, y, u];
    const size = (w, len, h, th) => w.along === 'x' ? [len, h, th] : [th, h, len];
    const sign = (w) => w.n.x + w.n.z;
    function piece(w, u0, u1, y0, y1, th, at, m, t0, t1, from) {
      if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return null;
      const s = size(w, u1 - u0, y1 - y0, th), p = place(w, (u0 + u1) / 2, BASE + (y0 + y1) / 2, at);
      return add(box(s[0], s[1], s[2], m, p[0], p[1], p[2]), t0, t1, from);
    }
    // сплошная стена с вырезами под проёмы
    function wallLayer(w, half, th, at, m, t0, t1, from) {
      let prev = -half;
      OPEN[w.key].forEach(function (o) {
        piece(w, prev, o.a, 0, H, th, at, m, t0, t1, from);
        piece(w, o.a, o.b, 0, o.y0, th, at, m, t0, t1, from);
        piece(w, o.a, o.b, o.y1, H, th, at, m, t0, t1, from);
        prev = o.b;
      });
      piece(w, prev, half, 0, H, th, at, m, t0, t1, from);
    }

    let si = 0;
    WALLS.forEach(function (w) {
      const len = w.half * 2;
      piece(w, -w.half, w.half, 0, 0.08, 0.14, w.at, M.wood, 0.1, 0.16, up(0.5));
      piece(w, -w.half, w.half, H - 0.08, H, 0.14, w.at, M.wood, 0.24, 0.32, up(0.9));
      const n = Math.round(len / 0.6);
      for (let i = 0; i <= n; i++) {
        const u = -w.half + 0.03 + (len - 0.06) * i / n;
        if (OPEN[w.key].some(function (o) { return u > o.a + 0.02 && u < o.b - 0.02; })) continue;
        const geo = new T.BoxGeometry(w.along === 'x' ? 0.05 : 0.14, H - 0.16, w.along === 'x' ? 0.14 : 0.05);
        geo.translate(0, (H - 0.16) / 2, 0);
        const m = new T.Mesh(geo, M.wood), p = place(w, u, BASE + 0.08, w.at);
        m.position.set(p[0], p[1], p[2]);
        const t = 0.12 + 0.12 * (si++ % 56) / 56;
        add(m, t, t + 0.08, null, true);
      }
      OPEN[w.key].forEach(function (o) {
        piece(w, o.a, o.b, o.y1, o.y1 + 0.14, 0.14, w.at, M.wood, 0.22, 0.3, up(0.6));
        if (o.y0 > 0.2) piece(w, o.a, o.b, o.y0 - 0.1, o.y0, 0.14, w.at, M.wood, 0.22, 0.3, up(0.6));
        [o.a, o.b].forEach(function (u) { piece(w, u - 0.025, u + 0.025, 0.08, H - 0.08, 0.14, w.at, M.wood, 0.18, 0.26, up(0.6)); });
      });
    });

    // 3. стропила опускаются сверху
    const EAVE = hz + 0.45, slope = (RIDGE - TOP) / hz, eaveY = RIDGE - EAVE * slope;
    const rLen = Math.sqrt(EAVE * EAVE + (RIDGE - eaveY) * (RIDGE - eaveY)), ang = Math.atan2(RIDGE - eaveY, EAVE);
    const nT = 15;
    for (let i = 0; i < nT; i++) {
      const x = -hx - 0.3 + (L + 0.6) * i / (nT - 1), t = 0.28 + 0.1 * i / nT;
      [1, -1].forEach(function (s) {
        const r = box(0.05, 0.18, rLen, M.rafter, x, (RIDGE + eaveY) / 2, s * EAVE / 2);
        r.rotation.x = s * ang;
        add(r, t, t + 0.08, up(2.8));
      });
      if (x > -hx && x < hx) {
        add(box(0.05, 0.14, D, M.rafter, x, TOP + 0.07, 0), t, t + 0.08, up(2.8));
        add(box(0.05, RIDGE - TOP - 0.3, 0.1, M.rafter, x, (RIDGE + TOP) / 2 - 0.05, 0), t, t + 0.08, up(2.8));
      }
    }
    add(box(L + 0.6, 0.2, 0.06, M.rafter, 0, RIDGE - 0.1, 0), 0.36, 0.44, up(2.8));

    // 4. утеплитель встаёт между стойками, затем обшивка, окна и дверь подъезжают снаружи
    WALLS.forEach(function (w, wi) {
      const s = sign(w), from = w.n.clone().multiplyScalar(2.8);
      const tI = 0.43 + wi * 0.02;
      wallLayer(w, w.half - 0.02, 0.1, w.at, M.ins, tI, tI + 0.08, w.n.clone().multiplyScalar(-1.2));

      const at = w.at + s * 0.13, half = w.half + (w.along === 'x' ? 0.13 : 0.14), t0 = 0.53 + wi * 0.04, t1 = t0 + 0.12;
      const m = w.key === 'front' ? M.wall : (w.along === 'x' ? M.wall : M.wall);
      wallLayer(w, half, 0.12, at, m, t0, t1, from);
      // тёмная вставка у входа
      if (w.key === 'front') piece(w, 0.2, 1.7, 0, H, 0.03, at + s * 0.07, M.navy, t0 + 0.02, t1 + 0.02, from);

      OPEN[w.key].forEach(function (o) {
        const tw = t0 + 0.06, tw1 = t1 + 0.06, fa = at + s * 0.05;
        if (o.door) {
          piece(w, o.a, o.b, 0, o.y1, 0.07, fa + s * 0.03, M.door, tw, tw1, from);
          piece(w, o.a + 0.22, o.b - 0.22, 1.25, 1.95, 0.03, fa + s * 0.075, M.glass, tw, tw1, from);
          piece(w, o.b - 0.2, o.b - 0.13, 0.95, 1.2, 0.04, fa + s * 0.09, M.trim, tw, tw1, from);
          return;
        }
        piece(w, o.a + 0.04, o.b - 0.04, o.y0 + 0.04, o.y1 - 0.04, 0.03, at, M.glass, tw, tw1, from);
        const fw = 0.08, fd = 0.16;
        piece(w, o.a - fw, o.b + fw, o.y1, o.y1 + fw, fd, fa, M.frame, tw, tw1, from);
        piece(w, o.a - fw, o.b + fw, o.y0 - fw, o.y0, fd + 0.06, fa + s * 0.03, M.frame, tw, tw1, from);
        piece(w, o.a - fw, o.a, o.y0, o.y1, fd, fa, M.frame, tw, tw1, from);
        piece(w, o.b, o.b + fw, o.y0, o.y1, fd, fa, M.frame, tw, tw1, from);
        for (let i = 1; i <= o.bars; i++) {
          const u = o.a + (o.b - o.a) * i / (o.bars + 1);
          piece(w, u - 0.025, u + 0.025, o.y0, o.y1, 0.1, fa, M.frame, tw, tw1, from);
        }
      });

      // фронтоны на торцах
      if (w.along === 'z') {
        const sh = new T.Shape();
        sh.moveTo(-hz - 0.13, 0); sh.lineTo(hz + 0.13, 0); sh.lineTo(0, RIDGE - TOP - 0.03); sh.closePath();
        const g = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), M.navy);
        const uv = g.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4);
        g.rotation.y = Math.PI / 2;
        g.position.set(at - 0.06, TOP, 0);
        add(g, t0 + 0.04, t1 + 0.04, from);
      }
    });
    // белый пояс под кровлей и цоколь
    WALLS.forEach(function (w) {
      const s = sign(w), at = w.at + s * 0.2, half = w.half + 0.2;
      piece(w, -half, half, H - 0.14, H + 0.04, 0.04, at, M.trim, 0.68, 0.76, up(0.5));
      piece(w, -half, half, -0.1, 0.06, 0.04, at, M.frame, 0.66, 0.74, up(-0.4));
    });

    // 5. кровля с фальцем ложится последней
    [1, -1].forEach(function (s, k) {
      const off = 0.17;
      const r = box(L + 1.0, 0.07, rLen + 0.14, M.roof,
        0, (RIDGE + eaveY) / 2 + off * Math.cos(ang), s * (EAVE / 2 + off * Math.sin(ang)), 2.2);
      r.rotation.x = s * ang;
      add(r, 0.75 + k * 0.05, 0.89 + k * 0.04, up(3.6));
      // лобовая доска и водосток
      add(box(L + 1.0, 0.2, 0.05, M.trim, 0, eaveY + 0.1, s * (EAVE + 0.04)), 0.86, 0.93, up(1.2));
      const gut = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, L + 1.0, 14), M.frame);
      gut.rotation.z = Math.PI / 2;
      gut.position.set(0, eaveY + 0.06, s * (EAVE + 0.12));
      add(gut, 0.88, 0.95, up(1.2));
      const pipe = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, eaveY - 0.1, 12), M.frame);
      pipe.position.set(hx + 0.28, (eaveY + 0.1) / 2, s * (hz + 0.22));
      add(pipe, 0.9, 0.97, up(-1));
    });
    add(box(L + 1.0, 0.1, 0.34, M.frame, 0, RIDGE + 0.17, 0), 0.9, 0.96, up(2));
    add(box(0.45, 1.0, 0.45, M.trim, -2.2, RIDGE - 0.35, -1.3), 0.9, 0.97, up(2.4));
    add(box(0.58, 0.08, 0.58, M.frame, -2.2, RIDGE + 0.19, -1.3), 0.92, 0.98, up(2.4));

    // 6. терраса, ступени и козырёк над входом
    const tz = hz + 0.2;
    add(box(3.4, 0.1, 1.5, M.deck, 0.95, BASE - 0.13, tz + 0.75, 5), 0.8, 0.88, new T.Vector3(0, 0, 2.4));
    [[-0.65, tz + 1.42], [2.55, tz + 1.42]].forEach(function (c) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 14), M.steel);
      leg.position.set(c[0], 0.3, c[1]);
      add(leg, 0.8, 0.88, new T.Vector3(0, 0, 2.4));
      add(box(0.09, 2.25, 0.09, M.trim, c[0], BASE + 1.05, c[1]), 0.86, 0.93, up(-1.4), true);
    });
    add(box(1.5, 0.1, 0.4, M.deck, 0.95, 0.42, tz + 1.72, 5), 0.83, 0.9, new T.Vector3(0, 0, 2.4));
    add(box(1.5, 0.1, 0.4, M.deck, 0.95, 0.2, tz + 2.1, 5), 0.85, 0.92, new T.Vector3(0, 0, 2.4));
    add(box(3.6, 0.07, 1.7, M.frame, 0.95, BASE + 2.45, tz + 0.72), 0.9, 0.97, up(1.6));
    // перила террасы
    add(box(0.05, 0.05, 1.3, M.frame, -0.65, BASE + 0.85, tz + 0.75), 0.92, 0.98, up(0.8));
    for (let i = 0; i < 5; i++) add(box(0.03, 0.8, 0.03, M.frame, -0.65, BASE + 0.42, tz + 0.2 + i * 0.28), 0.92, 0.98, up(0.8));

    // материалы → этапы, чтобы плавно проявлять
    const fades = [
      [M.wood, 0.02, 0.1], [M.deck, 0.07, 0.13], [M.rafter, 0.28, 0.36], [M.ins, 0.43, 0.5],
      [M.wall, 0.53, 0.62], [M.navy, 0.55, 0.66], [M.frame, 0.6, 0.7], [M.door, 0.6, 0.7],
      [M.glass, 0.62, 0.74], [M.trim, 0.66, 0.74], [M.roof, 0.75, 0.84]
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

    let mx = 0, my = 0;   // лёгкий поворот за курсором
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
      world.rotation.y = -0.95 + p * 1.55 + mx * 0.14;
      const r = 24 * Math.max(1, 1.25 / camera.aspect), elev = 0.4 - p * 0.1 + my * 0.05;
      camera.position.set(0, 2.2 + r * Math.sin(elev), r * Math.cos(elev));
      camera.lookAt(0, 1.9, 0);
      renderer.render(scene, camera);
    }

    let target = 0, cur = 0, raf = 0, tmx = 0, tmy = 0;
    function loop() {
      raf = 0;
      cur += (target - cur) * 0.14;
      mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      draw(cur);
      if (cur !== target || Math.abs(tmx - mx) > 0.002 || Math.abs(tmy - my) > 0.002) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    resize();
    draw(0);
    window.addEventListener('resize', function () { resize(); draw(cur); });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      tmx = e.clientX / window.innerWidth - 0.5;
      tmy = e.clientY / window.innerHeight - 0.5;
      kick();
    }, { passive: true });

    return {
      set: function (p) { target = clamp(p); kick(); },
      jump: function (p) { target = cur = clamp(p); resize(); draw(cur); }
    };
  }

  window.House3D = { init: init };
})();
