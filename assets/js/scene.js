// Fundo 3D: peças geométricas neon flutuando sobre um grid retrô.
// Leve de propósito: ~20 malhas, sem texturas, pausa quando a aba some.
import * as THREE from "three";

export function startScene(canvas) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 720px)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: "low-power" });
  } catch {
    return; // sem WebGL: fica o gradiente em CSS
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0817, 0.045);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);

  // Luzes coloridas dão o brilho neon nas faces.
  scene.add(new THREE.AmbientLight(0x6a5acd, 0.6));
  const pink = new THREE.PointLight(0xff4fd8, 60, 30); pink.position.set(-6, 4, 4); scene.add(pink);
  const cyan = new THREE.PointLight(0x3ff0ff, 60, 30); cyan.position.set(6, -2, 5); scene.add(cyan);
  const lime = new THREE.PointLight(0xc6ff3f, 25, 20); lime.position.set(0, 6, -4); scene.add(lime);

  // Peças: um "kit de dados" de mesa + anéis.
  const palette = [0xff4fd8, 0x3ff0ff, 0x8b5cff, 0xc6ff3f, 0xffc34d];
  const geos = [
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.TetrahedronGeometry(0.75, 0),
    new THREE.DodecahedronGeometry(0.65, 0),
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.TorusGeometry(0.55, 0.18, 12, 36),
  ];
  const pieces = [];
  const group = new THREE.Group();
  scene.add(group);
  const count = small ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const geo = geos[i % geos.length];
    const color = palette[i % palette.length];
    const mat = new THREE.MeshStandardMaterial({ color: 0x15102e, emissive: color, emissiveIntensity: 0.12, metalness: 0.4, roughness: 0.35, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 1),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    mesh.add(edges);
    // Espalha mais pelas laterais, deixando o centro do texto respirar.
    const side = i % 2 ? 1 : -1;
    // Quanto mais fundo, mais para fora: assim a perspectiva não puxa as peças para trás do texto.
    const z = -Math.random() * 10 - (small ? 4 : 1.5);
    mesh.position.set(side * ((small ? 2 : 4.5) + Math.random() * 5) * (1 - z * 0.13), (Math.random() - 0.5) * 7, z);
    const s = 0.5 + Math.random() * 0.9;
    mesh.scale.setScalar(s);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    mesh.userData = {
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3),
      bob: Math.random() * Math.PI * 2,
      baseY: mesh.position.y,
    };
    group.add(mesh);
    pieces.push(mesh);
  }

  // Poeira de estrelas.
  const starCount = small ? 500 : 1200;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = (Math.random() - 0.3) * 30;
    pos[i * 3 + 2] = -Math.random() * 40;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfb6ff, size: 0.05, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(stars);

  // Grid do chão, estilo fliperama.
  const grid = new THREE.GridHelper(80, 60, 0xff4fd8, 0x5b3fd1);
  grid.position.y = -4.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  // Interação: o mouse inclina a câmera, a rolagem afunda a cena.
  const target = { x: 0, y: 0 };
  let scrollY = window.scrollY;
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / innerWidth - 0.5) * 2;
    target.y = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

  // Cada voto dá um "pulso" de energia nas peças.
  let energy = 0;
  window.addEventListener("clube:vote", () => { energy = 1; });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  let running = true;
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    energy *= 0.96;
    const boost = 1 + energy * 6;
    for (const m of pieces) {
      const u = m.userData;
      m.rotation.x += u.spin.x * dt * boost;
      m.rotation.y += u.spin.y * dt * boost;
      m.rotation.z += u.spin.z * dt * boost;
      m.position.y = u.baseY + Math.sin(t * 0.6 + u.bob) * 0.35;
      m.material.emissiveIntensity = 0.12 + energy * 0.6;
    }
    stars.rotation.y = t * 0.01;
    grid.position.z = (t * 0.8) % (80 / 60);
    camera.position.x += (target.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (0.6 - target.y * 0.5 - scrollY * 0.0015 - camera.position.y) * 0.04;
    camera.lookAt(0, -scrollY * 0.001, 0);
    group.rotation.y = Math.sin(t * 0.05) * 0.15;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  if (reduce) {
    renderer.render(scene, camera);
    window.addEventListener("resize", () => renderer.render(scene, camera));
  } else {
    requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) { clock.getDelta(); requestAnimationFrame(frame); }
    });
  }
  canvas.classList.add("ready");
}
