import * as THREE from "three";

// ✅ Settings
const settings = {
  gridSize: 20.0,
  aberration: 1.0,
};

// ✅ Select only images with the [webgl-grid-anime] attribute
const images = document.querySelectorAll("img[webgl-grid-anime]");
if (images.length === 0) {
  console.warn("No images found with [webgl-grid-anime] attribute");
}

// ✅ Ensure canvas exists or create one
let canvas = document.querySelector("canvas");
if (!canvas) {
  canvas = document.createElement("canvas");
  document.getElementById("imageContainer").appendChild(canvas);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// 👇 Vertex Shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 👇 Fragment Shader
const fragmentShader = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D u_texture;
  uniform vec2 u_mouse;
  uniform float u_aberrationIntensity;

  void main() {
    float blocks = ${settings.gridSize.toFixed(1)};
    vec2 blockUv = floor(vUv * blocks) / blocks;
    float dist = length(blockUv - u_mouse);
    float strength = smoothstep(0.4, 0.0, dist);
    vec2 distortion = vec2(0.05) * strength;

    vec2 uv = vUv + distortion;
    vec4 tex = texture2D(u_texture, uv);

    vec4 r = texture2D(u_texture, uv + vec2(strength * u_aberrationIntensity * 0.005, 0.0));
    vec4 g = texture2D(u_texture, uv);
    vec4 b = texture2D(u_texture, uv - vec2(strength * u_aberrationIntensity * 0.005, 0.0));

    gl_FragColor = vec4(r.r, g.g, b.b, tex.a);
  }
`;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPlane = null;

const planes = [];

images.forEach((img) => {
  const bounds = img.getBoundingClientRect();
  const texture = new THREE.TextureLoader().load(img.src);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_aberrationIntensity: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(
    bounds.left - window.innerWidth / 2 + bounds.width / 2,
    -bounds.top + window.innerHeight / 2 - bounds.height / 2,
    0
  );

  planes.push(mesh);
  scene.add(mesh);
});

function updatePositions() {
  planes.forEach((plane, i) => {
    const b = images[i].getBoundingClientRect();
    plane.position.set(
      b.left - window.innerWidth / 2 + b.width / 2,
      -b.top + window.innerHeight / 2 - b.height / 2,
      0
    );
  });
}

function animate() {
  requestAnimationFrame(animate);
  updatePositions();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(planes);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const uv = intersects[0].uv;

    hit.material.uniforms.u_mouse.value.copy(uv);
    hit.material.uniforms.u_aberrationIntensity.value = settings.aberration;
    hoveredPlane = hit;
  } else if (hoveredPlane) {
    hoveredPlane.material.uniforms.u_aberrationIntensity.value = 0;
    hoveredPlane = null;
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updatePositions();
});
