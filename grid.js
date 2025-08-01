// Cylindrical tunnel with square-ish grid and snake
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

// Raycaster and mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});

// Tunnel params
const params = {
  radius: 10,
  length: 60,
  radialSegs: 24,
  heightSegs: 60,
  spacingZ: 1.25,
  hoverDistance: 0.5,
};

const baseColor = 0xffffff;
const hoverColor = 0xff4444;
const gridLines = [];

// Generate cylindrical grid
function createTunnel() {
  for (let h = 0; h <= params.heightSegs; h++) {
    const z = -h * params.spacingZ;
    for (let i = 0; i < params.radialSegs; i++) {
      const a1 = (i / params.radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / params.radialSegs) * Math.PI * 2;
      const p1 = new THREE.Vector3(Math.cos(a1) * params.radius, Math.sin(a1) * params.radius, z);
      const p2 = new THREE.Vector3(Math.cos(a2) * params.radius, Math.sin(a2) * params.radius, z);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 }));
      scene.add(line);
      gridLines.push({ line, p1, p2 });
    }
  }

  for (let i = 0; i < params.radialSegs; i++) {
    const a = (i / params.radialSegs) * Math.PI * 2;
    const x = Math.cos(a) * params.radius;
    const y = Math.sin(a) * params.radius;
    for (let h = 0; h < params.heightSegs; h++) {
      const z1 = -h * params.spacingZ;
      const z2 = -(h + 1) * params.spacingZ;
      const p1 = new THREE.Vector3(x, y, z1);
      const p2 = new THREE.Vector3(x, y, z2);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 }));
      scene.add(line);
      gridLines.push({ line, p1, p2 });
    }
  }
}

createTunnel();

// Snake line
const snakePoints = [];
const snakeLength = 30;
const snakeGeom = new THREE.BufferGeometry();
const snakeMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
const snake = new THREE.Line(snakeGeom, snakeMat);
scene.add(snake);

function getClosestDistance(ray, p1, p2) {
  const segmentDir = new THREE.Vector3().subVectors(p2, p1);
  const segLen = segmentDir.length();
  segmentDir.normalize();
  const w0 = new THREE.Vector3().subVectors(p1, ray.origin);
  const a = ray.direction.dot(ray.direction);
  const b = ray.direction.dot(segmentDir);
  const c = segmentDir.dot(segmentDir);
  const d = ray.direction.dot(w0);
  const e = segmentDir.dot(w0);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-5) return Infinity;
  let s = (b * e - c * d) / denom;
  let t = (a * e - b * d) / denom;
  s = Math.max(0, s);
  t = Math.max(0, Math.min(t, segLen));
  const cpRay = ray.origin.clone().add(ray.direction.clone().multiplyScalar(s));
  const cpSeg = p1.clone().add(segmentDir.multiplyScalar(t));
  return cpRay.distanceTo(cpSeg);
}

function resizeRenderer() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

let zSnake = 0;

function animate() {
  requestAnimationFrame(animate);
  resizeRenderer();

  raycaster.setFromCamera(mouse, camera);
  const ray = raycaster.ray;

  gridLines.forEach(({ line, p1, p2 }) => {
    const dist = getClosestDistance(ray, p1, p2);
    const mat = line.material;
    if (dist < params.hoverDistance) {
      mat.opacity = 0.9;
      mat.color.set(hoverColor);
    } else {
      mat.opacity = 0.2;
      mat.color.set(baseColor);
    }
  });

  const r = params.radius * 0.5;
  const angle = mouse.x * Math.PI;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r;
  const z = zSnake;
  snakePoints.push(new THREE.Vector3(x, y, z));
  if (snakePoints.length > snakeLength) snakePoints.shift();
  snakeGeom.setFromPoints(snakePoints);
  zSnake -= 0.2;

  renderer.render(scene, camera);
}

animate();
