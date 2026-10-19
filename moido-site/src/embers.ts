import { AdditiveBlending, BufferAttribute, BufferGeometry, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from "three";

/** Brasas 3D: partículas que sobem devagar, aceleram com o scroll e seguem um pouco o mouse. */
export function startEmbers(canvas: HTMLCanvasElement, getBoost: () => number) {
  const small = window.matchMedia("(max-width: 767px)").matches;
  const COUNT = small ? 110 : 260;

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 10;

  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 4); // velocidade, fase, tamanho, calor
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    seed[i * 4] = 0.25 + Math.random() * 0.6;
    seed[i * 4 + 1] = Math.random() * Math.PI * 2;
    seed[i * 4 + 2] = 0.6 + Math.random() * 1.6;
    seed[i * 4 + 3] = Math.random();
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("seed", new BufferAttribute(seed, 4));

  const uniforms = {
    uTime: { value: 0 },
    uRise: { value: 0 },
    uPx: { value: renderer.getPixelRatio() },
    uOpacity: { value: 1 },
  };
  const mat = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime; uniform float uRise; uniform float uPx;
      varying float vHeat; varying float vLife;
      void main() {
        vec3 p = position;
        float h = 14.0;
        float y = mod(p.y + h * 0.5 + uRise * seed.x, h);
        vLife = y / h;
        p.y = y - h * 0.5;
        p.x += sin(uTime * 0.6 + seed.y) * 0.35 + sin(uTime * 0.23 + seed.y * 3.0) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float flicker = 0.75 + 0.25 * sin(uTime * 4.0 + seed.y * 11.0);
        gl_PointSize = seed.z * 9.0 * uPx * flicker * (10.0 / -mv.z);
        vHeat = seed.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vHeat; varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(1.0, 0.35, 0.12), vec3(1.0, 0.75, 0.35), vHeat);
        float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.3, 0.72, vLife));
        gl_FragColor = vec4(col, a * fade * 0.85 * uOpacity);
      }`,
  });
  scene.add(new Points(geo, mat));

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  let raf = 0;
  let active = true; // false enquanto o site deixa as brasas apagadas (do cardápio ao pedido)
  let last = performance.now();
  let rise = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    rise += dt * (0.6 + Math.min(6, Math.abs(getBoost()) * 0.02));
    uniforms.uTime.value = now / 1000;
    uniforms.uRise.value = rise;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    camera.position.x = mouse.x * 0.6;
    camera.position.y = -mouse.y * 0.4;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  // um laço só: roda com a aba visível e as brasas acesas, para nos outros casos
  const update = () => {
    const run = active && !document.hidden;
    if (run && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  update();
  document.addEventListener("visibilitychange", update);

  return {
    setActive(v: boolean) {
      active = v;
      update();
    },
    setOpacity(v: number) {
      uniforms.uOpacity.value = v;
    },
  };
}
