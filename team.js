import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

  // ✅ SETTINGS
  const settings = {
    text: "Team You Need",
    font: "Inter",
    fontSize: 350,
    textColor: "#ffffff",
    backgroundColor: "#000000",
    aberration: 1.0,
    ease: 0.05,
    gridSize: 20.0,
    waveFrequency: 30.0,
    waveStrength: 0.003,
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
  vec2 gridUV = floor(vUv * vec2(20.0)) / vec2(20.0);
  vec2 centerOfPixel = gridUV + vec2(1.0 / 20.0, 1.0 / 20.0);

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


  // Create text canvas texture with Inter font
  function createTextTexture(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    // Set background
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load Inter font (uses fallback if not loaded yet)
    ctx.fillStyle = settings.textColor;
    ctx.font = `bold ${settings.fontSize}px ${settings.font}, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
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

    // Fade out effect
    uniforms.u_aberrationIntensity.value *= 0.95;

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
