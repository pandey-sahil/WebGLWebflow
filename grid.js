import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Canvas + renderer
const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 8, 4);
camera.lookAt(0, 0, 0);

// Raycaster setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tunnel config
const params = {
  radius: 10,
  length: 60,
  radialSegs: 12,     // bigger blocks
  heightSegs: 20,     // bigger blocks
  rotationSpeed: 0.002,
  hoverDistance: 0.5,
};

const tunnelLines = [];
const baseColor = 0xffffff;
const hoverColor = 0xff4444;

// Tunnel group for rotation
const tunnelGroup = new THREE.Group();
scene.add(tunnelGroup);

// Create tunnel wires
function createTunnelLines() {
  // Rings (horizontal)
  for (let h = 0; h <= params.heightSegs; h++) {
    const z = (h / params.heightSegs) * params.length - params.length / 2;
    for (let i = 0; i < params.radialSegs; i++) {
      const a1 = (i / params.radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / params.radialSegs) * Math.PI * 2;
      const p1 = new THREE.Vector3(Math.cos(a1) * params.radius, Math.sin(a1) * params.radius, z);
      const p2 = new THREE.Vector3(Math.cos(a2) * params.radius, Math.sin(a2) * params.radius, z);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 }));
      tunnelLines.push({ line, p1, p2 });
      tunnelGroup.add(line);
    }
  }

  // Spokes (vertical)
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
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 }));
      tunnelLines.push({ line, p1, p2 });
      tunnelGroup.add(line);
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

// Track mouse
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Helper: distance from line segment to ray
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

// Snake line
const snakeLength = 60;
const snakePath = [];
for (let i = 0; i < snakeLength; i++) {
  snakePath.push(new THREE.Vector3(0, 0, 0));
}
const snakeGeometry = new THREE.BufferGeometry().setFromPoints(snakePath);
const snakeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
const snakeLine = new THREE.Line(snakeGeometry, snakeMaterial);
scene.add(snakeLine);

// Animation
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  raycaster.setFromCamera(mouse, camera);

  // Reset tunnel line colors
  tunnelLines.forEach(({ line }) => {
    line.material.color.set(baseColor);
    line.material.opacity = 0.3;
  });

  const ray = raycaster.ray;

  // Hover highlight
  tunnelLines.forEach(({ line, p1, p2 }) => {
    const dist = getClosestDistance(ray, p1, p2);
    if (dist < params.hoverDistance) {
      line.material.color.set(hoverColor);
      line.material.opacity = 1.0;
    }
  });

  // Snake update
  const targetPoint = new THREE.Vector3();
  ray.at(5, targetPoint); // point in 3D space in front of camera
  const newHead = snakePath[0].clone().lerp(targetPoint, 0.2);
  snakePath.unshift(newHead);
  snakePath.pop();
  snakeGeometry.setFromPoints(snakePath);

  // Rotate the whole tunnel
  tunnelGroup.rotation.z += params.rotationSpeed;

  renderer.render(scene, camera);
}

animate();
