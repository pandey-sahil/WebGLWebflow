import * as THREE from "three";


const settings = {
  gridSize: 20.0,
  aberration: 1.0,
};

// Shaders
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("canvas"),
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hovered = null;
let quickHover, quickMouseX, quickMouseY;

const planes = [];

// ✅ Select images with [webgl-grid-anime] attribute
const images = document.querySelectorAll("img[webgl-grid-anime]");

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

function updatePlanePositions() {
  planes.forEach((plane, i) => {
    const bounds = images[i].getBoundingClientRect();
    plane.position.set(
      bounds.left - window.innerWidth / 2 + bounds.width / 2,
      -bounds.top + window.innerHeight / 2 - bounds.height / 2,
      0
    );
  });
}

function animate() {
  requestAnimationFrame(animate);
  updatePlanePositions();
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

    if (hovered !== hit) {
      if (hovered) {
        hovered.material.uniforms.u_aberrationIntensity.value = 0;
      }
      hovered = hit;

      quickMouseX = gsap.quickTo(hit.material.uniforms.u_mouse.value, "x", {
        duration: 0.3,
        ease: "power2.out",
      });
      quickMouseY = gsap.quickTo(hit.material.uniforms.u_mouse.value, "y", {
        duration: 0.3,
        ease: "power2.out",
      });
    }

    quickMouseX(uv.x);
    quickMouseY(uv.y);
    hovered.material.uniforms.u_aberrationIntensity.value = settings.aberration;
  } else if (hovered) {
    hovered.material.uniforms.u_aberrationIntensity.value = 0;
    hovered = null;
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updatePlanePositions();
});
