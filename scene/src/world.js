import * as THREE from 'three';
import { createDancer, mat, gold } from './dancer.js';
import { mulberry32 } from './util.js';

function canvasTexture(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function catenary(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(
      a.x + (b.x - a.x) * u,
      a.y + (b.y - a.y) * u - sag * Math.sin(Math.PI * u),
      a.z + (b.z - a.z) * u,
    ));
  }
  return pts;
}

export function buildWorld(scene, seed = 3) {
  const rng = mulberry32(seed);
  const r = (a, b) => a + (b - a) * rng();

  // Sky: dusk gradient on a big inverted sphere, plus stars.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#0e1238') },
        mid: { value: new THREE.Color('#5b2f6e') },
        low: { value: new THREE.Color('#ff8a4c') },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(low, mid, smoothstep(-0.02, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.5, h)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  scene.add(sky);
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const th = r(0, Math.PI * 2), y = r(0.18, 1);
    const s = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(th) * s * 200, y * 200, Math.sin(th) * s * 200);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff4dc', size: 1.6, sizeAttenuation: false, fog: false })));

  scene.fog = new THREE.Fog('#3b2a4f', 30, 95);

  // Lights: cool sky fill, warm key from the string lights' side, blue rim.
  scene.add(new THREE.HemisphereLight('#8a86d6', '#4a3020', 0.75));
  const key = new THREE.DirectionalLight('#ffc48c', 1.9);
  key.position.set(5, 11, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7f8cff', 1.2);
  rim.position.set(-6, 7, -10);
  scene.add(rim);
  const warm = new THREE.PointLight('#ffb36b', 40, 18, 2);
  warm.position.set(0, 5, -2);
  scene.add(warm);

  // Ground and the stone square.
  const groundTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#8a6a48';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r(40, 90) | 0},${r(30, 60) | 0},${r(15, 35) | 0},${r(0.05, 0.18)})`;
      g.beginPath();
      g.arc(r(0, w), r(0, h), r(2, 14), 0, Math.PI * 2);
      g.fill();
    }
  }, 14);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const stoneTex = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b89c78';
    g.fillRect(0, 0, w, h);
    const cell = 64;
    for (let y = 0; y < h; y += cell / 2) {
      const off = (y / (cell / 2)) % 2 ? cell / 2 : 0;
      for (let x = -cell; x < w; x += cell) {
        const v = r(-18, 18);
        g.fillStyle = `rgb(${190 + v | 0},${163 + v | 0},${126 + v | 0})`;
        g.fillRect(x + off + 2, y + 2, cell - 4, cell / 2 - 4);
      }
    }
    g.fillStyle = 'rgba(60,40,20,0.08)';
    for (let i = 0; i < 900; i++) g.fillRect(r(0, w), r(0, h), r(2, 10), r(2, 10));
  }, 3);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.4, 72), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.01;
  plaza.receiveShadow = true;
  scene.add(plaza);
  const border = new THREE.Mesh(new THREE.RingGeometry(6.4, 6.85, 72), mat('#6f5a44', { roughness: 0.95 }));
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0.015;
  border.receiveShadow = true;
  scene.add(border);

  // Village houses around the back of the square, facing it.
  const houses = [
    [-9.5, -9, 4.2, 3.4, 3.4], [-4.8, -12.5, 4.8, 3.6, 4.1], [0.6, -13.6, 5.4, 3.8, 3.6],
    [6, -12.2, 4.4, 3.4, 4.4], [10.2, -8.4, 4.0, 3.2, 3.3], [-13.5, -3.5, 3.8, 3.2, 3.1], [14, -2.5, 3.8, 3.2, 3.2],
  ];
  const walls = ['#d9c7a8', '#cdb994', '#dccbb0', '#c9b28f', '#bfae93'];
  const roofMat = mat('#a4492d', { roughness: 0.85 });
  const winMat = new THREE.MeshStandardMaterial({ color: '#ffd38a', emissive: '#ffb347', emissiveIntensity: 2.6 });
  const doorMat = mat('#4b2e1c');
  for (const [x, z, w, d, h] of houses) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.lookAt(0, 0, 0);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(walls[Math.floor(rng() * walls.length)]));
    wall.position.y = h / 2;
    wall.castShadow = wall.receiveShadow = true;
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w * 0.78, 1.5, d * 0.78);
    roof.position.y = h + 0.75;
    roof.castShadow = true;
    g.add(roof);
    const nWin = Math.max(2, Math.round(w / 1.6));
    for (let i = 0; i < nWin; i++) {
      const wx = -w / 2 + (w / (nWin + 1)) * (i + 1);
      if (Math.abs(wx) < 0.5) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), winMat);
      win.position.set(wx, h * 0.62, d / 2 + 0.01);
      g.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), doorMat);
    door.position.set(0, 0.8, d / 2 + 0.01);
    g.add(door);
    scene.add(g);
  }

  // Trees: a big plane tree and some poplars.
  const trunkMat = mat('#5b3b26');
  const leafMat = mat('#2f5d3a', { flatShading: true });
  const poplarMat = mat('#365f3a', { flatShading: true });
  const plane = new THREE.Group();
  plane.position.set(-8.5, 0, -4.5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 3.6, 10), trunkMat);
  trunk.position.y = 1.8;
  trunk.castShadow = true;
  plane.add(trunk);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r(1.3, 1.9), 1), leafMat);
    s.position.set(r(-1.4, 1.4), r(3.8, 5.4), r(-1.2, 1.2));
    s.castShadow = true;
    plane.add(s);
  }
  scene.add(plane);
  for (const [x, z] of [[-11.5, -11], [3.5, -16.5], [-2, -16], [12.5, -11.5], [8.5, -15]]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.75, 6.5, 8), poplarMat);
    p.position.set(x, 3.4, z);
    p.castShadow = true;
    scene.add(p);
  }

  // Hills on the horizon.
  const hillMat = new THREE.MeshBasicMaterial({ color: '#3a2a52', fog: false });
  for (let i = 0; i < 11; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(r(22, 38), r(5, 11), r(10, 16));
    hill.position.set(-110 + i * 22 + r(-6, 6), 0, -120 + r(-10, 10));
    scene.add(hill);
  }

  // Poles, string lights and bunting over the square.
  const poleMat = mat('#4a3424');
  const poles = [[-7.2, -3], [7.2, -3], [-7.8, -7.5], [7.8, -7.5]];
  for (const [x, z] of poles) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 8), poleMat);
    p.position.set(x, 2.7, z);
    p.castShadow = true;
    scene.add(p);
  }
  const bulbGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffc061', emissiveIntensity: 5 });
  const strands = [
    catenary(new THREE.Vector3(-7.2, 5.2, -3), new THREE.Vector3(7.2, 5.2, -3), 1.2, 40),
    catenary(new THREE.Vector3(-7.8, 5.3, -7.5), new THREE.Vector3(7.8, 5.3, -7.5), 1.4, 44),
    catenary(new THREE.Vector3(-7.2, 5.2, -3), new THREE.Vector3(7.8, 5.3, -7.5), 1.3, 40),
    catenary(new THREE.Vector3(7.2, 5.2, -3), new THREE.Vector3(-7.8, 5.3, -7.5), 1.3, 40),
  ];
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, strands.reduce((n, s) => n + s.length, 0));
  let bi = 0;
  const m4 = new THREE.Matrix4();
  for (const s of strands) {
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(s), new THREE.LineBasicMaterial({ color: '#1b1410' })));
    for (const p of s) bulbs.setMatrixAt(bi++, m4.makeTranslation(p.x, p.y - 0.09, p.z));
  }
  scene.add(bulbs);

  const flagColors = ['#d62839', '#f4f1ea', '#f2a541', '#2a9d8f', '#e76f51', '#3d5a80'];
  const triShape = new THREE.Shape([new THREE.Vector2(-0.16, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, -0.34)]);
  const triGeo = new THREE.ShapeGeometry(triShape);
  const bunt = catenary(new THREE.Vector3(-7.2, 4.6, -3), new THREE.Vector3(7.2, 4.6, -3), 0.9, 30);
  const buntMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  const flags = new THREE.InstancedMesh(triGeo, buntMat, bunt.length);
  const c = new THREE.Color();
  bunt.forEach((p, i) => {
    flags.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    flags.setColorAt(i, c.set(flagColors[i % flagColors.length]));
  });
  flags.instanceColor.needsUpdate = true;
  scene.add(flags);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bunt), new THREE.LineBasicMaterial({ color: '#2a2018' })));

  // Musicians in the middle of the circle: davul and zurna.
  const mrng = mulberry32(seed + 99);
  const davulcu = createDancer(mrng, { female: false, localArms: true });
  davulcu.root.position.set(-0.45, 0, 0.1);
  davulcu.root.rotation.y = 0.35;
  const drum = new THREE.Group();
  drum.position.set(0, 0.3, 0.33);
  davulcu.torso.add(drum);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 28, 1, true), mat('#a63a24', { side: THREE.DoubleSide }));
  shell.rotation.z = Math.PI / 2;
  shell.castShadow = true;
  drum.add(shell);
  for (const sx of [-0.165, 0.165]) {
    const skin = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), mat('#efe2c4', { side: THREE.DoubleSide }));
    skin.rotation.y = Math.PI / 2;
    skin.position.x = sx;
    drum.add(skin);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 28), gold());
    rimRing.rotation.y = Math.PI / 2;
    rimRing.position.x = sx;
    drum.add(rimRing);
  }
  const mallet = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), mat('#6b4423'));
  stick.position.y = -0.21;
  mallet.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#3b2416'));
  ball.position.y = -0.43;
  mallet.add(ball);
  mallet.position.y = -0.6;
  davulcu.armR.add(mallet);
  const switchStick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 5), mat('#c8a86b'));
  switchStick.position.y = -0.82;
  davulcu.armL.add(switchStick);
  scene.add(davulcu.root);

  const zurnaci = createDancer(mrng, { female: false, localArms: true });
  zurnaci.root.position.set(0.5, 0, 0.05);
  zurnaci.root.rotation.y = -0.4;
  const zurna = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.52, 14, 1, true), mat('#7a4520', { side: THREE.DoubleSide }));
  zurna.position.set(0, -0.2, 0.32);
  zurna.rotation.x = Math.PI - 0.95;
  zurnaci.head.add(zurna);
  const bell = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), gold());
  bell.position.set(0, -0.36, 0.5);
  bell.rotation.x = 0.6;
  zurnaci.head.add(bell);
  for (const sx of [-0.09, 0.09]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(zurnaci.skin));
    cheek.position.set(sx, -0.05, 0.11);
    zurnaci.head.add(cheek);
  }
  scene.add(zurnaci.root);

  const drummerRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), new THREE.MeshStandardMaterial({ color: '#ffcf5a', emissive: '#ffb020', emissiveIntensity: 3 }));
  drummerRing.rotation.x = Math.PI / 2;
  drummerRing.position.set(-0.45, 0.05, 0.1);
  drummerRing.visible = false;
  scene.add(drummerRing);

  return {
    davulcu, zurnaci, drummerRing, bulbs, bulbMat,
    update(time, beat, energy, drummerOn) {
      const f = beat - Math.floor(beat);
      // Mallet strikes on every beat, the thin stick on the off-beats.
      const strike = Math.exp(-f * 9);
      davulcu.armR.rotation.set(-1.15 + 0.75 * strike, 0, -0.35);
      const half = (f * 2) % 1;
      davulcu.armL.rotation.set(-1.1 + 0.4 * Math.exp(-half * 10), 0, 0.5);
      davulcu.body.position.y = -0.03 * strike;
      davulcu.head.rotation.x = -0.05 + 0.08 * strike;
      davulcu.legL.rotation.x = 0;
      zurnaci.armL.rotation.set(-1.25, 0, -0.35);
      zurnaci.armR.rotation.set(-1.15, 0, 0.35);
      zurnaci.torso.rotation.z = 0.08 * Math.sin(beat * Math.PI);
      zurnaci.torso.rotation.x = 0.05 + 0.04 * Math.sin(beat * Math.PI * 2) * (1 + energy);
      zurnaci.body.position.y = -0.03 * (0.5 + 0.5 * Math.cos(2 * Math.PI * f));
      drummerRing.visible = drummerOn;
      drummerRing.rotation.z = time * 1.4;
      bulbMat.emissiveIntensity = 4.6 + 0.6 * Math.sin(time * 2.1);
    },
  };
}
