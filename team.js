import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// SETTINGS ARRAY
const settings = {
  aberration: 1.0,
  ease: 0.05,
  textSize: 1.0,
  text: "Team You Need",
  textureURL: "https://cdn.prod.website-files.com/681b5ed03f338b78fb6cd5ed/686367874c3399d5abb48eb8_Image%20(25).png",
  fontURL:
    "https://cdn.jsdelivr.net/npm/three@0.160.1/examples/fonts/helvetiker_bold.typeface.json",
};

const container = document.getElementById("imageContainer");
let scene, camera, renderer, mesh, uniforms;

let mouse = new THREE.Vector2(0.5, 0.5);
let prevMouse = new THREE.Vector2(0.5, 0.5);
let targetMouse = new THREE.Vector2(0.5, 0.5);

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D u_texture;
  uniform vec2 u_mouse;
  uniform vec2 u_prevMouse;
  uniform float u_aberrationIntensity;
  uniform float u_time;

  void main() {
    vec2 gridUV = floor(vUv * vec2(20.0)) / vec2(20.0);
    vec2 centerOfPixel = gridUV + vec2(1.0/20.0, 1.0/20.0);
    vec2 mouseDirection = u_mouse - u_prevMouse;
    vec2 pixelToMouseDirection = centerOfPixel - u_mouse;
    float pixelDistanceToMouse = length(pixelToMouseDirection);
    float strength = smoothstep(0.3, 0.0, pixelDistanceToMouse);
    float wave = sin(vUv.y * 30.0 + u_time * 2.0) * 0.003;

    vec2 uvOffset = strength * -mouseDirection * 0.2;
    vec2 uv = vUv - uvOffset + vec2(wave, 0.0);

    vec4 colorR = texture2D(u_texture, uv + vec2(strength * u_aberrationIntensity * 0.01, 0.0));
    vec4 colorG = texture2D(u_texture, uv);
    vec4 colorB = texture2D(u_texture, uv - vec2(strength * u_aberrationIntensity * 0.01, 0.0));

    gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);
  }
`;

// Load texture and init scene
const loader = new THREE.TextureLoader();
loader.load(settings.textureURL, (texture) => {
  init(texture);
  animate();
});

function init(texture) {
  scene = new THREE.Scene();
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.z = 10;

  uniforms = {
    u_texture: { value: texture },
    u_mouse: { value: mouse },
    u_prevMouse: { value: prevMouse },
    u_aberrationIntensity: { value: settings.aberration },
    u_time: { value: 0.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const fontLoader = new FontLoader();
  fontLoader.load(settings.fontURL, (font) => {
    const textGeo = new TextGeometry(settings.text, {
      font: font,
      size: 1,
      height: 0.1,
      curveSegments: 12,
    });

    textGeo.center();

    mesh = new THREE.Mesh(textGeo, material);
    mesh.scale.set(settings.textSize, settings.textSize, settings.textSize);
    scene.add(mesh);
  });

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
}

function animate() {
  requestAnimationFrame(animate);

  // easing mouse movement
  mouse.x += (targetMouse.x - mouse.x) * settings.ease;
  mouse.y += (targetMouse.y - mouse.y) * settings.ease;

  uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y);
  uniforms.u_prevMouse.value.set(prevMouse.x, 1.0 - prevMouse.y);

  uniforms.u_aberrationIntensity.value = settings.aberration;
  uniforms.u_time.value = performance.now() * 0.001;

  renderer.render(scene, camera);
}

container.addEventListener("mousemove", (e) => {
  const rect = container.getBoundingClientRect();
  prevMouse.copy(targetMouse);
  targetMouse.x = (e.clientX - rect.left) / rect.width;
  targetMouse.y = (e.clientY - rect.top) / rect.height;
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
