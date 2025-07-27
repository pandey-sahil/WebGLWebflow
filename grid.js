import * as THREE from 'three';

// Helper to obtain or create a canvas
function getOrCreateCanvas() {
  let canvas = document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  return canvas;
}

// Your main entry point
function startGrid() {
  const canvas = getOrCreateCanvas();
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setClearColor(0x000000);

  // Sizing
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // Scene and camera setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2, 8);
  camera.lookAt(0, 0, 0);

  // Parameters
  const gridWidth = 8;
  const gridHeight = 4;
  const columns = 40;
  const rows = 20;
  const curvature = 0.15;

  // Grid geometry
  const positions = [];
  function bowlWarp(x, y) {
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

  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff, opacity: 0.8, transparent: true
  });
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
  scene.add(grid);

  // Animation
  let offset = 0;
  const speed = 0.04;

  function animate() {
    requestAnimationFrame(animate);
    offset += speed;
    grid.position.x = -((offset) % (gridWidth / columns));
    renderer.render(scene, camera);
  }

  // Responsiveness
  window.addEventListener('resize', resize);
  resize();
  animate();
}

// Run only after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGrid);
} else {
  startGrid();
}
