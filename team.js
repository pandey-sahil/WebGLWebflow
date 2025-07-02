import * as THREE from "three";

window.addEventListener("DOMContentLoaded", () => {
  console.clear();
  console.log("🧩 DOM content loaded");

  // 1️⃣ Select target images
  const images = document.querySelectorAll("img[webgl-grid-anime]");
  console.log("Found images:", images);

  // 2️⃣ Create or get canvas
  let canvas = document.querySelector("#webgl-canvas");
  if (!canvas) {
    console.log("No canvas found — creating one");
    canvas = document.createElement("canvas");
    canvas.id = "webgl-canvas";
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

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredPlane = null;

  // Shader code
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
      float blocks = 20.0;
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

  const planes = [];

  images.forEach((img, i) => {
    const bounds = img.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;

    const tex = new THREE.TextureLoader().load(img.src, () => {
      console.log(`Texture ${i} loaded`);
    });

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_texture: { value: tex },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_aberrationIntensity: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geo = new THREE.PlaneGeometry(bounds.width, bounds.height);
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      bounds.left - window.innerWidth / 2 + bounds.width / 2,
      -(bounds.top - scrollY) + window.innerHeight / 2 - bounds.height / 2,
      0
    );

    planes.push(mesh);
    scene.add(mesh);
  });

  function updatePlanes() {
    planes.forEach((pl, i) => {
      const b = images[i].getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;

      pl.position.set(
        b.left - window.innerWidth / 2 + b.width / 2,
        -(b.top - scrollY) + window.innerHeight / 2 - b.height / 2,
        0
      );
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    updatePlanes();
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
      hit.material.uniforms.u_aberrationIntensity.value = 1.0;
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
    updatePlanes();
  });

  console.log("✅ team.js setup complete");
});
