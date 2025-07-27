import * as THREE from 'three';

// SCENE, CAMERA, RENDERER
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.querySelector('canvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);

// WARPED GRID CREATION
const gridWidth = 8;
const gridHeight = 4;
const columns = 40;
const rows = 20;
const gridGeometry = new THREE.BufferGeometry();
const positions = [];

function bowlWarp(x, y) {
  // Make the grid curve downward (bowl)
  const curvature = 0.15;
  const z = -Math.pow(y, 2) * curvature;
  return [x, y, z];
}

// Vertical lines
for (let i = 0; i <= columns; i++) {
  const x = -gridWidth / 2 + (i / columns) * gridWidth;
  for (let j = 0; j < rows; j++) {
    const y1 = -gridHeight / 2 + (j / rows) * gridHeight;
    const y2 = -gridHeight / 2 + ((j + 1) / rows) * gridHeight;
    positions.push(...bowlWarp(x, y1), ...bowlWarp(x, y2));
  }
}
// Horizontal lines
for (let j = 0; j <= rows; j++) {
  const y = -gridHeight / 2 + (j / rows) * gridHeight;
  for (let i = 0; i < columns; i++) {
    const x1 = -gridWidth / 2 + (i / columns) * gridWidth;
    const x2 = -gridWidth / 2 + ((i + 1) / columns) * gridWidth;
    positions.push(...bowlWarp(x1, y), ...bowlWarp(x2, y));
  }
}

gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
const gridMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.8, transparent: true });
const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
scene.add(grid);

// ANIMATION LOOP
let offset = 0;
const speed = 0.04;
const resetDistance = gridWidth / 2;

function animate() {
  requestAnimationFrame(animate);
  offset += speed;
  grid.position.x = -((offset) % (gridWidth / columns));
  renderer.render(scene, camera);
}
animate();

// RESPONSIVENESS
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
