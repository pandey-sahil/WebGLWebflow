
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();

// ✅ Camera setup (moved away from center)
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// ✅ OrbitControls properly set
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.update();

// Tunnel grid setup
const radius = 10, length = 60;
const radialSegs = 32, heightSegs = 40;
const positions = [];

// 🔁 Rings
for (let h = 0; h <= heightSegs; h++) {
  const z = (h / heightSegs) * length - length / 2;
  for (let i = 0; i < radialSegs; i++) {
    const a1 = (i / radialSegs) * Math.PI * 2;
    const a2 = ((i + 1) / radialSegs) * Math.PI * 2;
    const x1 = Math.cos(a1) * radius;
    const y1 = Math.sin(a1) * radius;
    const x2 = Math.cos(a2) * radius;
    const y2 = Math.sin(a2) * radius;
    positions.push(x1, y1, z, x2, y2, z);
  }
}

// 🔁 Radial lines
for (let i = 0; i < radialSegs; i++) {
  const angle = (i / radialSegs) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  for (let h = 0; h < heightSegs; h++) {
    const z1 = (h / heightSegs) * length - length / 2;
    const z2 = ((h + 1) / heightSegs) * length - length / 2;
    positions.push(x, y, z1, x, y, z2);
  }
}

// Create line geometry
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

const material = new THREE.LineBasicMaterial({ color: 0xffffff });
const lines = new THREE.LineSegments(geometry, material);
scene.add(lines);

// Animation
let rotating = true;
document.addEventListener('keydown', e => {
  if (e.key === 'r') rotating = !rotating;
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  if (rotating) lines.rotation.z += 0.002;
  controls.update();
  renderer.render(scene, camera);
}
animate();
