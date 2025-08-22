import * as THREE from "three";

// ONE global renderer
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Store all effects
const effects = [];

// --- Add new effect ---
export function addEffect(effectFn) {
  const { scene, camera, update } = effectFn(renderer.domElement);
  effects.push({ scene, camera, update });
}

// --- Resize handler ---
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);

  effects.forEach(({ camera }) => {
    if (camera.isPerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  });
}
window.addEventListener("resize", resize);

// --- Animation loop ---
function animate(time) {
  requestAnimationFrame(animate);
  effects.forEach(({ scene, camera, update }) => {
    if (update) update(time);
    renderer.render(scene, camera);
  });
}
animate();
