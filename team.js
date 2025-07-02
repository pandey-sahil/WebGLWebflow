import * as THREE from 'three';

console.log("✅ Script loaded");

// Get the container
const container = document.getElementById('imageContainer');
if (!container) {
  console.error('❌ imageContainer not found');
  return;
}

// Set size
const width = container.offsetWidth || 800;
const height = container.offsetHeight || 600;

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020); // dark background

// Camera
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.z = 2;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

// Geometry
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Animation
function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

animate();
