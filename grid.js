import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tunnel grid config
const params = {
  radius: 8,
  length: 60,
  radialSegs: 16,
  heightSegs: 40,
  rotationSpeed: 0.002,
};

const tunnelGroup = new THREE.Group();
scene.add(tunnelGroup);

const baseColor = 0xffffff;
const tunnelLines = [];
const gridPoints = []; // 2D array [radial][depth]

// 1. BUILD TUNNEL GRID
for (let j = 0; j <= params.heightSegs; j++) {
  const z = (j / params.heightSegs) * params.length - params.length / 2;
  const ring = [];
  for (let i = 0; i < params.radialSegs; i++) {
    const angle = (i / params.radialSegs) * Math.PI * 2;
    const x = Math.cos(angle) * params.radius;
    const y = Math.sin(angle) * params.radius;
    const pt = new THREE.Vector3(x, y, z);
    ring.push(pt);

    // Vertical lines
    if (j < params.heightSegs) {
      const nextZ = ((j + 1) / params.heightSegs) * params.length - params.length / 2;
      const pt2 = new THREE.Vector3(x, y, nextZ);
      const geom = new THREE.BufferGeometry().setFromPoints([pt, pt2]);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 }));
      tunnelGroup.add(line);
      tunnelLines.push(line);
    }

    // Horizontal ring segments
    const nextI = (i + 1) % params.radialSegs;
    const nextAngle = (nextI / params.radialSegs) * Math.PI * 2;
    const pt2 = new THREE.Vector3(Math.cos(nextAngle) * params.radius, Math.sin(nextAngle) * params.radius, z);
    const geom = new THREE.BufferGeometry().setFromPoints([pt, pt2]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 }));
    tunnelGroup.add(line);
    tunnelLines.push(line);
  }
  gridPoints.push(ring);
}

// 2. BUILD SNAKE LINE
let snakeTrail = [];
const snakeLength = 20;
const snakeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
const snakeGeometry = new THREE.BufferGeometry();
const snakeLine = new THREE.Line(snakeGeometry, snakeMaterial);
scene.add(snakeLine);

// 3. INIT SNAKE POSITION IN GRID
let snakeI = Math.floor(params.radialSegs / 2);
let snakeJ = 0;
snakeTrail = [gridPoints[snakeJ][snakeI].clone()];
snakeGeometry.setFromPoints(snakeTrail);

// 4. HANDLE MOUSE INPUT
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});

// 5. ANIMATE SNAKE ON GRID
function updateSnake() {
  // Move forward in Z (increase j)
  let nextJ = snakeJ + 1;
  if (nextJ >= gridPoints.length) {
    nextJ = 0;
    snakeTrail = [];
  }

  // Left/right control
  const direction = mouse.x > 0.2 ? 1 : mouse.x < -0.2 ? -1 : 0;
  let nextI = (snakeI + direction + params.radialSegs) % params.radialSegs;

  const nextPoint = gridPoints[nextJ][nextI].clone();
  snakeTrail.push(nextPoint);
  if (snakeTrail.length > snakeLength) snakeTrail.shift();

  snakeGeometry.setFromPoints(snakeTrail);

  snakeI = nextI;
  snakeJ = nextJ;
}

// 6. HANDLE RESIZE
function resizeRendererToCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

// 7. MAIN LOOP
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();
  updateSnake();
  tunnelGroup.rotation.z += params.rotationSpeed;
  renderer.render(scene, camera);
}

animate();
