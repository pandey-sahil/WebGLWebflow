import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// Camera setup (static)
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 8, 3); // You can adjust this as needed
camera.lookAt(0, 0, 0); // Point camera at the origin

// Params
const params = {
  radius: 10,
  length: 60,
  radialSegs: 32,
  heightSegs: 40,
  rotationSpeed: 0.002
};

let tunnelMesh;

// Shader Material
const tunnelMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uLength: { value: params.length },
    color: { value: new THREE.Color(0xffffff) }
  },
  vertexShader: `
    uniform float uLength;
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
    varying float vZ;
    void main() {
      float fade = 1.0 - smoothstep(-uLength/2.0 + 5.0, -uLength/2.0, vZ);
      fade *= 1.0 - smoothstep(uLength/2.0 - 5.0, uLength/2.0, vZ);
      gl_FragColor = vec4(color, fade);
    }
  `,
  transparent: true
});

// Geometry Generator
function createTunnel(radius, length, radialSegs, heightSegs) {
  const pos = [];
  for (let h = 0; h <= heightSegs; h++) {
    const z = (h / heightSegs) * length - length / 2;
    for (let i = 0; i < radialSegs; i++) {
      const a1 = (i / radialSegs) * Math.PI * 2;
      const a2 = ((i + 1) / radialSegs) * Math.PI * 2;
      pos.push(
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
      pos.push(x, y, z1, x, y, z2);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(geom, tunnelMaterial.clone());
}

// Create tunnel
function updateTunnel() {
  if (tunnelMesh) scene.remove(tunnelMesh);
  tunnelMaterial.uniforms.uLength.value = params.length;
  tunnelMesh = createTunnel(params.radius, params.length, params.radialSegs, params.heightSegs);
  scene.add(tunnelMesh);
}
updateTunnel();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  tunnelMesh.rotation.z += params.rotationSpeed;
  renderer.render(scene, camera);
}
animate();
