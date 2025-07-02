import * as THREE from "three";

// ✅ SETTINGS
const settings = {
  text: "Team\nYou Need",
  font: "Inter",
  fontSize: 680,
  textColor: "#ffffff",

  aberration: 2.5,
  ease: 0.08,
  gridSize: 15.0,
  waveFrequency: 25.0,
  waveStrength: 0.005,
};

const container = document.getElementById("imageContainer");

let scene, camera, renderer, mesh;
let uniforms;
let mouse = new THREE.Vector2(0.5, 0.5);
let targetMouse = new THREE.Vector2(0.5, 0.5);
let prevMouse = new THREE.Vector2(0.5, 0.5);

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
  vec2 gridUV = floor(vUv * vec2(15.0)) / vec2(15.0);
  vec2 centerOfPixel = gridUV + vec2(1.0 / 15.0, 1.0 / 15.0);

  vec2 mouseDirection = u_mouse - u_prevMouse;
  vec2 pixelToMouseDirection = centerOfPixel - u_mouse;
  float pixelDistanceToMouse = length(pixelToMouseDirection);
  float strength = smoothstep(0.4, 0.0, pixelDistanceToMouse);

  // Enhanced wave effect
  float wave1 = sin(vUv.y * 25.0 + u_time * 3.0) * 0.005;
  float wave2 = sin(vUv.x * 15.0 + u_time * 2.0) * 0.003;

  vec2 uvOffset = strength * -mouseDirection * 0.3;
  vec2 uv = vUv - uvOffset + vec2(wave1 + wave2, wave1);

  // Enhanced chromatic aberration
  float aberrationAmount = strength * u_aberrationIntensity * 0.02;
  
  vec4 colorR = texture2D(u_texture, uv + vec2(aberrationAmount, 0.0));
  vec4 colorG = texture2D(u_texture, uv);
  vec4 colorB = texture2D(u_texture, uv - vec2(aberrationAmount, 0.0));
  
  // Add some color bleeding for more dramatic effect
  vec4 colorY = texture2D(u_texture, uv + vec2(0.0, aberrationAmount * 0.5));
  vec4 colorC = texture2D(u_texture, uv - vec2(0.0, aberrationAmount * 0.5));

  gl_FragColor = vec4(
    colorR.r + colorY.r * 0.3, 
    colorG.g + colorC.g * 0.2, 
    colorB.b + colorC.b * 0.3, 
    1.0
  );
}
`;

// Create text canvas texture with Inter font
function createTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Set background
  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Setup text rendering
  ctx.fillStyle = settings.textColor;
  ctx.font = `900 ${settings.fontSize}px ${settings.font}, Arial Black, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Split text into lines and render
  const lines = text.split('\n');
  const lineHeight = settings.fontSize * 1.1;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function init() {
  scene = new THREE.Scene();
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 10);
  camera.position.z = 2;

  uniforms = {
    u_texture: { value: createTextTexture(settings.text) },
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
  container.appendChild(renderer.domElement);
}

function animate() {
  requestAnimationFrame(animate);

  uniforms.u_time.value = performance.now() * 0.001;

  // Smooth easing
  mouse.lerp(targetMouse, settings.ease);
  uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y);
  uniforms.u_prevMouse.value.set(prevMouse.x, 1.0 - prevMouse.y);

  // Fade out effect with slower decay for more persistent effect
  uniforms.u_aberrationIntensity.value *= 0.98;

  renderer.render(scene, camera);
}

container.addEventListener("mousemove", (e) => {
  const rect = container.getBoundingClientRect();
  prevMouse.copy(targetMouse);
  targetMouse.x = (e.clientX - rect.left) / rect.width;
  targetMouse.y = (e.clientY - rect.top) / rect.height;
  uniforms.u_aberrationIntensity.value = settings.aberration;
});

container.addEventListener("mouseenter", (e) => {
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  mouse.set(x, y);
  targetMouse.set(x, y);
});

container.addEventListener("mouseleave", () => {
  prevMouse.copy(targetMouse);
});

window.addEventListener("resize", () => {
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

init();
animate();
