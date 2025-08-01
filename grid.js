import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();

// ✅ Camera looking into the tunnel
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 8, 4);
camera.lookAt(0, 0, 0);

// Mouse & raycaster setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});

// Tunnel grid config
const params = {
  radius: 8,
  length: 60,
  radialSegs: 16,
  heightSegs: 40,
  rotationSpeed: 0.002,
  hoverDistance: 0.5,
};

const tunnelGroup = new THREE.Group();
scene.add(tunnelGroup);

const baseColor = 0xffffff;
const hoverColor = 0xff4444;
const tunnelLines = [];
const gridPoints = []; // [j][i] = point

// 1. BUILD TUNNEL GRID
for (let j = 0; j <= params.heightSegs; j++) {
  const t = j / params.heightSegs;
  const easedT = Math.pow(t, 1.5); // Makes blocks look more evenly spaced in perspective
  const z = easedT * params.length - params.length / 2;

  const ring = [];
  for (let i = 0; i < params.radialSegs; i++) {
    const angle = (i / params.radialSegs) * Math.PI * 2;
    const x = Math.cos(angle) * params.radius;
    const y = Math.sin(angle) * params.radius;
    const pt = new THREE.Vector3(x, y, z);
    ring.push(pt);

    // Vertical (spokes)
    if (j < params.heightSegs) {
      const t2 = (j + 1) / params.heightSegs;
      const z2 = Math.pow(t2, 1.5) * params.length - params.length / 2;
      const pt2 = new THREE.Vector3(x, y, z2);
      const geom = new THREE.BufferGeometry().setFromPoints([pt, pt2]);
      const mat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 });
      const line = new THREE.Line(geom, mat);
      tunnelGroup.add(line);
      tunnelLines.push({ line, p1: pt, p2: pt2 });
    }

    // Horizontal ring segment
    const nextI = (i + 1) % params.radialSegs;
    const nextAngle = (nextI / params.radialSegs) * Math.PI * 2;
    const pt2 = new THREE.Vector3(Math.cos(nextAngle) * params.radius, Math.sin(nextAngle) * params.radius, z);
    const geom = new THREE.BufferGeometry().setFromPoints([pt, pt2]);
    const mat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 });
    const line = new THREE.Line(geom, mat);
    tunnelGroup.add(line);
    tunnelLines.push({ line, p1: pt, p2: pt2 });
  }
  gridPoints.push(ring);
}

// 2. BUILD SNAKE LINE
let snakeTrail = [];
const snakeLength = 20;
const snakeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const snakeGeometry = new THREE.BufferGeometry();
const snakeLine = new THREE.Line(snakeGeometry, snakeMaterial);
scene.add(snakeLine);

// Init snake position
let snakeI = Math.floor(params.radialSegs / 2);
let snakeJ = 0;
snakeTrail = [gridPoints[snakeJ][snakeI].clone()];
snakeGeometry.setFromPoints(snakeTrail);

// 3. SNAKE MOVEMENT
function updateSnake() {
  let nextJ = snakeJ + 1;
  if (nextJ >= gridPoints.length) {
    nextJ = 0;
    snakeTrail = [];
  }

  const direction = mouse.x > 0.2 ? 1 : mouse.x < -0.2 ? -1 : 0;
  let nextI = (snakeI + direction + params.radialSegs) % params.radialSegs;

  const nextPoint = gridPoints[nextJ][nextI].clone();
  snakeTrail.push(nextPoint);
  if (snakeTrail.length > snakeLength) snakeTrail.shift();

  snakeGeometry.setFromPoints(snakeTrail);

  snakeI = nextI;
  snakeJ = nextJ;
}

// 4. DISTANCE HELPER FOR HOVER
function getClosestDistance(ray, p1, p2) {
  const segmentDir = new THREE.Vector3().subVectors(p2, p1);
  const segmentLength = segmentDir.length();
  segmentDir.normalize();

  const rayDir = ray.direction.clone();
  const w0 = new THREE.Vector3().subVectors(p1, ray.origin);

  const a = rayDir.dot(rayDir);
  const b = rayDir.dot(segmentDir);
  const c = segmentDir.dot(segmentDir);
  const d = rayDir.dot(w0);
  const e = segmentDir.dot(w0);

  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-5) return Infinity;

  let s = (b * e - c * d) / denom;
  let t = (a * e - b * d) / denom;

  s = Math.max(s, 0);
  t = Math.max(0, Math.min(t, segmentLength));

  const closestPointRay = ray.origin.clone().add(rayDir.multiplyScalar(s));
  const closestPointSegment = p1.clone().add(segmentDir.multiplyScalar(t));
  return closestPointRay.distanceTo(closestPointSegment);
}

// 5. RESIZE HANDLER
function resizeRendererToCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

// 6. ANIMATION LOOP
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  raycaster.setFromCamera(mouse, camera);
  const ray = raycaster.ray;

  // Hover effect
  tunnelLines.forEach(({ line, p1, p2 }) => {
    const dist = getClosestDistance(ray, p1, p2);
    const mat = line.material;
    if (dist < params.hoverDistance) {
      mat.opacity = 0.8;
      mat.color.set(hoverColor);
    } else {
      mat.opacity = 0.2;
      mat.color.set(baseColor);
    }
  });

  updateSnake();
  tunnelGroup.rotation.z += params.rotationSpeed;
  renderer.render(scene, camera);
}

animate();
