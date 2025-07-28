import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Setup
const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 8, 4);
camera.lookAt(0, 0, 0);

// Raycaster and mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tunnel parameters
const params = {
  radius: 10,
  length: 60,
  radialSegs: 32,
  heightSegs: 40,
  rotationSpeed: 0.002
};

// Line material
const baseMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
const hoverMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2, transparent: true, opacity: 1 });

// Line collection for interaction
const tunnelLines = [];

// Create tunnel lines
function createTunnelLines() {
  // Horizontal rings (around z-axis)
  for (let h = 0; h <= params.heightSegs; h++) {
    const z = (h / params.heightSegs) * params.length - params.length / 2;
    for (let i = 0; i < params.radialSegs; i++) {
      const a1 = (i / params.radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / params.radialSegs) * Math.PI * 2;

      const p1 = new THREE.Vector3(Math.cos(a1) * params.radius, Math.sin(a1) * params.radius, z);
      const p2 = new THREE.Vector3(Math.cos(a2) * params.radius, Math.sin(a2) * params.radius, z);

      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(geom, baseMaterial.clone());
      tunnelLines.push(line);
      scene.add(line);
    }
  }

  // Vertical wires (along z-axis)
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
      const line = new THREE.Line(geom, baseMaterial.clone());
      tunnelLines.push(line);
      scene.add(line);
    }
  }
}

createTunnelLines();

// Resize handling
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

// Animation
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  // Rotate all wires
  tunnelLines.forEach(line => {
    line.rotation.z += params.rotationSpeed;
  });

  // Reset all materials
  tunnelLines.forEach(line => {
    line.material.color.set(0xffffff);
    line.material.opacity = 0.4;
  });

  // Raycast
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(tunnelLines);
  if (intersects.length > 0) {
    const closestLine = intersects[0].object;
    closestLine.material.color.set(0xff0000);
    closestLine.material.opacity = 1.0;
  }

  renderer.render(scene, camera);
}

animate();
