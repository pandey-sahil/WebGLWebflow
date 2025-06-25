import * as THREE from 'https://unpkg.com/three@0.148.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.148.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.148.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.148.0/examples/jsm/postprocessing/ShaderPass.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 2;

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add image plane
const texture = new THREE.TextureLoader().load("https://picsum.photos/400/300");
const material = new THREE.MeshBasicMaterial({ map: texture });
const geometry = new THREE.PlaneGeometry(1.5, 1);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Simple distortion shader (example, not full shader)
const shader = {
  uniforms: {
    tDiffuse: { value: null },
    mouse: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 mouse;
    varying vec2 vUv;
    void main() {
      float dist = distance(vUv, mouse);
      vec2 uv = vUv + 0.03 * normalize(vUv - mouse) * smoothstep(0.3, 0.0, dist);
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `
};
const shaderPass = new ShaderPass(shader);
shaderPass.renderToScreen = true;
composer.addPass(shaderPass);

// Track mouse
window.addEventListener('mousemove', e => {
  shader.uniforms.mouse.value.x = e.clientX / window.innerWidth;
  shader.uniforms.mouse.value.y = 1.0 - e.clientY / window.innerHeight;
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  composer.render();
}
animate();
