import * as THREE from 'three';

/*
=====================================================
   GLOBAL EFFECT MANAGER
=====================================================
*/
window.WebGLEffects = (function () {
  const effects = [];
  let renderer, scene, camera;

  function init() {
    // Shared renderer
     renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
     renderer.setPixelRatio(window.devicePixelRatio);
     renderer.setSize(window.innerWidth, window.innerHeight);
     
     // add class before appending
     renderer.domElement.classList.add("global-webgl-canvas");
     document.body.appendChild(renderer.domElement);

    // Shared scene + camera (can be overridden per effect)
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    animate();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function addEffect(effectFn) {
    const effect = effectFn(renderer, scene, camera);
    if (!effect) return; // gracefully skip if it didn't init
    effects.push(effect);
  }

  function animate(time) {
    requestAnimationFrame(animate);
    
    // Clear the main canvas
    renderer.setRenderTarget(null);
    renderer.clear();
    
    // Update and render each effect
    effects.forEach((e) => {
      if (e.update) e.update(time);
      if (e.scene && e.camera) {
        renderer.render(e.scene, e.camera);
      }
    });
  }

  init();

  // Expose the renderer so effects can use it
  return { addEffect, renderer, scene, camera };
})();

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Grid Hover Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰

function GridAnimeEffect(globalRenderer) {
  const image = document.querySelector("img[webgl-grid-anime]");
  if (!image) {
    console.warn("GridAnimeEffect: No image found with attribute 'webgl-grid-anime'");
    return null;
  }
  
  const wrapper = image.closest(".webgl-wrapper");
  if (!wrapper) {
    console.warn("GridAnimeEffect: No wrapper found with class 'webgl-wrapper'");
    return null;
  }
  
  const imgRatio = image.naturalWidth / image.naturalHeight || 1;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-imgRatio, imgRatio, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const texture = new THREE.TextureLoader().load(image.src);
  const uniforms = {
    u_texture: { value: texture },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_aberrationIntensity: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D u_texture;
      void main() {
        gl_FragColor = texture2D(u_texture, vUv);
      }
    `
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * imgRatio, 2), material);
  scene.add(mesh);

  let mouse = { x: 0.5, y: 0.5 };
  let target = { x: 0.5, y: 0.5 };
  let prev = { x: 0.5, y: 0.5 };
  let intensity = 0;

  wrapper.addEventListener("mousemove", (e) => {
    const rect = wrapper.getBoundingClientRect();
    prev = { ...target };
    target.x = (e.clientX - rect.left) / rect.width;
    target.y = (e.clientY - rect.top) / rect.height;
    intensity = 1;
  });

  function update() {
    mouse.x += (target.x - mouse.x) * 0.08;
    mouse.y += (target.y - mouse.y) * 0.08;
    uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y);
    uniforms.u_prevMouse.value.set(prev.x, 1.0 - prev.y);
    uniforms.u_aberrationIntensity.value = intensity;
    intensity = Math.max(0, intensity - 0.05);
  }

  return { scene, camera, update };
}*/ 


/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Hover List Effect Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 
function HoverListEffect(globalRenderer) {
  const wrapper = document.querySelector('[webgl-anime="list-hover-wrapper"]');
  if (!wrapper) return null;

  const SETTINGS = {
    deformation: { strength: 0.00055, smoothing: 0.1 },
    transition: { speed: 0.05, fadeOutSpeed: 0.06 },
    mesh: { baseSize: 300, segments: 20 }
  };

  // Vertex shader
  const vertexShader = `
    uniform vec2 uOffset;
    varying vec2 vUv;

    float M_PI = 3.141529;

    vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset){
        position.x += (sin(uv.y * M_PI) * offset.x);
        position.y += (sin(uv.x * M_PI) * offset.y);
        return position;
    }

    void main(){
        vUv = uv;
        vec3 newPosition = deformationCurve(position, uv, uOffset);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  // Fragment shader
  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform sampler2D uPrevTexture;
    uniform float uAlpha;
    uniform float uMixFactor;
    uniform vec2 uRGBOffset;
    uniform float uTime;
    varying vec2 vUv;

    void main(){
        vec2 center = vec2(0.5, 0.5);
        float distance = length(vUv - center);
        float ripple = sin(distance * 20.0 - uTime * 5.0) * 0.02;

        float offsetStrength = 0.01;
        vec2 rippleOffset = uRGBOffset + vec2(ripple);

        vec4 texR = texture2D(uTexture, vUv + rippleOffset * offsetStrength);
        vec4 texG = texture2D(uTexture, vUv);
        vec4 texB = texture2D(uTexture, vUv - rippleOffset * offsetStrength);

        vec3 newColor = vec3(texR.r, texG.g, texB.b);

        vec4 prevTexR = texture2D(uPrevTexture, vUv + rippleOffset * offsetStrength);
        vec4 prevTexG = texture2D(uPrevTexture, vUv);
        vec4 prevTexB = texture2D(uPrevTexture, vUv - rippleOffset * offsetStrength);

        vec3 prevColor = vec3(prevTexR.r, prevTexG.g, prevTexB.b);

        vec3 finalColor = mix(prevColor, newColor, uMixFactor);

        gl_FragColor = vec4(finalColor, uAlpha);
    }
  `;

  // Scene & Camera
  const scene = new THREE.Scene();
  const perspective = 1000;
  const { clientWidth: width, clientHeight: height } = wrapper;
  const camera = new THREE.PerspectiveCamera(
    (180 * (2 * Math.atan(height / 2 / perspective))) / Math.PI,
    width / height,
    0.1,
    1000
  );
  camera.position.set(0, 0, perspective);

  // Uniforms
  const uniforms = {
    uTexture: { value: null },
    uPrevTexture: { value: null },
    uAlpha: { value: 0.0 },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uMixFactor: { value: 1.0 },
    uRGBOffset: { value: new THREE.Vector2(0, 0) },
    uTime: { value: 0 }
  };

  // Load textures
  const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
  const textures = links.map(link => {
    const img = link.querySelector('[webgl-anime="image-src"]');
    if (!img) return null;
    const tex = new THREE.TextureLoader().load(img.src);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }).filter(t => t !== null);

  // Mesh
  const geometry = new THREE.PlaneGeometry(1, 1, SETTINGS.mesh.segments, SETTINGS.mesh.segments);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Mouse / transition state
  let offset = new THREE.Vector2(0, 0);
  let target = { x: 0, y: 0 };
  let currentIndex = -1;
  let transitioning = false;
  let fadingOut = false;

  // Link hover events
  links.forEach((link, idx) => {
    if (!textures[idx]) return;

    link.addEventListener("mouseenter", () => {
      uniforms.uPrevTexture.value = uniforms.uTexture.value;
      uniforms.uTexture.value = textures[idx];
      uniforms.uAlpha.value = 1;
      uniforms.uMixFactor.value = 0;
      currentIndex = idx;
      transitioning = true;
      fadingOut = false;

      const img = link.querySelector('[webgl-anime="image-src"]');
      if (img) {
        const aspect = img.naturalWidth / img.naturalHeight || 1;
        mesh.scale.set(SETTINGS.mesh.baseSize * aspect, SETTINGS.mesh.baseSize, 1);
      }
    });

    link.addEventListener("mouseleave", () => {
      fadingOut = true;
    });
  });

  // Mouse move
  wrapper.addEventListener("mousemove", e => {
    const rect = wrapper.getBoundingClientRect();
    target.x = e.clientX - rect.left;
    target.y = e.clientY - rect.top;
  });

  // Window resize
  window.addEventListener("resize", () => {
    const { clientWidth: w, clientHeight: h } = wrapper;
    camera.aspect = w / h;
    camera.fov = (180 * (2 * Math.atan(h / 2 / perspective))) / Math.PI;
    camera.updateProjectionMatrix();
  });

  // Update loop (called by global renderer)
  function update() {
    uniforms.uTime.value = Date.now() * 0.001;

    // Smooth mouse offset
    offset.x += (target.x - offset.x) * SETTINGS.deformation.smoothing;
    offset.y += (target.y - offset.y) * SETTINGS.deformation.smoothing;

    uniforms.uOffset.value.set(
      (target.x - offset.x) * SETTINGS.deformation.strength,
      -(target.y - offset.y) * SETTINGS.deformation.strength
    );

    uniforms.uRGBOffset.value.set(
      (target.x - offset.x) * 0.001,
      (target.y - offset.y) * 0.001
    );

    // Transition blending
    if (transitioning && uniforms.uMixFactor.value < 1) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed;
      if (uniforms.uMixFactor.value >= 1) {
        transitioning = false;
        uniforms.uPrevTexture.value = null;
      }
    }

    // Fade out
    if (fadingOut && uniforms.uAlpha.value > 0) {
      uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed;
      if (uniforms.uAlpha.value <= 0) {
        uniforms.uAlpha.value = 0;
        fadingOut = false;
      }
    }

    // Position mesh under mouse
    const rect = wrapper.getBoundingClientRect();
    mesh.position.set(
      offset.x - rect.width / 2 + mesh.scale.x / 2,
      rect.height / 2 - offset.y - mesh.scale.y / 2,
      0
    );
  }

  return { scene, camera, update };
}


/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Add all the effects to the function
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 

// Wait for DOM to be ready before adding effects
document.addEventListener('DOMContentLoaded', () => {
  // Add effects with a small delay to ensure all elements are loaded
  setTimeout(() => {
    window.WebGLEffects.addEffect(GridAnimeEffect);

    window.WebGLEffects.addEffect(HoverListEffect);
  }, 100);
});

// Also add effects immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  // DOM is still loading, the event listener above will handle it
} else {
  // DOM is already loaded
  setTimeout(() => {
    window.WebGLEffects.addEffect(GridAnimeEffect);

    window.WebGLEffects.addEffect(HoverListEffect);
  }, 100);
}
