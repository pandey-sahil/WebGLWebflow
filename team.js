import * as THREE from 'three';

window.addEventListener('DOMContentLoaded', () => {
  console.log("✅ DOM ready");

  const container = document.getElementById('imageContainer');
  if (!container) {
    console.error('❌ imageContainer not found');
    return;
  }

  const width = container.offsetWidth;
  const height = container.offsetHeight;
  console.log(`📏 container size: ${width} x ${height}`);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
  camera.position.z = 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.01;
    renderer.render(scene, camera);
  }

  animate();
});
