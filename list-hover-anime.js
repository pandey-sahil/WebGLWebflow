import * as THREE from "three";

function initWebGLDistortion() {
  const container = document.querySelector("[data-webgl-container]");
  const canvas = container?.querySelector(".g_canvas_distortion");
  const image = document.querySelector("[distorted-image]");

  if (!container || !canvas || !image) return;

  // Scene + Renderer
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(camera);

  // Load image as texture
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(image.src, () => {
    fitImage();
  });

  // Custom shader
  const uniforms = {
    uTexture: { value: texture },
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    uImageResolution: { value: new THREE.Vector2(1, 1) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uImageResolution;
      varying vec2 vUv;

      void main() {
        // keep aspect ratio
        vec2 uv = vUv;
        vec2 scale = min(uResolution / uImageResolution, vec2(1.0));
        uv = (uv - 0.5) * scale + 0.5;

        // distortion (subtle)
        uv.x += 0.015 * sin(uv.y * 10.0 + uTime * 0.8);
        uv.y += 0.015 * cos(uv.x * 10.0 + uTime * 0.8);

        vec4 tex = texture2D(uTexture, uv);
        gl_FragColor = tex;
      }
    `
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Resize handling
  function fitImage() {
    if (!texture.image) return;
    uniforms.uImageResolution.value.set(texture.image.width, texture.image.height);
    uniforms.uResolution.value.set(container.clientWidth, container.clientHeight);
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  window.addEventListener("resize", fitImage);

  // Animation loop
  function animate() {
    uniforms.uTime.value += 0.02;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

// Initialize when DOM ready
document.addEventListener("DOMContentLoaded", initWebGLDistortion);
