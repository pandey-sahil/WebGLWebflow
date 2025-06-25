 import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.module.js';
  import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/jsm/postprocessing/EffectComposer.js';
  import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/jsm/postprocessing/RenderPass.js';
  import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/jsm/postprocessing/ShaderPass.js';

  const canvas = document.getElementById('glass-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const texture = new THREE.TextureLoader().load('https://picsum.photos/1920/1080');
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const shader = {
    uniforms: {
      tDiffuse: { value: null },
      mouse: { value: new THREE.Vector2(0.5, 0.5) },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 mouse;
      uniform vec2 resolution;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        vec2 m = mouse;
        float radius = 0.15;
        float strength = 0.25;

        vec2 offset = uv - m;
        float dist = length(offset);

        if (dist < radius) {
          uv -= offset * strength * smoothstep(radius, 0.0, dist);
        }

        vec4 base = texture2D(tDiffuse, uv);
        float circle = smoothstep(radius, radius - 0.01, dist);
        vec4 masked = mix(base, texture2D(tDiffuse, vUv), circle);

        gl_FragColor = masked;
      }
    `
  };

  const shaderPass = new ShaderPass(shader);
  shaderPass.renderToScreen = true;
  composer.addPass(shaderPass);

  window.addEventListener('mousemove', (e) => {
    shader.uniforms.mouse.value.x = e.clientX / window.innerWidth;
    shader.uniforms.mouse.value.y = 1.0 - e.clientY / window.innerHeight;
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    shader.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    composer.render();
  }

  animate();
