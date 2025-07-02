>
import * as THREE from 'three';

document.querySelectorAll('img[webgl-grid-anime]').forEach((imageElement) => {
  const imageContainer = imageElement.parentElement;
  imageContainer.style.position = 'relative';

  let easeFactor = 0.02;
  let scene, camera, renderer, planeMesh;
  let mousePosition = { x: 0.5, y: 0.5 };
  let targetMousePosition = { x: 0.5, y: 0.5 };
  let prevPosition = { x: 0.5, y: 0.5 };
  let aberrationIntensity = 0.5;
  let uniforms;

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

  const loader = new THREE.TextureLoader();
  loader.load(imageElement.src, (texture) => {
    initScene(texture);
    animate();
  });

  function initScene(texture) {
    scene = new THREE.Scene();

    const width = imageContainer.offsetWidth;
    const height = imageContainer.offsetHeight;

    camera = new THREE.PerspectiveCamera(80, width / height, 0.01, 10);
    camera.position.z = 1;

    uniforms = {
      u_mouse: { value: new THREE.Vector2() },
      u_prevMouse: { value: new THREE.Vector2() },
      u_aberrationIntensity: { value: 0 },
      u_texture: { value: texture },
      u_time: { value: 0 },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    planeMesh = new THREE.Mesh(geometry, material);
    scene.add(planeMesh);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.pointerEvents = 'none';
    imageContainer.appendChild(renderer.domElement);
  }

  function animate() {
    requestAnimationFrame(animate);

    uniforms.u_time.value = performance.now() * 0.001;

    mousePosition.x += (targetMousePosition.x - mousePosition.x) * easeFactor;
    mousePosition.y += (targetMousePosition.y - mousePosition.y) * easeFactor;

    uniforms.u_mouse.value.set(mousePosition.x, 1.0 - mousePosition.y);
    uniforms.u_prevMouse.value.set(prevPosition.x, 1.0 - prevPosition.y);

    aberrationIntensity = Math.max(0.0, aberrationIntensity - 0.05);
    uniforms.u_aberrationIntensity.value = aberrationIntensity;

    renderer.render(scene, camera);
  }

  imageContainer.addEventListener("mousemove", (e) => {
    easeFactor = 0.02;
    const rect = imageContainer.getBoundingClientRect();
    prevPosition = { ...targetMousePosition };

    targetMousePosition.x = (e.clientX - rect.left) / rect.width;
    targetMousePosition.y = (e.clientY - rect.top) / rect.height;
    aberrationIntensity = 1;
  });

  imageContainer.addEventListener("mouseenter", (e) => {
    const rect = imageContainer.getBoundingClientRect();
    targetMousePosition.x = mousePosition.x = (e.clientX - rect.left) / rect.width;
    targetMousePosition.y = mousePosition.y = (e.clientY - rect.top) / rect.height;
  });

  imageContainer.addEventListener("mouseleave", () => {
    easeFactor = 0.05;
    targetMousePosition = { ...prevPosition };
  });

  window.addEventListener("resize", () => {
    const width = imageContainer.offsetWidth;
    const height = imageContainer.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
});
