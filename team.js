import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const settings = {
  text: "Team You Need",
  fontSize: 10,
  depth: 2,
  color: "#ffffff",
  backgroundColor: "#000000",
  aberration: 1.0,
  ease: 0.05,
  waveFrequency: 30.0,
  waveStrength: 0.003,
};

let scene, camera, renderer, mesh, uniforms;
let mouse = new THREE.Vector2(0.5, 0.5);
let targetMouse = new THREE.Vector2(0.5, 0.5);
let prevMouse = new THREE.Vector2(0.5, 0.5);

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
  uniform vec2 u_prevMouse;
  uniform float u_aberrationIntensity;
  uniform float u_time;

  void main() {
    vec2 gridUV = floor(vUv * vec2(20.0)) / vec2(20.0);
    vec2 centerOfPixel = gridUV + vec2(1.0 / 20.0, 1.0 / 20.0);

    vec2 mouseDirection = u_mouse - u_prevMouse;
    vec2 pixelToMouseDirection = centerOfPixel - u_mouse;
    float pixelDistanceToMouse = length(pixelToMouseDirection);
    float strength = smoothstep(0.3, 0.0, pixelDistanceToMouse);

    float wave = sin(vUv.y * ${settings.waveFrequency}.0 + u_time * 2.0) * ${settings.waveStrength};

    vec2 uvOffset = strength * -mouseDirection * 0.2;
    vec2 uv = vUv - uvOffset + vec2(wave, 0.0);

    vec4 colorR = texture2D(u_texture, uv + vec2(strength * u_aberrationIntensity * 0.01, 0.0));
    vec4 colorG = texture2D(u_texture, uv);
    vec4 colorB = texture2D(u_texture, uv - vec2(strength * u_aberrationIntensity * 0.01, 0.0));

    gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);
  }
`;

// Create texture from rendered text
function createTextTexture(callback) {
  const loader = new FontLoader();
  loader.load("fonts/helvetiker_regular.typeface.json", (font) => {
    const geometry = new TextGeometry(settings.text, {
      font: font,
      size: settings.fontSize,
      depth: settings.depth,
      curveSegments: 12,
      bevelEnabled: false,
    });

    geometry.center();

    const textMaterial = new THREE.MeshBasicMaterial({ color: settings.color });
    const textMesh = new THREE.Mesh(geometry, textMaterial);

    const tempScene = new THREE.Scene();
    tempScene.add(textMesh);

    const tempCamera = new THREE.PerspectiveCamera(45, 2, 0.1, 100);
    tempCamera.position.z = 30;
    const tempRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    tempRenderer.setSize(1024, 512);
    tempRenderer.setClearColor(settings.backgroundColor);
    tempRenderer.render(tempScene, tempCamera);

    const canvas = tempRenderer.domElement;
    const texture = new THREE.CanvasTexture(canvas);
    callback(texture);
  });
}

function init(texture) {
  scene = new THREE.Scene();
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 10);
  camera.position.z = 2;

  uniforms = {
    u_texture: { value: texture },
    u_mouse: { value: mouse.clone() },
    u_prevMouse: { value: prevMouse.clone() },
    u_aberrationIntensity: { value: 0.0 },
    u_time: { value: 0.0 },
  };

  const geometry = new THREE.PlaneGeometry(2, 1);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.appendChild(renderer.domElement);
}

function animate() {
  requestAnimationFrame(animate);
  uniforms.u_time.value = performance.now() * 0.001;

  mouse.lerp(targetMouse, settings.ease);
  uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y);
  uniforms.u_prevMouse.value.set(prevMouse.x, 1.0 - prevMouse.y);
  uniforms.u_aberrationIntensity.value *= 0.95;

  renderer.render(scene, camera);
}

window.addEventListener("mousemove", (e) => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  prevMouse.copy(targetMouse);
  targetMouse.set(x, y);
  uniforms.u_aberrationIntensity.value = settings.aberration;
});

window.addEventListener("mouseenter", (e) => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  mouse.set(x, y);
  targetMouse.set(x, y);
});

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

createTextTexture((texture) => {
  init(texture);
  animate();
});
