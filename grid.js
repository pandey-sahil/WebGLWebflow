import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);

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

// Tunnel parameters
const grid = {
  cols: 10,
  rows: 10,
  depth: 80,
  spacing: 2,
};

const gridLines = [];
const baseColor = 0xffffff;
const hoverColor = 0xff4444;
const group = new THREE.Group();
scene.add(group);

// Build tunnel grid (perfect squares)
for (let z = 0; z < grid.depth; z++) {
  const zPos = -z * grid.spacing;

  // Horizontal lines (X-axis)
  for (let y = 0; y <= grid.rows; y++) {
    const yPos = (y - grid.rows / 2) * grid.spacing;
    const start = new THREE.Vector3(-grid.cols / 2 * grid.spacing, yPos, zPos);
    const end = new THREE.Vector3(grid.cols / 2 * grid.spacing, yPos, zPos);
    const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 }));
    group.add(line);
    gridLines.push({ line, p1: start, p2: end });
  }

  // Vertical lines (Y-axis)
  for (let x = 0; x <= grid.cols; x++) {
    const xPos = (x - grid.cols / 2) * grid.spacing;
    const start = new THREE.Vector3(xPos, -grid.rows / 2 * grid.spacing, zPos);
    const end = new THREE.Vector3(xPos, grid.rows / 2 * grid.spacing, zPos);
    const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 }));
    group.add(line);
    gridLines.push({ line, p1: start, p2: end });
  }
}

// Snake trail
const snakeTrail = [];
const snakeLength = 20;
const snakeGeom = new THREE.BufferGeometry();
const snakeMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
const snakeLine = new THREE.Line(snakeGeom, snakeMat);
scene.add(snakeLine);

let snakeX = 0;
let snakeY = 0;
let snakeZ = 0;
let direction = 1;

// Raycaster setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Distance helper
function getClosestDistance(ray, p1, p2) {
  const segmentDir = new THREE.Vector3().subVectors(p2, p1);
  const segmentLength = segmentDir.length();
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
  t = Math.max(0, Math.min(t, segmentLength));

  const closestPointRay = ray.origin.clone().add(ray.direction.clone().multiplyScalar(s));
  const closestPointSegment = p1.clone().add(segmentDir.multiplyScalar(t));
  return closestPointRay.distanceTo(closestPointSegment);
}

// Animate loop
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);
  const ray = raycaster.ray;

  // Hover detection
  gridLines.forEach(({ line, p1, p2 }) => {
    const dist = getClosestDistance(ray, p1, p2);
    const mat = line.material;
    if (dist < 0.5) {
      mat.opacity = 0.9;
      mat.color.set(hoverColor);
    } else {
      mat.opacity = 0.2;
      mat.color.set(baseColor);
    }
  });

  // Snake movement
  snakeZ -= 0.2;
  const newPoint = new THREE.Vector3(snakeX, snakeY, snakeZ);
  snakeTrail.push(newPoint);
  if (snakeTrail.length > snakeLength) snakeTrail.shift();
  snakeGeom.setFromPoints(snakeTrail);

  renderer.render(scene, camera);
}

animate();
