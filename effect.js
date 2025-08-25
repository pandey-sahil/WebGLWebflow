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
  if (!wrapper) {
    console.warn("HoverListEffect: No wrapper found");
    return null;
  }

  const SETTINGS = {
    deformation: { strength: 0.00055, smoothing: 0.1 },
    transition: { speed: 0.05, fadeInSpeed: 0.08, fadeOutSpeed: 0.06 },
    mesh: { baseSize: 300, segments: 20 }
  };

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

  const scene = new THREE.Scene();
  const perspective = 1000;
  let offset = new THREE.Vector2(0, 0);
  let targetX = 0, targetY = 0;
  let currentIndex = -1;
  let transitioning = false, fadingOut = false;
  let currentMeshPosition = new THREE.Vector3(0, 0, 0);

  // CAMERA - Fixed for viewport
  const camera = new THREE.PerspectiveCamera(
    (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, perspective);

  // UNIFORMS
  const uniforms = {
    uTexture: { value: null },
    uPrevTexture: { value: null },
    uAlpha: { value: 0.0 },
    uOffset: { value: new THREE.Vector2(0.0, 0.0) },
    uMixFactor: { value: 1.0 },
    uRGBOffset: { value: new THREE.Vector2(0.0, 0.0) },
    uTime: { value: 0.0 }
  };

  // LOAD textures
  const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
  const textures = links.map(link => {
    const img = link.querySelector('[webgl-anime="image-src"]');
    if (!img) return null;
    const tex = new THREE.TextureLoader().load(img.src);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }).filter(tex => tex !== null);

  // MESH
  const geometry = new THREE.PlaneGeometry(1, 1, SETTINGS.mesh.segments, SETTINGS.mesh.segments);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // LINK EVENTS
  links.forEach((link, idx) => {
    if (!textures[idx]) return;
    
    link.addEventListener("mouseenter", () => {
      console.log("Mouse entered link", idx);

      uniforms.uPrevTexture.value = uniforms.uTexture.value;
      uniforms.uTexture.value = textures[idx];
      uniforms.uAlpha.value = 1.0;
      uniforms.uMixFactor.value = 0.0;

      currentIndex = idx;
      transitioning = true;
      fadingOut = false;

      const img = link.querySelector('[webgl-anime="image-src"]');
      if (img) {
        // Get image dimensions and position
        const rect = img.getBoundingClientRect();
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const containerRatio = rect.width / rect.height;

        let meshWidth, meshHeight;
        if (containerRatio > imgRatio) {
          meshWidth = rect.width;
          meshHeight = rect.width / imgRatio;
        } else {
          meshHeight = rect.height;
          meshWidth = rect.height * imgRatio;
        }

        // Set mesh scale
        mesh.scale.set(meshWidth, meshHeight, 1);

        // FIXED POSITIONING: Convert screen coordinates to Three.js world coordinates
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        // Image center in screen coordinates
        const imageCenterX = rect.left + rect.width / 2;
        const imageCenterY = rect.top + rect.height / 2;
        
        // Convert to Three.js coordinates (relative to viewport center)
        const offsetX = imageCenterX - viewportCenterX;
        const offsetY = viewportCenterY - imageCenterY; // Y is flipped in Three.js
        
        // Store the base position
        currentMeshPosition.set(offsetX, offsetY, 0);
        mesh.position.copy(currentMeshPosition);
        
        console.log("Image positioned at:", offsetX, offsetY, "Screen rect:", rect);
      }
    });

    link.addEventListener("mouseleave", () => {
      fadingOut = true;
    });
  });

  // MOUSE MOVE - relative to wrapper
  wrapper.addEventListener("mousemove", (e) => {
    const rect = wrapper.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  });

  // RESIZE HANDLER
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
    camera.updateProjectionMatrix();
  });

  function update() {
    uniforms.uTime.value = Date.now() * 0.001;

    // Only apply deformation when mesh is visible
    if (uniforms.uAlpha.value > 0) {
      // Smooth mouse offset for deformation
      offset.x += (targetX - offset.x) * SETTINGS.deformation.smoothing;
      offset.y += (targetY - offset.y) * SETTINGS.deformation.smoothing;

      // Apply deformation offsets
      uniforms.uOffset.value.set(
        (targetX - offset.x) * SETTINGS.deformation.strength,
        -(targetY - offset.y) * SETTINGS.deformation.strength
      );

      uniforms.uRGBOffset.value.set(
        (targetX - offset.x) * 0.001,
        (targetY - offset.y) * 0.001
      );

      // Keep mesh at its base position (don't move it around)
      mesh.position.copy(currentMeshPosition);
    }

    // Handle texture transitions
    if (transitioning && uniforms.uMixFactor.value < 1.0) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed;
      if (uniforms.uMixFactor.value >= 1.0) {
        transitioning = false;
        uniforms.uPrevTexture.value = null;
      }
    }

    // Handle fade out
    if (fadingOut && uniforms.uAlpha.value > 0.0) {
      uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed;
      if (uniforms.uAlpha.value <= 0.0) {
        uniforms.uAlpha.value = 0.0;
        fadingOut = false;
        currentIndex = -1;
      }
    }
  }

  return { scene, camera, update };
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Buldge Effect
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰

function CardHoverEffect(renderer) {
  const wrappers = Array.from(document.querySelectorAll('[webgl-anime="image-hover"]'));
  console.log("CardHoverEffect: Found wrappers", wrappers.length);

  const loader = new THREE.TextureLoader();
  const planes = [];

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform sampler2D uTexture;
    uniform vec2 uMouse;
    uniform float uHover;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      vec2 diff = uv - uMouse;
      float dist = length(diff);
      uv -= diff * 0.25 * uHover * exp(-3.0*dist*dist);
      vec4 color = texture2D(uTexture, uv);
      float glow = exp(-3.0*dist*dist) * 0.25;
      color.rgb += glow;
      gl_FragColor = color;
    }
  `;

  // Init planes for each wrapper
  wrappers.forEach((wrapper, idx) => {
    const img = wrapper.querySelector('img');
    if (!img) {
      console.warn("CardHoverEffect: No img found in wrapper", idx);
      return;
    }

    console.log("CardHoverEffect: Loading image for wrapper", idx, img.src);
    const texture = loader.load(img.src);

    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uMouse: { value: new THREE.Vector2(-1, -1) },
        uHover: { value: 0 }
      },
      vertexShader,
      fragmentShader
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    planes.push({ wrapper, scene, camera, mesh, material });

    wrapper.addEventListener('mousemove', e => {
      const rect = wrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      material.uniforms.uMouse.value.set(x, y);
      material.uniforms.uHover.value += (1.0 - material.uniforms.uHover.value) * 0.1;
      // console.log(`Wrapper ${idx} mousemove: x=${x} y=${y} hover=${material.uniforms.uHover.value}`);
    });

    wrapper.addEventListener('mouseleave', () => {
      // decay handled in update
      // console.log("Wrapper", idx, "mouseleave");
    });
  });

  // Update function called per frame
 
  // Update function for CardHoverEffect - replace your existing update function
return {
  update: () => {
    planes.forEach((p, idx) => {
      const rect = p.wrapper.getBoundingClientRect();

      // FIXED: Convert screen coordinates to NDC properly
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      
      // Center of wrapper in screen coordinates
      const wrapperCenterX = rect.left + rect.width / 2;
      const wrapperCenterY = rect.top + rect.height / 2;
      
      // Convert to normalized device coordinates (-1 to 1)
      const ndcX = (wrapperCenterX - viewportCenterX) / viewportCenterX;
      const ndcY = (viewportCenterY - wrapperCenterY) / viewportCenterY;

      // Scale relative to viewport
      const scaleX = (rect.width / window.innerWidth) * 2;
      const scaleY = (rect.height / window.innerHeight) * 2;

      p.mesh.position.set(ndcX, ndcY, 0);
      p.mesh.scale.set(scaleX, scaleY, 1);

      // Hover decay
      p.material.uniforms.uHover.value *= 0.9;

      // Render each card's scene
      renderer.render(p.scene, p.camera);
    });
  }
};
}
*/ 
function initBludge() {
  console.log("initBludge called");

  const cards = Array.from(
    document.querySelectorAll('[webgl-anime="image-hover"]')
  );
  console.log("Cards found:", cards.length);

  const loader = new THREE.TextureLoader();
  const planes = [];

  // Shader code
  const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`;

  const fragmentShader = `
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform float uHover;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec2 diff = uv - uMouse;
  float dist = length(diff);
  uv -= diff * 0.25 * uHover * exp(-3.0*dist*dist);
  vec4 color = texture2D(uTexture, uv);
  float glow = exp(-3.0*dist*dist) * 0.25;
  color.rgb += glow;
  gl_FragColor = color;
}
`;

  cards.forEach((card, i) => {
    console.log("Processing card:", i);

    // remove old canvases if they exist
    card.querySelectorAll(".work-canvas").forEach(el => {
      console.log("Removed old canvas from card", i);
      el.remove();
    });

    const img = card.querySelector("img");
    if (!img) {
      console.warn("No image found in card", i);
      return;
    }

    const texture = loader.load(img.src, () => {
      console.log("Texture loaded for card", i);
      img.style.opacity = "0"; // hide original image once texture is ready
    });

    const width = card.offsetWidth;
    const height = card.offsetHeight;

    // Scene, camera, renderer per card
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      10
    );
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add class
    renderer.domElement.classList.add("work-canvas");
    card.appendChild(renderer.domElement);
    console.log("Added canvas to card", i);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) }, // start centered
        uHover: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    // Plane at unit scale, then scale to card size
    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(width, height, 1);
    scene.add(mesh);

    planes.push({ card, renderer, scene, camera, material });

    // Mouse move
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      material.uniforms.uMouse.value.set(x, y);
      material.uniforms.uHover.value +=
        (1.0 - material.uniforms.uHover.value) * 0.2;
    });

    card.addEventListener("mouseleave", () => {
      console.log("Mouse left card", i);
    });

    function animate() {
      requestAnimationFrame(animate);
      material.uniforms.uHover.value *= 0.97; // slower fade so it’s visible
      renderer.render(scene, camera);
    }
    animate();

    // Responsive
    window.addEventListener("resize", () => {
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      renderer.setSize(width, height);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      mesh.scale.set(width, height, 1);
      console.log("Resized card", i);
    });
  });
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Attach effects on load
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    console.log("DOMContentLoaded init");
    initBludge();
    // window.WebGLEffects.addEffect(CardHoverEffect);
    window.WebGLEffects.addEffect(HoverListEffect);
  }, 100);
});

if (document.readyState !== "loading") {
  setTimeout(() => {
    console.log("Page already loaded, init immediately");
    initBludge();
    // window.WebGLEffects.addEffect(CardHoverEffect);
    window.WebGLEffects.addEffect(HoverListEffect);
  }, 100);
}

