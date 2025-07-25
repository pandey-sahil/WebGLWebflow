import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera setup (as per your earlier image)
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8, 3);

// Grid Shader Material
const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      float radialLine = step(0.98, fract(vUv.x * 32.0));
      float heightLine = step(0.98, fract(vUv.y * 40.0));
      float grid = max(radialLine, heightLine);
      gl_FragColor = vec4(vec3(grid), 1.0);
    }
  `,
  side: THREE.DoubleSide
});

// Cylinder Geometry (open-ended for tunnel look)
const geometry = new THREE.CylinderGeometry(10, 10, 60, 32, 40, true);
const tunnel = new THREE.Mesh(geometry, material);
scene.add(tunnel);

// Handle Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  tunnel.rotation.z += 0.002; // optional rotation
  renderer.render(scene, camera);
}
animate();
