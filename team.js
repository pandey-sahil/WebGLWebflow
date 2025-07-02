import * as THREE from "three";

// 🎨 Shaders
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
  uniform sampler2D uTexture;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform vec3 uColor;

  void main() {
    float blocks = 20.0;
    vec2 blockUv = floor(vUv * blocks) / blocks;
    float dist = length(blockUv - uMouse);
    float strength = smoothstep(0.4, 0.0, dist);
    vec2 distortion = vec2(0.05) * strength;

    vec4 grayTex = texture2D(uTexture, vUv + distortion * uHover);
    vec3 fakeColor = grayTex.rgb * uColor;
    vec3 finalColor = mix(grayTex.rgb, fakeColor, uHover);

    gl_FragColor = vec4(finalColor, grayTex.a);
  }
`;

window.addEventListener("DOMContentLoaded", () => {
  console.clear();
  console.log("🌐 DOM fully loaded");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 20;

  let canvas = document.querySelector("#canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "canvas";
    const container = document.getElementById("imageContainer") || document.body;
    container.appendChild(canvas);
    console.log("🆕 Canvas created and appended to container.");
  } else {
    console.log("✅ Canvas already exists.");
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const images = document.querySelectorAll("img[webgl-grid-anime]");
  console.log(`🖼 Found ${images.length} target image(s)`);

  const tintColors = [
    new THREE.Color(0.95, 0.75, 0.75),
    new THREE.Color(0.85, 0.9, 1.0),
    new THREE.Color(0.8, 0.85, 1.0),
    new THREE.Color(1.0, 0.95, 0.8),
    new THREE.Color(0.9, 0.8, 1.0),
  ];

  const planes = [];

  images.forEach((img, index) => {
    const rect = img.getBoundingClientRect();
    const scrollY = window.scrollY;

    console.log(`📐 Image ${index} bounds:`, rect);

    const texture = new THREE.TextureLoader().load(img.src, () => {
      console.log(`🎨 Texture ${index} loaded`);
    });

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 },
        uColor: { value: tintColors[index % tintColors.length] },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(rect.width, rect.height);
    const plane = new THREE.Mesh(geometry, material);

    plane.position.set(
      rect.left - window.innerWidth / 2 + rect.width / 2,
      -(rect.top - scrollY) + window.innerHeight / 2 - rect.height / 2,
      0
    );

    scene.add(plane);
    planes.push(plane);
    console.log(`🧱 Plane ${index} created and added to scene`);
  });

  // 🌀 Update position on scroll/resize
  function updatePlanePositions() {
    const scrollY = window.scrollY;
    planes.forEach((plane, i) => {
      const rect = images[i].getBoundingClientRect();
      plane.position.set(
        rect.left - window.innerWidth / 2 + rect.width / 2,
        -(rect.top - scrollY) + window.innerHeight / 2 - rect.height / 2,
        0
      );
    });
  }

  // 🖱 Hover State
  let hoveredPlane = null;

  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const uv = intersects[0].uv;

      console.log("🎯 Hover detected", { uv });

      hit.material.uniforms.uMouse.value.copy(uv);
      hit.material.uniforms.uHover.value = 1;
      hoveredPlane = hit;
    } else if (hoveredPlane) {
      console.log("🚫 Hover ended");
      hoveredPlane.material.uniforms.uHover.value = 0;
      hoveredPlane = null;
    }
  });

  // 🔁 Animate loop
  function animate() {
    requestAnimationFrame(animate);
    updatePlanePositions();
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    console.log("📐 Window resized");
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updatePlanePositions();
  });

  console.log("✅ WebGL hover effect initialized");
});
