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

const canvas = getOrCreateCanvas();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const geometry = new THREE.PlaneGeometry(20, 40, 200, 400);
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    gridScale: { value: 10.0 },
    warpAmplitude: { value: 2.0 }
  },
  vertexShader: `
    uniform float time;
    uniform float warpAmplitude;
    varying vec3 vPos;
    void main() {
      vPos = position;
      vec3 warped = position;
      warped.y += sin(warped.z * 0.1) * warpAmplitude;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform float gridScale;
    float gridLine(vec2 uv) {
      vec2 grid = abs(fract(uv * gridScale - 0.5) - 0.5) / fwidth(uv * gridScale);
      return 1.0 - min(min(grid.x, grid.y), 1.0);
    }
    void main() {
      float lines = gridLine(vPos.xz);
      vec3 gridColor = mix(vec3(0.02), vec3(0.4), lines);
      gl_FragColor = vec4(gridColor, 1.0);
    }
  `,
  side: THREE.DoubleSide
});

const mesh = new THREE.Mesh(geometry, material);
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);

// Animate
function animate(time) {
  material.uniforms.time.value = time * 0.001;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
