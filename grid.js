import * as THREE from 'three';

// Canvas + renderer
const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 8, 4);
camera.lookAt(0, 0, 0);

// Tunnel config
const params = {
  radius: 10,
  length: 60,
  radialSegs: 32,
  heightSegs: 40,
  rotationSpeed: 0.002,
};

const tunnelLines = [];
const baseColor = 0xffffff;
const hoverColor = 0xff4444;

// Create tunnel lines
function createTunnelLines() {
  for (let h = 0; h <= params.heightSegs; h++) {
    const z = (h / params.heightSegs) * params.length - params.length / 2;
    for (let i = 0; i < params.radialSegs; i++) {
      const a1 = (i / params.radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / params.radialSegs) * Math.PI * 2;
      const p1 = new THREE.Vector3(Math.cos(a1) * params.radius, Math.sin(a1) * params.radius, z);
      const p2 = new THREE.Vector3(Math.cos(a2) * params.radius, Math.sin(a2) * params.radius, z);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(geom, mat);
      tunnelLines.push({ line, p1, p2, highlightIntensity: 0 });
      scene.add(line);
    }
  }

  for (let i = 0; i < params.radialSegs; i++) {
    const angle = (i / params.radialSegs) * Math.PI * 2;
    const x = Math.cos(angle) * params.radius;
    const y = Math.sin(angle) * params.radius;
    for (let h = 0; h < params.heightSegs; h++) {
      const z1 = (h / params.heightSegs) * params.length - params.length / 2;
      const z2 = ((h + 1) / params.heightSegs) * params.length - params.length / 2;
      const p1 = new THREE.Vector3(x, y, z1);
      const p2 = new THREE.Vector3(x, y, z2);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(geom, mat);
      tunnelLines.push({ line, p1, p2, highlightIntensity: 0 });
      scene.add(line);
    }
  }
}
createTunnelLines();

// Resize
function resizeRendererToCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

// Mouse tracking
const mouse = new THREE.Vector2();
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Distance helper
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const closestX = x1 + clampedT * dx;
  const closestY = y1 + clampedT * dy;
  return Math.hypot(px - closestX, py - closestY);
}

// Scroll direction tracking
let scrollDirection = 1;
let currentDirection = 1;

window.addEventListener('wheel', (event) => {
  scrollDirection = event.deltaY > 0 ? 1 : -1;
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  // Smoothly interpolate rotation direction
  currentDirection += (scrollDirection - currentDirection) * 0.05;

  const mouseScreen = new THREE.Vector2(
    (mouse.x * 0.5 + 0.5) * canvas.width,
    (-(mouse.y * 0.5 - 0.5)) * canvas.height
  );

  tunnelLines.forEach((tunnel) => {
    const { line, p1, p2 } = tunnel;

    // Apply rotation matrix to line endpoints
    const start = p1.clone().applyMatrix4(line.matrixWorld).project(camera);
    const end = p2.clone().applyMatrix4(line.matrixWorld).project(camera);

    const x1 = (start.x * 0.5 + 0.5) * canvas.width;
    const y1 = (-(start.y * 0.5 - 0.5)) * canvas.height;
    const x2 = (end.x * 0.5 + 0.5) * canvas.width;
    const y2 = (-(end.y * 0.5 - 0.5)) * canvas.height;

    const dist = pointToSegmentDistance(mouseScreen.x, mouseScreen.y, x1, y1, x2, y2);
    if (dist < 20) tunnel.highlightIntensity = 1;

    tunnel.highlightIntensity *= 0.92;

    const color = new THREE.Color(baseColor).lerp(new THREE.Color(hoverColor), tunnel.highlightIntensity);
    line.material.color.copy(color);
    line.material.opacity = 0.3 + 0.7 * tunnel.highlightIntensity;

    // Scroll-reactive rotation
    line.rotation.z += params.rotationSpeed * currentDirection;
  });

  renderer.render(scene, camera);
}
animate();
