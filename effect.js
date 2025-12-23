"use strict";

import * as THREE from "three";

/*
=====================================================
   GLOBAL EFFECT MANAGER WITH TAB SUPPORT
=====================================================
*/
const DPR = Math.min(window.devicePixelRatio, 1.5);
const IS_MOBILE = window.innerWidth < 768;
const REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

window.WebGLEffects = (function () {
   
  const effects = [];
  let renderer, scene, camera;
  let currentTab = "Tab 1"; // Default to grid view
  let animationId = null;
  let scrollBlurEffect = null;
  let active = true;
  let needsRender = true;

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

    renderer.domElement.classList.add(
      "global-webgl-canvas",
      "scroll-blur-canvas"
    );
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
    window.WebGLEffects?.requestRender();

    animate();
    window.addEventListener("resize", onResize);
  }

  function initTabListener() {
    let current = getActiveTabFromDOM();

    const observer = new MutationObserver(() => {
      const next = getActiveTabFromDOM();
      if (!next || next === current) return;

      current = next;
      window.WebGLEffects.switchTab(next);
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

    // stop everything
    active = false;
    window.WebGLEffects?.requestRender();

    cleanupEffects(currentTab);

    // allow Webflow layout to settle
    requestAnimationFrame(() => {
      currentTab = tab;
      initTabEffects(tab);
      active = true;
      window.WebGLEffects?.requestRender();
    });
  }

  function cleanupEffects(tab) {
    if (tab === "Tab 1") {
      // Clean up bulge effects
      cleanupBulgeEffects();
    } else if (tab === "Tab 2") {
      // Clean up list effects
      cleanupListEffects();
    }
  }

  function cleanupBulgeEffects() {
    console.log("Cleaning up bulge effects");
    const canvases = document.querySelectorAll(".work-canvas");
    canvases.forEach((canvas) => canvas.remove());

    // Reset image opacity
    const images = document.querySelectorAll('[webgl-anime="image-hover"] img');
    images.forEach((img) => (img.style.opacity = "1"));
  }

  function cleanupListEffects() {
    console.log("Cleaning up list effects");
    // Remove list-specific effects from the global effects array
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].type === "list-hover") {
        if (effects[i].cleanup) {
          effects[i].cleanup();
        }
        effects.splice(i, 1);
      }
    }
  }

  function initTabEffects(tab) {
    console.log("Initializing effects for tab:", tab);

    if (tab === "Tab 1") {
      // Initialize bulge effects
      setTimeout(() => {
        initBulgeEffects();
      }, 50);
    } else if (tab === "Tab 2") {
      // Initialize list effects
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

    window.WebGLEffects?.requestRender();
  }

  function addEffect(effectFn) {
    const effect = effectFn(renderer, scene, camera);
    if (!effect) return; // gracefully skip if it didn't init
    effects.push(effect);
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate);

    if (!active || !needsRender) return;

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
    requestRender: () => {
      needsRender = true;
    }
  };
})();


/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Progressive Blur Scroll Effect for Section Reveals
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
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
    uniform float uScrollDir; // +1 = down, -1 = up
    uniform vec2 uResolution;
    varying vec2 vUv;
    
    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    void main() {
      vec2 st = vUv;
      
      // shift blur vertically based on scroll direction
      st.y += uScrollDir * 0.2 * (1.0 - uScrollProgress); 
      
      float n = noise(st * 10.0 + uTime * 0.5);
      float blurAmount = smoothstep(0.0, 1.0, uScrollProgress);

      // directional gradient (top vs bottom)
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
    uScrollDir: { value: 1.0 }, // start assuming scrolling down
    uResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
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
  const updateScroll = () => {
    const scrolled = window.pageYOffset;
    const maxScroll = document.body.scrollHeight - window.innerHeight;

    // update scroll progress
    uniforms.uScrollProgress.value = Math.min(scrolled / maxScroll, 1);

    // detect direction
    uniforms.uScrollDir.value = scrolled > lastScroll ? 1.0 : -1.0;
    lastScroll = scrolled;
  };

  window.addEventListener(
    "scroll",
    () => {
      updateScroll();
      window.WebGLEffects?.requestRender();
    },
    { passive: true }
  );

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
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
    },
  };

  return window.WebGLEffects.scrollBlurEffect;
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Enhanced Hover List Effect Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function HoverListEffect(globalRenderer) {
  if (IS_MOBILE || REDUCED_MOTION) return null;

  // Only initialize if we're on the list tab
  console.log("Active tab:", getActiveTabFromDOM());

  // Look for the actual tab content div that contains the list items
  const wrapper =
    document.querySelector("#tab-list-pane") ||
    document.querySelector('[data-w-tab="Tab 2"]');
  if (!wrapper) {
    console.warn("HoverListEffect: No Tab 2 wrapper found");
    return null;
  }

  console.log("Initializing Enhanced HoverListEffect for Tab 2", wrapper);

  // Enhanced settings for smoother following
  const SETTINGS = {
    deformation: {
      strength: 0.00055,
      smoothing: 0.05, // Made much smoother (reduced from 0.1)
    },
    transition: {
      speed: 0.05,
      fadeInSpeed: 0.08,
      fadeOutSpeed: 0.06,
    },
    effects: {
      rgbSplit: 0.005,
      rgbAnimation: 0.5,
      rgbSpeed: 0.002,
    },
    mesh: {
      baseSize: 300,
      segments: 20,
    },
    mouse: {
      lerpFactor: 0.08, // Smooth mouse following
      responsiveness: 0.6, // How much the effect responds to movement
    },
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
        // Ripple effect for RGB offset
        vec2 center = vec2(0.5, 0.5);
        float distance = length(vUv - center);
        float ripple = sin(distance * 20.0 - uTime * 5.0) * 0.02;
        
        // RGB split with ripple effect
        float offsetStrength = 0.01;
        vec2 rippleOffset = uRGBOffset + vec2(ripple);
        
        // RGB split sampling with ripple
        vec4 texR = texture2D(uTexture, vUv + rippleOffset * offsetStrength);
        vec4 texG = texture2D(uTexture, vUv);
        vec4 texB = texture2D(uTexture, vUv - rippleOffset * offsetStrength);
        
        vec3 newColor = vec3(texR.r, texG.g, texB.b);

        // Previous texture with same RGB split ripple
        vec4 prevTexR = texture2D(uPrevTexture, vUv + rippleOffset * offsetStrength);
        vec4 prevTexG = texture2D(uPrevTexture, vUv);
        vec4 prevTexB = texture2D(uPrevTexture, vUv - rippleOffset * offsetStrength);
        
        vec3 prevColor = vec3(prevTexR.r, prevTexG.g, prevTexB.b);

        // crossfade between previous and new texture
        vec3 finalColor = mix(prevColor, newColor, uMixFactor);

        gl_FragColor = vec4(finalColor, uAlpha);
    }
  `;

  const scene = new THREE.Scene();
  const perspective = 1000;
  let offset = new THREE.Vector2(0, 0);
  let targetX = 0,
    targetY = 0;
  let currentIndex = -1;
  let transitioning = false,
    fadingOut = false;

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
    uTime: { value: 0.0 },
  };

  // Enhanced texture loading with better fallbacks
  function loadTextures() {
    const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
    console.log("Found list items:", links.length);

    let textures = links
      .map((link, idx) => {
        const img = link.querySelector('[webgl-anime="image-src"]');
        if (!img) {
          console.warn("No image found for list item", idx);
          return null;
        }
        console.log("Loading texture for item", idx, img.src);
        const tex = new THREE.TextureLoader().load(
          img.src,
          () => console.log("Texture loaded successfully for item", idx),
          undefined,
          (err) => console.error("Failed to load texture for item", idx, err)
        );
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
      })
      .filter((tex) => tex !== null);

    // Fallback if no textures found
    if (textures.length === 0) {
      console.log(
        "No textures loaded with webgl-anime attributes, trying fallback..."
      );
      const fallbackLinks = [
        ...wrapper.querySelectorAll(".portfolio20_item-link"),
      ];
      console.log("Found fallback portfolio items:", fallbackLinks.length);

      textures = fallbackLinks
        .map((item, idx) => {
          const img = item.querySelector("img");
          if (!img) return null;
          console.log("Loading fallback texture for item", idx, img.src);
          const tex = new THREE.TextureLoader().load(img.src);
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          return tex;
        })
        .filter((tex) => tex !== null);

      // Update links array if fallback worked
      if (textures.length > 0) {
        links.length = 0;
        links.push(...fallbackLinks);
      }
    }

    return { links, textures };
  }

  const { links, textures } = loadTextures();
  console.log("Final loaded textures:", textures.length);

  // MESH
  const geometry = new THREE.PlaneGeometry(
    1,
    1,
    SETTINGS.mesh.segments,
    SETTINGS.mesh.segments
  );
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Lerp function for smooth transitions
  function lerp(start, end, t) {
    return start * (1.0 - t) + end * t;
  }

  // ENHANCED LINK EVENTS
  links.forEach((link, idx) => {
    if (!textures[idx]) {
      console.warn("No texture for link", idx);
      return;
    }

    console.log("Setting up enhanced events for link", idx, link);

    link.addEventListener("mouseenter", () => {
      console.log("Mouse entered link", idx);

      uniforms.uPrevTexture.value = uniforms.uTexture.value;
      uniforms.uTexture.value = textures[idx];
      uniforms.uAlpha.value = 1.0;
      uniforms.uMixFactor.value = 0.0;

      currentIndex = idx;
      transitioning = true;
      fadingOut = false;

      // Enhanced image scaling based on aspect ratio
      const img =
        link.querySelector('[webgl-anime="image-src"]') ||
        link.querySelector("img");
      if (img) {
        const aspect = img.naturalWidth / img.naturalHeight;
        mesh.scale.set(
          SETTINGS.mesh.baseSize * aspect,
          SETTINGS.mesh.baseSize,
          1
        );
        console.log(
          "Enhanced scaling applied:",
          SETTINGS.mesh.baseSize * aspect,
          SETTINGS.mesh.baseSize
        );
      }
    });

    link.addEventListener("mouseleave", () => {
      console.log("Mouse left link", idx);
      fadingOut = true;
    });
  });

  // ENHANCED MOUSE MOVE - Better tracking within wrapper
  let mouseDirty = false;

  wrapper.addEventListener("mousemove", (e) => {
    mouseDirty = true;
    const rect = wrapper.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    window.WebGLEffects?.requestRender();
  });

  // RESIZE HANDLER
  const resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov =
      (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
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
    }

    if (fadingOut) {
  uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed;
  if (uniforms.uAlpha.value <= 0) {
    uniforms.uAlpha.value = 0;
  }
}

  }

  // Cleanup function
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
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Bulge Effect for Grid Tab
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initBulgeEffects() {
  if (IS_MOBILE || REDUCED_MOTION) {
    console.log("Skipping bulge effects");
    return;
  }

  console.log("initBulgeEffects called");

  // Only run if we're on the grid tab
  if (window.WebGLEffects.getCurrentTab() !== "Tab 1") {
    console.log("Skipping bulge effect - wrong tab");
    return;
  }

  const cards = Array.from(
    document.querySelectorAll(
      '[data-w-tab="Tab 1"] [webgl-anime="image-hover"]'
    )
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
    card.querySelectorAll(".work-canvas").forEach((el) => {
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
    renderer.setPixelRatio(DPR);

    // Add class
    renderer.domElement.classList.add("work-canvas");
    card.appendChild(renderer.domElement);
    console.log("Added canvas to card", i);

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

    let animationId;

    const cardData = {
      card,
      renderer,
      scene,
      camera,
      material,
      geometry,
      texture,
      animationId: null,
    };

    planes.push(cardData);

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
      if (window.WebGLEffects.getCurrentTab() !== "Tab 1") return;
      requestAnimationFrame(animate);
      material.uniforms.uHover.value *= 0.97;
      renderer.render(scene, camera);
    }

    animate();

    // Responsive
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
      console.log("Resized card", i);
    };

    window.addEventListener("resize", resizeHandler);

    // Store resize handler for cleanup
    cardData.resizeHandler = resizeHandler;
  });

  // Store planes globally for cleanup
  window.currentBulgePlanes = planes;
}

// Cleanup function for bulge effects
function cleanupBulgeEffects() {
  if (window.currentBulgePlanes) {
    window.currentBulgePlanes.forEach((plane, i) => {
      console.log("Cleaning up plane", i);

      // Cancel animation
      if (plane.animationId) {
        cancelAnimationFrame(plane.animationId);
      }

      // Remove event listeners
      if (plane.resizeHandler) {
        window.removeEventListener("resize", plane.resizeHandler);
      }

      // Dispose resources
      if (plane.geometry) plane.geometry.dispose();
      if (plane.material) plane.material.dispose();
      if (plane.texture) plane.texture.dispose();
      if (plane.renderer) plane.renderer.dispose();

      // Remove canvas
      const canvas = plane.card.querySelector(".work-canvas");
      if (canvas) canvas.remove();

      // Show original image
      const img = plane.card.querySelector("img");
      if (img) img.style.opacity = "1";
    });

    window.currentBulgePlanes = [];
  }
}


/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Footer Grid Distortion Effect (Based on webgl-grid-anime)
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initFooterBulgeEffect() {
  console.log("🎨 Initializing Footer Grid Effect");

  const footerSection = document.querySelector(".footer-section");
  const footerContainer = document.querySelector(".footer-bg");

  if (!footerSection || !footerContainer) {
    console.warn("Footer elements not found");
    return;
  }

  const img = footerContainer.querySelector(".footer-bg-image");
  if (!img) {
    console.warn("Footer background image not found");
    return;
  }

  // Remove old canvas if exists
  const oldCanvas = footerContainer.querySelector(".footer-canvas");
  if (oldCanvas) oldCanvas.remove();

  // Settings for the effect
  const settings = {
    gridSize: 40.0,
    aberrationStrength: 0.01,
    distortionAmount: 0.25,
    easeFactor: 0.08,
  };

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(img.src, (texture) => {
    console.log("🖼️ Footer texture loaded");

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const scene = new THREE.Scene();

    // Use container aspect ratio for camera
    const containerWidth = footerContainer.offsetWidth;
    const containerHeight = footerContainer.offsetHeight;
    const containerRatio = containerWidth / containerHeight;

    const camera = new THREE.OrthographicCamera(
      -containerRatio,
      containerRatio,
      1,
      -1,
      0.1,
      10
    );
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

        // Grid-based distortion (original effect)
        vec2 mouseDir = u_mouse - u_prevMouse;
        vec2 pixelDir = centerOfPixel - u_mouse;
        float distance = length(pixelDir);
        float strength = smoothstep(0.3, 0.0, distance);

        vec2 uvOffset = strength * -mouseDir * u_distortionAmount;
        
        // Add bulge effect
        vec2 bulgeDir = vUv - u_mouse;
        float bulgeDist = length(bulgeDir);
        float bulgeStrength = smoothstep(0.4, 0.0, bulgeDist) * u_aberrationIntensity;
        
        // Bulge distortion - push pixels away from mouse
        vec2 bulgeOffset = bulgeDir * bulgeStrength * 0.15 * exp(-6.0 * bulgeDist * bulgeDist);
        
        // Combine both effects
        vec2 uv = vUv - uvOffset + bulgeOffset;

        // Chromatic aberration with both effects
        float totalStrength = max(strength, bulgeStrength);
        vec4 colorR = texture2D(u_texture, uv + vec2(totalStrength * u_aberrationIntensity * u_aberrationStrength, 0.0));
        vec4 colorG = texture2D(u_texture, uv);
        vec4 colorB = texture2D(u_texture, uv - vec2(totalStrength * u_aberrationIntensity * u_aberrationStrength, 0.0));

        gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);
      }
    `;

    const geometry = new THREE.PlaneGeometry(2 * imgRatio, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Calculate initial cover scaling
    let scaleX, scaleY;

    if (containerRatio > imgRatio) {
      // Container is wider than image - scale to width
      scaleX = containerRatio / imgRatio;
      scaleY = 1;
    } else {
      // Container is taller than image - scale to height
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

    function resize() {
      const width = footerContainer.offsetWidth;
      const height = footerContainer.offsetHeight;

      // Set canvas to full container size
      renderer.setSize(width, height);
      renderer.domElement.style.width = `100%`;
      renderer.domElement.style.height = `100%`;

      // Calculate cover scaling for the image
      const containerRatio = width / height;
      let scaleX, scaleY;

      if (containerRatio > imgRatio) {
        // Container is wider than image - scale to width
        scaleX = containerRatio / imgRatio;
        scaleY = 1;
      } else {
        // Container is taller than image - scale to height
        scaleX = 1;
        scaleY = imgRatio / containerRatio;
      }

      // Update geometry scale for cover behavior
      mesh.scale.set(2 * imgRatio * scaleX, 2 * scaleY, 1);

      // Update camera for new aspect ratio
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

      renderer.render(scene, camera);
    }
    animate();

    // Footer section event handlers
    function handleFooterMouseMove(e) {
      const rect = footerContainer.getBoundingClientRect();
      prev = { ...target };
      target.x = (e.clientX - rect.left) / rect.width;
      target.y = (e.clientY - rect.top) / rect.height;
      intensity = 1;
    }

    function handleFooterMouseEnter(e) {
      const rect = footerContainer.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      target.x = mouse.x = x;
      target.y = mouse.y = y;
    }

    function handleFooterMouseLeave() {
      console.log("🌊 Mouse left footer section");
      easeFactor = 0.05;
      target = { ...prev };
    }

    // Add event listeners to footer section
    footerSection.addEventListener("mousemove", handleFooterMouseMove);
    footerSection.addEventListener("mouseenter", handleFooterMouseEnter);
    footerSection.addEventListener("mouseleave", handleFooterMouseLeave);

    // Cleanup function
    function cleanup() {
      console.log("🧹 Cleaning up footer grid effect");
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

    // Hide original image
    img.style.visibility = "hidden";

    console.log("✅ Footer grid effect initialized successfully!");
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
