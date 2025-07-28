
  import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
  
// Canvas and renderer
const canvas = document.querySelector('.tunnelcanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

// Scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.position.set(0, 8, 4);
camera.lookAt(0, 0, 0);

// Tunnel parameters
const params = {
  radius: 10,
  length: 60,
  radialSegs: 32,
  heightSegs: 40,
  rotationSpeed: 0.002
};

// Mouse and raycaster
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let isHovering = false;

// Shader material
const tunnelMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uLength: { value: params.length },
    color: { value: new THREE.Color(0xffffff) },
    hover: { value: 0.0 }
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
    uniform float uLength;
    uniform float hover;
    varying float vZ;

    void main() {
      float fade = 1.0 - smoothstep(-uLength/2.0 + 5.0, -uLength/2.0, vZ);
      fade *= 1.0 - smoothstep(uLength/2.0 - 5.0, uLength/2.0, vZ);
      vec3 finalColor = mix(color, vec3(1.0, 0.2, 0.2), hover);
      gl_FragColor = vec4(finalColor, fade);
    }
  `,
  transparent: true
});

// Tunnel geometry
function createTunnelGeometry(radius, length, radialSegs, heightSegs) {
  const positions = [];
  for (let h = 0; h <= heightSegs; h++) {
    const z = (h / heightSegs) * length - length / 2;
    for (let i = 0; i < radialSegs; i++) {
      const a1 = (i / radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / radialSegs) * Math.PI * 2;
      positions.push(
        Math.cos(a1) * radius, Math.sin(a1) * radius, z,
        Math.cos(a2) * radius, Math.sin(a2) * radius, z
      );
    }
  }

  for (let i = 0; i < radialSegs; i++) {
    const angle = (i / radialSegs) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    for (let h = 0; h < heightSegs; h++) {
      const z1 = (h / heightSegs) * length - length / 2;
      const z2 = ((h + 1) / heightSegs) * length - length / 2;
      positions.push(x, y, z1, x, y, z2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

// Create and add tunnel mesh
const tunnelGeometry = createTunnelGeometry(params.radius, params.length, params.radialSegs, params.heightSegs);
const tunnelMesh = new THREE.LineSegments(tunnelGeometry, tunnelMaterial);
scene.add(tunnelMesh);

// Mouse move listener
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Resize helper
function resizeRendererToCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  resizeRendererToCanvas();

  // Raycasting
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(tunnelMesh);
  tunnelMaterial.uniforms.hover.value = intersects.length > 0 ? 1.0 : 0.0;

  tunnelMesh.rotation.z += params.rotationSpeed;
  renderer.render(scene, camera);
}

animate();
