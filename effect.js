"use strict";

import * as THREE from "three";

/*
=====================================================
   OPTIMIZED GLOBAL EFFECT MANAGER
=====================================================
*/
const DPR = Math.min(window.devicePixelRatio, 1.5);
const IS_MOBILE = window.innerWidth < 768;
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

window.WebGLEffects = (function () {
  const effects = [];
  let renderer, scene, camera;
  let currentTab = "Tab 1";
  let animationId = null;
  let scrollBlurEffect = null;
  let active = true;
  let needsRender = true;
  let lastFrameTime = 0;
  const TARGET_FPS = 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  function init() {
    if (REDUCED_MOTION) return;

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !IS_MOBILE,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(DPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;

    renderer.domElement.classList.add("global-webgl-canvas", "scroll-blur-canvas");
    Object.assign(renderer.domElement.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "1",
      pointerEvents: "none",
    });

    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    initScrollBlurEffect();
    initTabListener();

    active = true;
    needsRender = true;

    animate();
    
    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(onResize, 150);
    });
  }

  function initTabListener() {
    let current = getActiveTabFromDOM();

    const observer = new MutationObserver(() => {
      const next = getActiveTabFromDOM();
      if (!next || next === current) return;
      current = next;
      switchTab(next);
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function getActiveTabFromDOM() {
    const el = document.querySelector(".w-tab-link.w--current");
    return el?.getAttribute("data-w-tab") || null;
  }

  function switchTab(tab) {
    if (tab === currentTab) return;

    console.log("Switch →", tab);
    active = false;
    needsRender = true;

    cleanupEffects(currentTab);

    requestAnimationFrame(() => {
      currentTab = tab;
      initTabEffects(tab);
      active = true;
      needsRender = true;
    });
  }

  function cleanupEffects(tab) {
    if (tab === "Tab 1") {
      cleanupBulgeEffects();
    } else if (tab === "Tab 2") {
      cleanupListEffects();
    }
  }

  function cleanupBulgeEffects() {
    const canvases = document.querySelectorAll(".work-canvas");
    canvases.forEach((canvas) => canvas.remove());

    const images = document.querySelectorAll('[webgl-anime="image-hover"] img');
    images.forEach((img) => (img.style.opacity = "1"));
  }

  function cleanupListEffects() {
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].type === "list-hover") {
        if (effects[i].cleanup) effects[i].cleanup();
        effects.splice(i, 1);
      }
    }
  }

  function initTabEffects(tab) {
    if (tab === "Tab 1") {
      setTimeout(initBulgeEffects, 50);
    } else if (tab === "Tab 2") {
      const listEffect = HoverListEffect(renderer);
      if (listEffect) {
        listEffect.type = "list-hover";
        effects.push(listEffect);
      }
    }
  }

  function onResize() {
    if (!renderer) return;

    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    needsRender = true;
  }

  function addEffect(effectFn) {
    const effect = effectFn(renderer, scene, camera);
    if (!effect) return;
    effects.push(effect);
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate);

    if (!active) return;

    // Frame rate limiting
    const elapsed = time - lastFrameTime;
    if (elapsed < FRAME_INTERVAL && !needsRender) return;
    lastFrameTime = time;

    renderer.clear();

    if (scrollBlurEffect) {
      scrollBlurEffect.update(time);
      renderer.render(scrollBlurEffect.scene, scrollBlurEffect.camera);
    }

    effects.forEach((e) => {
      if (e.update) e.update(time);
      if (e.scene && e.camera) {
        renderer.render(e.scene, e.camera);
      }
    });

    needsRender = false;
  }

  init();

  return {
    addEffect,
    renderer,
    scene,
    camera,
    switchTab,
    getCurrentTab: () => currentTab,
    initTabEffects,
    scrollBlurEffect: () => scrollBlurEffect,
    requestRender: () => { needsRender = true; }
  };
})();

/*
=====================================================
   OPTIMIZED SCROLL BLUR EFFECT
=====================================================
*/
function initScrollBlurEffect() {
  if (REDUCED_MOTION) return null;
  if (!window.WebGLEffects) window.WebGLEffects = {};

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uScrollProgress;
    uniform float uScrollDir;
    uniform vec2 uResolution;
    varying vec2 vUv;
    
    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    void main() {
      vec2 st = vUv;
      st.y += uScrollDir * 0.2 * (1.0 - uScrollProgress); 
      
      float n = noise(st * 10.0 + uTime * 0.5);
      float blurAmount = smoothstep(0.0, 1.0, uScrollProgress);
      float grad = (uScrollDir > 0.0) ? st.y : (1.0 - st.y);

      vec3 color1 = vec3(0.1, 0.1, 0.2);
      vec3 color2 = vec3(0.05, 0.05, 0.1);
      
      vec3 finalColor = mix(color1, color2, grad);
      finalColor *= (1.0 - blurAmount * 0.8);

      float shimmer = sin(uTime * 2.0 + st.y * 10.0) * 0.1 * (1.0 - blurAmount);
      finalColor += shimmer;

      float reveal = smoothstep(0.3, 0.7, 1.0 - blurAmount + n * 0.1);
      gl_FragColor = vec4(finalColor, reveal * 0.4);
    }
  `;

  const uniforms = {
    uTime: { value: 0 },
    uScrollProgress: { value: 0 },
    uScrollDir: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let lastScroll = window.pageYOffset;
  let ticking = false;

  const updateScroll = () => {
    const scrolled = window.pageYOffset;
    const maxScroll = document.body.scrollHeight - window.innerHeight;

    uniforms.uScrollProgress.value = Math.min(scrolled / maxScroll, 1);
    uniforms.uScrollDir.value = scrolled > lastScroll ? 1.0 : -1.0;
    lastScroll = scrolled;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScroll);
      ticking = true;
    }
    window.WebGLEffects.requestRender();
  }, { passive: true });

  const update = (time) => {
    uniforms.uTime.value = time * 0.001;
  };

  const resize = () => {
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", resize);

  window.WebGLEffects.scrollBlurEffect = {
    scene,
    camera,
    update,
    cleanup: () => {
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
    },
  };

  return window.WebGLEffects.scrollBlurEffect;
}

/*
=====================================================
   OPTIMIZED HOVER LIST EFFECT
=====================================================
*/
function HoverListEffect(globalRenderer) {
  if (IS_MOBILE || REDUCED_MOTION) return null;

  const wrapper = document.querySelector("#tab-list-pane") || 
                  document.querySelector('[data-w-tab="Tab 2"]');
  if (!wrapper) return null;

  const SETTINGS = {
    deformation: { strength: 0.00055, smoothing: 0.05 },
    transition: { speed: 0.05, fadeInSpeed: 0.08, fadeOutSpeed: 0.06 },
    effects: { rgbSplit: 0.005, rgbAnimation: 0.5, rgbSpeed: 0.002 },
    mesh: { baseSize: 300, segments: 20 },
    mouse: { lerpFactor: 0.08, responsiveness: 0.6 },
  };

  const vertexShader = `
    uniform vec2 uOffset;
    varying vec2 vUv;
    const float M_PI = 3.141529;

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

  const camera = new THREE.PerspectiveCamera(
    (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, perspective);

  const uniforms = {
    uTexture: { value: null },
    uPrevTexture: { value: null },
    uAlpha: { value: 0.0 },
    uOffset: { value: new THREE.Vector2(0.0, 0.0) },
    uMixFactor: { value: 1.0 },
    uRGBOffset: { value: new THREE.Vector2(0.0, 0.0) },
    uTime: { value: 0.0 },
  };

  function loadTextures() {
    const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
    
    let textures = links.map((link) => {
      const img = link.querySelector('[webgl-anime="image-src"]');
      if (!img) return null;
      const tex = new THREE.TextureLoader().load(img.src);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    }).filter((tex) => tex !== null);

    if (textures.length === 0) {
      const fallbackLinks = [...wrapper.querySelectorAll(".portfolio20_item-link")];
      textures = fallbackLinks.map((item) => {
        const img = item.querySelector("img");
        if (!img) return null;
        const tex = new THREE.TextureLoader().load(img.src);
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
      }).filter((tex) => tex !== null);

      if (textures.length > 0) {
        links.length = 0;
        links.push(...fallbackLinks);
      }
    }

    return { links, textures };
  }

  const { links, textures } = loadTextures();

  const geometry = new THREE.PlaneGeometry(1, 1, SETTINGS.mesh.segments, SETTINGS.mesh.segments);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function lerp(start, end, t) {
    return start * (1.0 - t) + end * t;
  }

  links.forEach((link, idx) => {
    if (!textures[idx]) return;

    link.addEventListener("mouseenter", () => {
      uniforms.uPrevTexture.value = uniforms.uTexture.value;
      uniforms.uTexture.value = textures[idx];
      uniforms.uAlpha.value = 1.0;
      uniforms.uMixFactor.value = 0.0;

      currentIndex = idx;
      transitioning = true;
      fadingOut = false;

      const img = link.querySelector('[webgl-anime="image-src"]') || link.querySelector("img");
      if (img) {
        const aspect = img.naturalWidth / img.naturalHeight;
        mesh.scale.set(SETTINGS.mesh.baseSize * aspect, SETTINGS.mesh.baseSize, 1);
      }
      window.WebGLEffects.requestRender();
    });

    link.addEventListener("mouseleave", () => {
      fadingOut = true;
      window.WebGLEffects.requestRender();
    });
  });

  let mouseDirty = false;
  let rafId = null;

  wrapper.addEventListener("mousemove", (e) => {
    const rect = wrapper.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    
    if (!mouseDirty) {
      mouseDirty = true;
      window.WebGLEffects.requestRender();
    }
  });

  const resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resizeHandler);

  function update() {
    uniforms.uTime.value = performance.now() * 0.001;

    if (!mouseDirty && uniforms.uAlpha.value <= 0) return;
    mouseDirty = false;

    if (uniforms.uAlpha.value > 0 && currentIndex >= 0) {
      offset.x = lerp(offset.x, targetX, SETTINGS.mouse.lerpFactor);
      offset.y = lerp(offset.y, targetY, SETTINGS.mouse.lerpFactor);

      uniforms.uOffset.value.set(
        (targetX - offset.x) * SETTINGS.deformation.strength,
        -(targetY - offset.y) * SETTINGS.deformation.strength
      );
    }

    if (transitioning && uniforms.uMixFactor.value < 1.0) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed;
      window.WebGLEffects.requestRender();
    }

    if (fadingOut) {
      uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed;
      if (uniforms.uAlpha.value <= 0) {
        uniforms.uAlpha.value = 0;
      } else {
        window.WebGLEffects.requestRender();
      }
    }
  }

  const cleanup = () => {
    window.removeEventListener("resize", resizeHandler);
    scene.clear();
    geometry.dispose();
    material.dispose();
    textures.forEach((tex) => tex.dispose());
  };

  return { scene, camera, update, cleanup, type: "list-hover" };
}

/*
=====================================================
   OPTIMIZED BULGE EFFECTS FOR GRID
=====================================================
*/
function initBulgeEffects() {
  if (IS_MOBILE || REDUCED_MOTION) return;
  if (window.WebGLEffects.getCurrentTab() !== "Tab 1") return;

  const cards = Array.from(
    document.querySelectorAll('[data-w-tab="Tab 1"] [webgl-anime="image-hover"]')
  );

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

  cards.forEach((card, i) => {
    card.querySelectorAll(".work-canvas").forEach((el) => el.remove());

    const img = card.querySelector("img");
    if (!img) return;

    const texture = loader.load(img.src, () => {
      img.style.opacity = "0";
    });

    const width = card.offsetWidth;
    const height = card.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2, width / 2, height / 2, -height / 2, 0.1, 10
    );
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(DPR);

    renderer.domElement.classList.add("work-canvas");
    card.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(width, height, 1);
    scene.add(mesh);

    const cardData = {
      card, renderer, scene, camera, material, geometry, texture,
      animationId: null, isDirty: false
    };

    planes.push(cardData);

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      material.uniforms.uMouse.value.set(x, y);
      material.uniforms.uHover.value += (1.0 - material.uniforms.uHover.value) * 0.2;
      cardData.isDirty = true;
    });

    card.addEventListener("mouseleave", () => {
      cardData.isDirty = true;
    });

    function animate() {
      if (window.WebGLEffects.getCurrentTab() !== "Tab 1") return;
      requestAnimationFrame(animate);
      
      material.uniforms.uHover.value *= 0.97;
      
      if (cardData.isDirty || material.uniforms.uHover.value > 0.01) {
        renderer.render(scene, camera);
        cardData.isDirty = false;
      }
    }

    animate();

    const resizeHandler = () => {
      if (window.WebGLEffects.getCurrentTab() !== "Tab 1") return;

      const width = card.offsetWidth;
      const height = card.offsetHeight;
      renderer.setSize(width, height);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      mesh.scale.set(width, height, 1);
    };

    window.addEventListener("resize", resizeHandler);
    cardData.resizeHandler = resizeHandler;
  });

  window.currentBulgePlanes = planes;
}

function cleanupBulgeEffects() {
  if (window.currentBulgePlanes) {
    window.currentBulgePlanes.forEach((plane) => {
      if (plane.animationId) cancelAnimationFrame(plane.animationId);
      if (plane.resizeHandler) window.removeEventListener("resize", plane.resizeHandler);
      if (plane.geometry) plane.geometry.dispose();
      if (plane.material) plane.material.dispose();
      if (plane.texture) plane.texture.dispose();
      if (plane.renderer) plane.renderer.dispose();

      const canvas = plane.card.querySelector(".work-canvas");
      if (canvas) canvas.remove();

      const img = plane.card.querySelector("img");
      if (img) img.style.opacity = "1";
    });

    window.currentBulgePlanes = [];
  }
}

/*
=====================================================
   OPTIMIZED FOOTER GRID DISTORTION
=====================================================
*/
function initFooterBulgeEffect() {
  const footerSection = document.querySelector(".footer-section");
  const footerContainer = document.querySelector(".footer-bg");

  if (!footerSection || !footerContainer) return;

  const img = footerContainer.querySelector(".footer-bg-image");
  if (!img) return;

  const oldCanvas = footerContainer.querySelector(".footer-canvas");
  if (oldCanvas) oldCanvas.remove();

  const settings = {
    gridSize: 40.0,
    aberrationStrength: 0.01,
    distortionAmount: 0.25,
    easeFactor: 0.08,
  };

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(img.src, (texture) => {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const scene = new THREE.Scene();

    const containerWidth = footerContainer.offsetWidth;
    const containerHeight = footerContainer.offsetHeight;
    const containerRatio = containerWidth / containerHeight;

    const camera = new THREE.OrthographicCamera(-containerRatio, containerRatio, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.classList.add("footer-canvas");
    footerContainer.appendChild(renderer.domElement);

    const uniforms = {
      u_texture: { value: texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_aberrationIntensity: { value: 0 },
      u_time: { value: 0 },
      u_gridSize: { value: settings.gridSize },
      u_aberrationStrength: { value: settings.aberrationStrength },
      u_distortionAmount: { value: settings.distortionAmount },
      u_resolution: { value: new THREE.Vector2() },
    };

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
      uniform float u_gridSize;
      uniform float u_aberrationStrength;
      uniform float u_distortionAmount;
      uniform vec2 u_resolution;

      void main() {
        vec2 gridScale = vec2(u_gridSize);
        float aspect = u_resolution.x / u_resolution.y;
        gridScale.y *= aspect;

        vec2 gridUV = floor(vUv * gridScale) / gridScale;
        vec2 centerOfPixel = gridUV + vec2(0.5) / gridScale;

        vec2 mouseDir = u_mouse - u_prevMouse;
        vec2 pixelDir = centerOfPixel - u_mouse;
        float distance = length(pixelDir);
        float strength = smoothstep(0.3, 0.0, distance);

        vec2 uvOffset = strength * -mouseDir * u_distortionAmount;
        
        vec2 bulgeDir = vUv - u_mouse;
        float bulgeDist = length(bulgeDir);
        float bulgeStrength = smoothstep(0.4, 0.0, bulgeDist) * u_aberrationIntensity;
        
        vec2 bulgeOffset = bulgeDir * bulgeStrength * 0.15 * exp(-6.0 * bulgeDist * bulgeDist);
        
        vec2 uv = vUv - uvOffset + bulgeOffset;

        float totalStrength = max(strength, bulgeStrength);
        vec4 colorR = texture2D(u_texture, uv + vec2(totalStrength * u_aberrationIntensity * u_aberrationStrength, 0.0));
        vec4 colorG = texture2D(u_texture, uv);
        vec4 colorB = texture2D(u_texture, uv - vec2(totalStrength * u_aberrationIntensity * u_aberrationStrength, 0.0));

        gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);
      }
    `;

    const geometry = new THREE.PlaneGeometry(2 * imgRatio, 2);
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const mesh = new THREE.Mesh(geometry, material);

    let scaleX, scaleY;
    if (containerRatio > imgRatio) {
      scaleX = containerRatio / imgRatio;
      scaleY = 1;
    } else {
      scaleX = 1;
      scaleY = imgRatio / containerRatio;
    }

    mesh.scale.set(2 * imgRatio * scaleX, 2 * scaleY, 1);
    scene.add(mesh);

    let easeFactor = settings.easeFactor;
    let mouse = { x: 0.5, y: 0.5 };
    let target = { x: 0.5, y: 0.5 };
    let prev = { x: 0.5, y: 0.5 };
    let intensity = 0;
    let animationId;
    let isDirty = false;

    function resize() {
      const width = footerContainer.offsetWidth;
      const height = footerContainer.offsetHeight;

      renderer.setSize(width, height);
      renderer.domElement.style.width = `100%`;
      renderer.domElement.style.height = `100%`;

      const containerRatio = width / height;
      let scaleX, scaleY;

      if (containerRatio > imgRatio) {
        scaleX = containerRatio / imgRatio;
        scaleY = 1;
      } else {
        scaleX = 1;
        scaleY = imgRatio / containerRatio;
      }

      mesh.scale.set(2 * imgRatio * scaleX, 2 * scaleY, 1);

      camera.left = -containerRatio;
      camera.right = containerRatio;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();

      uniforms.u_resolution.value.set(width, height);
    }

    resize();

    function animate() {
      animationId = requestAnimationFrame(animate);
      
      mouse.x += (target.x - mouse.x) * easeFactor;
      mouse.y += (target.y - mouse.y) * easeFactor;

      uniforms.u_time.value = performance.now() * 0.001;
      uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y);
      uniforms.u_prevMouse.value.set(prev.x, 1.0 - prev.y);
      
      intensity = Math.max(0, intensity - 0.05);
      uniforms.u_aberrationIntensity.value = intensity;

      // Only render if there's activity
      if (isDirty || intensity > 0.01 || Math.abs(target.x - mouse.x) > 0.001) {
        renderer.render(scene, camera);
        isDirty = false;
      }
    }
    animate();

    function handleFooterMouseMove(e) {
      const rect = footerContainer.getBoundingClientRect();
      prev = { ...target };
      target.x = (e.clientX - rect.left) / rect.width;
      target.y = (e.clientY - rect.top) / rect.height;
      intensity = 1;
      isDirty = true;
    }

    function handleFooterMouseEnter(e) {
      const rect = footerContainer.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      target.x = mouse.x = x;
      target.y = mouse.y = y;
      isDirty = true;
    }

    function handleFooterMouseLeave() {
      easeFactor = 0.05;
      target = { ...prev };
      isDirty = true;
    }

    footerSection.addEventListener("mousemove", handleFooterMouseMove);
    footerSection.addEventListener("mouseenter", handleFooterMouseEnter);
    footerSection.addEventListener("mouseleave", handleFooterMouseLeave);

    function cleanup() {
      footerSection.removeEventListener("mousemove", handleFooterMouseMove);
      footerSection.removeEventListener("mouseenter", handleFooterMouseEnter);
      footerSection.removeEventListener("mouseleave", handleFooterMouseLeave);
      window.removeEventListener("resize", resize);

      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    }

    window.footerBulgeCleanup = cleanup;
    window.addEventListener("resize", resize);

    img.style.visibility = "hidden";
  });
}

let footerInit = false;

const footerObserver = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && !footerInit) {
      footerInit = true;
      initFooterBulgeEffect();
      footerObserver.disconnect();
    }
  },
  { rootMargin: "200px" }
);

const footer = document.querySelector(".footer-section");
if (footer) footerObserver.observe(footer);
