import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// Static camera setup
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// Grid parameters
const gridWidth = 20;
const gridHeight = 20;
const spacingX = 2 / gridWidth;
const spacingY = 2 / gridHeight;

// Shader material with fade
const tunnelMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color: { value: new THREE.Color(0xffffff) }
  },
  vertexShader: `
    varying float vZ;
    void main() {
      vZ = position.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision mediump float;
    uniform vec3 color;
    varying float vZ;
    void main() {
      float fade = 1.0 - smoothstep(-5.0, 5.0, abs(vZ));
      gl_FragColor = vec4(color, fade);
    }
  `,
  transparent: true
});

// Create warped grid lines
function createCurvedGrid() {
  const pos = [];

  // Horizontal curves
  for (let j = -gridHeight; j <= gridHeight; j++) {
    for (let i = -gridWidth; i < gridWidth; i++) {
      const x1 = i * spacingX;
      const x2 = (i + 1) * spacingX;
      const y = j * spacingY;
      const z = -Math.pow(y, 2) * 0.2;

      pos.push(x1, y, z, x2, y, z);
    }
  }

  // Vertical curves
  for (let i = -gridWidth; i <= gridWidth; i++) {
    for (let j = -gridHeight; j < gridHeight; j++) {
      const x = i * spacingX;
      const y1 = j * spacingY;
      const y2 = (j + 1) * spacingY;
      const z = -Math.pow(x, 2) * 0.2;

      pos.push(x, y1, z, x, y2, z);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(geom, tunnelMaterial.clone());
}

// Add to scene
const grid = createCurvedGrid();
scene.add(grid);

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
