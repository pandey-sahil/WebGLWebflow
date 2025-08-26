import * as THREE from "three";
// ========== Global WebGL Manager ==========
window.WebGLEffects = (function () {
  const effects = [];
  let renderer;

  function init() {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.classList.add("global-webgl-canvas");
    document.body.appendChild(renderer.domElement);

    animate();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    effects.forEach(e => {
      if (e.camera && e.camera.isPerspectiveCamera) {
        e.camera.aspect = window.innerWidth / window.innerHeight;
        e.camera.updateProjectionMatrix();
      }
    });
  }

  function addEffect(effectFn, tabSelector) {
    const effect = effectFn();
    if (!effect) return;
    effects.push({ ...effect, tabSelector });
  }

  function getActiveEffect() {
    let active = null;
    effects.forEach(e => {
      const pane = document.querySelector(e.tabSelector);
      if (pane && pane.classList.contains("w--tab-active")) {
        active = e;
      }
    });
    return active;
  }

  function animate(time) {
    requestAnimationFrame(animate);
    renderer.clear();

    const activeEffect = getActiveEffect();
    if (activeEffect) {
      if (activeEffect.update) activeEffect.update(time);
      renderer.render(activeEffect.scene, activeEffect.camera);
    }
  }

  init();
  return { addEffect };
})();
function initBludge() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 2;

  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 10.0 + uTime) * 0.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(vUv, 1.0, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function update(time) {
    material.uniforms.uTime.value = time * 0.001;
  }

  return { scene, camera, update };
}
function HoverListEffect() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 2;

  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function update(time) {
    mesh.rotation.y = Math.sin(time * 0.001) * 0.5;
  }

  return { scene, camera, update };
}



document.addEventListener("DOMContentLoaded", () => {
  // Attach Bulge effect to bulge tab pane
  WebGLEffects.addEffect(initBludge, "#tab-buldge-pane");

  // Attach List hover effect to list tab pane
  WebGLEffects.addEffect(HoverListEffect, "#tab-list-pane");
});
