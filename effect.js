import * as THREE from 'three';

/*
=====================================================
   GLOBAL EFFECT MANAGER WITH TAB SUPPORT
=====================================================
*/
window.WebGLEffects = (function () {
  const effects = [];
  let renderer, scene, camera;
  let currentTab = 'Tab 1'; // Default to grid view
  let animationId = null;
  let scrollBlurEffect = null;

  function init() {
    // Shared renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // add class and styling before appending
    renderer.domElement.classList.add("global-webgl-canvas");
    renderer.domElement.classList.add("scroll-blur-canvas"); 
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.zIndex = "1"; // Lower z-index to not interfere with other animations
    renderer.domElement.style.pointerEvents = "none";
    document.body.appendChild(renderer.domElement);

    // Shared scene + camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    // Initialize scroll blur effect
    initScrollBlurEffect();
    
    animate();
    window.addEventListener("resize", onResize);
    
    // Listen for tab changes
    initTabListener();
    
    console.log('Global WebGL renderer initialized with scroll blur');
  }

  function initTabListener() {
    // Listen for tab clicks
    document.addEventListener('click', (e) => {
      const tabLink = e.target.closest('[data-w-tab]');
      if (tabLink) {
        const newTab = tabLink.getAttribute('data-w-tab');
        if (newTab !== currentTab) {
          console.log('Tab changed from', currentTab, 'to', newTab);
          switchTab(newTab);
        }
      }
    });

    // Also check for initial active tab
    const activeTab = document.querySelector('.w-tab-link.w--current');
    if (activeTab) {
      currentTab = activeTab.getAttribute('data-w-tab') || 'Tab 1';
      console.log('Initial tab:', currentTab);
    }

    // Also listen for Webflow's tab change events
    document.addEventListener('w-tab-change', (e) => {
      console.log('Webflow tab change detected', e.detail);
      if (e.detail && e.detail.tab !== currentTab) {
        switchTab(e.detail.tab);
      }
    });
  }

  function switchTab(newTab) {
    const oldTab = currentTab;
    currentTab = newTab;
    
    // Clean up old effects
    cleanupEffects(oldTab);
    
    // Initialize new effects after a short delay to let DOM update
    setTimeout(() => {
      initTabEffects(newTab);
    }, 100);
  }

  function cleanupEffects(tab) {
    if (tab === 'Tab 1') {
      // Clean up bulge effects
      cleanupBulgeEffects();
    } else if (tab === 'Tab 2') {
      // Clean up list effects
      cleanupListEffects();
    }
  }

  function cleanupBulgeEffects() {
    console.log('Cleaning up bulge effects');
    const canvases = document.querySelectorAll('.work-canvas');
    canvases.forEach(canvas => canvas.remove());
    
    // Reset image opacity
    const images = document.querySelectorAll('[webgl-anime="image-hover"] img');
    images.forEach(img => img.style.opacity = '1');
  }

  function cleanupListEffects() {
    console.log('Cleaning up list effects');
    // Remove list-specific effects from the global effects array
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].type === 'list-hover') {
        if (effects[i].cleanup) {
          effects[i].cleanup();
        }
        effects.splice(i, 1);
      }
    }
  }

  function initTabEffects(tab) {
    console.log('Initializing effects for tab:', tab);
    
    if (tab === 'Tab 1') {
      // Initialize bulge effects
      setTimeout(() => {
        initBulgeEffects();
      }, 50);
    } else if (tab === 'Tab 2') {
      // Initialize list effects
      const listEffect = HoverListEffect(renderer);
      if (listEffect) {
        listEffect.type = 'list-hover';
        effects.push(listEffect);
      }
    }
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
    animationId = requestAnimationFrame(animate);
    
    // Always render scroll blur effect (global background)
    if (scrollBlurEffect) {
      scrollBlurEffect.update(time);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scrollBlurEffect.scene, scrollBlurEffect.camera);
    }
    
    // Render tab-specific effects on top
    if (currentTab === 'Tab 2') {
      // Update and render list effects
      effects.forEach((e) => {
        if (e.update) e.update(time);
        if (e.scene && e.camera && e.type === 'list-hover') {
          renderer.render(e.scene, e.camera);
        }
      });
    }
  }

  init();

  // Expose the renderer so effects can use it
  return { 
    addEffect, 
    renderer, 
    scene, 
    camera, 
    switchTab,
    getCurrentTab: () => currentTab,
    initTabEffects,
    scrollBlurEffect: () => scrollBlurEffect
  };
})();

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Progressive Blur Scroll Effect for Section Reveals
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initScrollBlurEffect() {
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
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.NormalBlending
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
    uniforms.uScrollDir.value = (scrolled > lastScroll) ? 1.0 : -1.0;
    lastScroll = scrolled;
  };

  window.addEventListener("scroll", updateScroll, { passive: true });

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
    }
  };

  return window.WebGLEffects.scrollBlurEffect;
}


/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Enhanced Hover List Effect Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 
function HoverListEffect(globalRenderer) {
  // Only initialize if we're on the list tab
  if (window.WebGLEffects.getCurrentTab() !== 'Tab 2') {
    console.log('Skipping list effect - wrong tab');
    return null;
  }

  // Look for the actual tab content div that contains the list items
  const wrapper = document.querySelector('#tab-list-pane') || document.querySelector('[data-w-tab="Tab 2"]');
  if (!wrapper) {
    console.warn("HoverListEffect: No Tab 2 wrapper found");
    return null;
  }

  console.log('Initializing Enhanced HoverListEffect for Tab 2', wrapper);

  // Enhanced settings for smoother following
  const SETTINGS = {
    deformation: {
      strength: 0.00055,  
      smoothing: 0.05     // Made much smoother (reduced from 0.1)
    },
    transition: {
      speed: 0.05,
      fadeInSpeed: 0.08,
      fadeOutSpeed: 0.06
    },
    effects: {
      rgbSplit: 0.005,
      rgbAnimation: 0.5,
      rgbSpeed: 0.002
    },
    mesh: {
      baseSize: 300,
      segments: 20
    },
    mouse: {
      lerpFactor: 0.08,    // Smooth mouse following
      responsiveness: 0.6   // How much the effect responds to movement
    }
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
  let targetX = 0, targetY = 0;
  let currentIndex = -1;
  let transitioning = false, fadingOut = false;

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

  // Enhanced texture loading with better fallbacks
  function loadTextures() {
    const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
    console.log('Found list items:', links.length);
    
    let textures = links.map((link, idx) => {
      const img = link.querySelector('[webgl-anime="image-src"]');
      if (!img) {
        console.warn('No image found for list item', idx);
        return null;
      }
      console.log('Loading texture for item', idx, img.src);
      const tex = new THREE.TextureLoader().load(img.src, 
        () => console.log('Texture loaded successfully for item', idx),
        undefined,
        (err) => console.error('Failed to load texture for item', idx, err)
      );
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    }).filter(tex => tex !== null);

    // Fallback if no textures found
    if (textures.length === 0) {
      console.log('No textures loaded with webgl-anime attributes, trying fallback...');
      const fallbackLinks = [...wrapper.querySelectorAll('.portfolio20_item-link')];
      console.log('Found fallback portfolio items:', fallbackLinks.length);
      
      textures = fallbackLinks.map((item, idx) => {
        const img = item.querySelector('img');
        if (!img) return null;
        console.log('Loading fallback texture for item', idx, img.src);
        const tex = new THREE.TextureLoader().load(img.src);
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
      }).filter(tex => tex !== null);
      
      // Update links array if fallback worked
      if (textures.length > 0) {
        links.length = 0;
        links.push(...fallbackLinks);
      }
    }

    return { links, textures };
  }

  const { links, textures } = loadTextures();
  console.log('Final loaded textures:', textures.length);

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

  // Lerp function for smooth transitions
  function lerp(start, end, t) {
    return start * (1.0 - t) + end * t;
  }

  // ENHANCED LINK EVENTS
  links.forEach((link, idx) => {
    if (!textures[idx]) {
      console.warn('No texture for link', idx);
      return;
    }
    
    console.log('Setting up enhanced events for link', idx, link);
    
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
      const img = link.querySelector('[webgl-anime="image-src"]') || link.querySelector('img');
      if (img) {
        const aspect = img.naturalWidth / img.naturalHeight;
        mesh.scale.set(SETTINGS.mesh.baseSize * aspect, SETTINGS.mesh.baseSize, 1);
        console.log("Enhanced scaling applied:", SETTINGS.mesh.baseSize * aspect, SETTINGS.mesh.baseSize);
      }
    });

    link.addEventListener("mouseleave", () => {
      console.log("Mouse left link", idx);
      fadingOut = true;
    });
  });

  // ENHANCED MOUSE MOVE - Better tracking within wrapper
  wrapper.addEventListener("mousemove", (e) => {
    // Only track mouse when we're on the list tab and have an active effect
    if (window.WebGLEffects.getCurrentTab() !== 'Tab 2' || currentIndex === -1) return;
    
    const rect = wrapper.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  });

  // RESIZE HANDLER
  const resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resizeHandler);

  function update() {
    // Update time for ripple effect
    uniforms.uTime.value = Date.now() * 0.001;

    if (uniforms.uAlpha.value > 0 && currentIndex >= 0) {
      // Much smoother lerping with enhanced responsiveness
      offset.x = lerp(offset.x, targetX, SETTINGS.mouse.lerpFactor);
      offset.y = lerp(offset.y, targetY, SETTINGS.mouse.lerpFactor);

      // Smoother deformation with better responsiveness
      const deltaX = (targetX - offset.x) * SETTINGS.mouse.responsiveness;
      const deltaY = (targetY - offset.y) * SETTINGS.mouse.responsiveness;
      
      uniforms.uOffset.value.set(
        deltaX * SETTINGS.deformation.strength,
        -deltaY * SETTINGS.deformation.strength
      );

      // Smoother RGB split on mouse movement
      const rgbStrength = 0.0008; // Reduced for subtlety
      uniforms.uRGBOffset.value.set(
        deltaX * rgbStrength,
        deltaY * rgbStrength
      );

      // Smoother positioning - mesh follows mouse within wrapper bounds
      const rect = wrapper.getBoundingClientRect();
      const wrapperCenterX = rect.width / 2;
      const wrapperCenterY = rect.height / 2;
      
      // Convert wrapper coordinates to world coordinates with smooth following
      const worldX = lerp(mesh.position.x, offset.x - wrapperCenterX, 0.1);
      const worldY = lerp(mesh.position.y, wrapperCenterY - offset.y, 0.1);
      
      mesh.position.set(worldX, worldY, 0);
    }

    // Enhanced transition handling
    if (transitioning && uniforms.uMixFactor.value < 1.0) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed;
      if (uniforms.uMixFactor.value >= 1.0) {
        transitioning = false;
        uniforms.uPrevTexture.value = null;
      }
    }

    // Enhanced fade out
    if (fadingOut && uniforms.uAlpha.value > 0.0) {
      uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed;
      if (uniforms.uAlpha.value <= 0.0) {
        uniforms.uAlpha.value = 0.0;
        fadingOut = false;
        currentIndex = -1;
      }
    }
  }

  // Cleanup function
  const cleanup = () => {
    window.removeEventListener("resize", resizeHandler);
    scene.clear();
    geometry.dispose();
    material.dispose();
    textures.forEach(tex => tex.dispose());
  };

  return { scene, camera, update, cleanup, type: 'list-hover' };
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Bulge Effect for Grid Tab
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initBulgeEffects() {
  console.log("initBulgeEffects called");

  // Only run if we're on the grid tab
  if (window.WebGLEffects.getCurrentTab() !== 'Tab 1') {
    console.log('Skipping bulge effect - wrong tab');
    return;
  }

  const cards = Array.from(
    document.querySelectorAll('[data-w-tab="Tab 1"] [webgl-anime="image-hover"]')
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
      animationId: null
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
      // Only animate if we're still on the grid tab
      if (window.WebGLEffects.getCurrentTab() === 'Tab 1') {
        cardData.animationId = requestAnimationFrame(animate);
        material.uniforms.uHover.value *= 0.97;
        renderer.render(scene, camera);
      }
    }
    animate();

    // Responsive
    const resizeHandler = () => {
      if (window.WebGLEffects.getCurrentTab() !== 'Tab 1') return;
      
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
      const canvas = plane.card.querySelector('.work-canvas');
      if (canvas) canvas.remove();
      
      // Show original image
      const img = plane.card.querySelector('img');
      if (img) img.style.opacity = '1';
    });
    
    window.currentBulgePlanes = [];
  }
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Initialize on load
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    console.log("DOMContentLoaded init");
    
    // Initialize effects based on current tab
    const currentTab = window.WebGLEffects.getCurrentTab();
    console.log("Current tab on load:", currentTab);
    
    window.WebGLEffects.initTabEffects(currentTab);
    
    // Fallback: If no effects were initialized, try again with Tab 2
    setTimeout(() => {
      if (window.WebGLEffects.renderer) {
        const hasEffects = window.WebGLEffects.renderer.info?.render?.triangles > 0;
        if (!hasEffects) {
          console.log('No effects detected, forcing Tab 2 initialization');
          window.WebGLEffects.initTabEffects('Tab 2');
        }
      }
    }, 500);
  }, 100);
});

if (document.readyState !== "loading") {
  setTimeout(() => {
    console.log("Page already loaded, init immediately");
    
    // Initialize effects based on current tab
    const currentTab = window.WebGLEffects.getCurrentTab();
    console.log("Current tab on load:", currentTab);
    
    window.WebGLEffects.initTabEffects(currentTab);
    
    // Fallback: If no effects were initialized, try again with Tab 2
    setTimeout(() => {
      if (window.WebGLEffects.renderer) {
        console.log('Checking if effects are running...');
        // Force Tab 2 initialization if screen is still black
        window.WebGLEffects.initTabEffects('Tab 2');
      }
    }, 500);
  }, 100);
}














/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Footer Bulge Effect with Window Mouse Events
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Awwwards-Level Footer Effect - Train + Advanced Visuals
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initFooterBulgeEffect() {
  console.log("🚂 Initializing Advanced Footer Effect");

  const footerSection = document.querySelector('.footer-section');
  const footerContainer = document.querySelector('.footer-bg');
  
  if (!footerSection || !footerContainer) {
    console.warn("Footer elements not found");
    return;
  }

  const img = footerContainer.querySelector('.footer-bg-image');
  if (!img) {
    console.warn("Footer background image not found");
    return;
  }

  // Remove old canvas if exists
  const oldCanvas = footerContainer.querySelector(".footer-canvas");
  if (oldCanvas) oldCanvas.remove();

  const loader = new THREE.TextureLoader();
  
  // Advanced vertex shader with wave distortions
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseStrength;
    
    void main() {
      vUv = uv;
      vPosition = position;
      
      vec3 pos = position;
      
      // Subtle breathing effect
      pos.z += sin(uTime * 0.5 + position.x * 0.1) * 0.01;
      pos.z += cos(uTime * 0.3 + position.y * 0.1) * 0.008;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Ultra-advanced fragment shader
  const fragmentShader = `
    precision highp float;
    uniform sampler2D uTexture;
    uniform vec2 uMouse;
    uniform float uTime;
    uniform float uMouseStrength;
    uniform vec2 uResolution;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Trail positions (last 20 mouse positions)
    uniform vec2 uTrail[20];
    uniform float uTrailStrengths[20];
    
    // Noise function for organic effects
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    // Fractal Brownian Motion
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 4; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    // Advanced color palette
    vec3 palette(float t) {
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.263, 0.416, 0.557);
      return a + b * cos(6.28318 * (c * t + d));
    }
    
    void main() {
      vec2 uv = vUv;
      vec2 originalUv = uv;
      
      float totalDistortion = 0.0;
      float totalColorShift = 0.0;
      vec3 trailColor = vec3(0.0);
      
      // Process trail effects
      for(int i = 0; i < 20; i++) {
        vec2 trailPos = uTrail[i];
        float trailStrength = uTrailStrengths[i];
        
        if(trailStrength > 0.01) {
          vec2 diff = uv - trailPos;
          float dist = length(diff);
          
          // Multiple falloff functions for complex effects
          float influence1 = exp(-15.0 * dist * dist) * trailStrength;
          float influence2 = exp(-8.0 * dist * dist) * trailStrength * 0.7;
          float influence3 = exp(-25.0 * dist * dist) * trailStrength * 1.2;
          
          // Distortion with rotation
          float angle = atan(diff.y, diff.x);
          float rotatedAngle = angle + sin(uTime * 2.0 + float(i) * 0.5) * influence1 * 0.5;
          vec2 rotatedDiff = vec2(cos(rotatedAngle), sin(rotatedAngle)) * length(diff);
          
          // Apply layered distortions
          uv -= rotatedDiff * 0.15 * influence1;
          uv -= diff * 0.08 * influence2 * sin(uTime + dist * 20.0);
          
          totalDistortion += influence1 + influence2 * 0.5;
          totalColorShift += influence3;
          
          // Trail color accumulation
          vec3 trailPalette = palette(float(i) * 0.1 + uTime * 0.2);
          trailColor += trailPalette * influence3 * 0.3;
        }
      }
      
      // Add organic noise distortion
      float noiseScale = 0.5 + totalDistortion * 2.0;
      vec2 noiseOffset = vec2(
        fbm(originalUv * 3.0 + uTime * 0.1) * 0.02 * noiseScale,
        fbm(originalUv * 3.0 + uTime * 0.1 + 100.0) * 0.02 * noiseScale
      );
      uv += noiseOffset;
      
      // Sample texture with distorted coordinates
      vec4 color = texture2D(uTexture, uv);
      
      // Advanced chromatic aberration
      float aberration = totalDistortion * 0.008;
      if(aberration > 0.0001) {
        color.r = texture2D(uTexture, uv + vec2(aberration, 0.0)).r;
        color.g = texture2D(uTexture, uv).g;
        color.b = texture2D(uTexture, uv - vec2(aberration, 0.0)).b;
      }
      
      // Dynamic color grading
      vec3 finalColor = color.rgb;
      
      // Add trail colors
      finalColor = mix(finalColor, finalColor + trailColor, min(totalColorShift * 0.8, 0.6));
      
      // Psychedelic color shifts
      if(totalColorShift > 0.1) {
        float colorTime = uTime * 3.0 + totalDistortion * 10.0;
        vec3 psychColor = palette(colorTime + length(originalUv - vec2(0.5)));
        finalColor = mix(finalColor, psychColor, totalColorShift * 0.4);
      }
      
      // Film grain
      float grain = (random(originalUv + uTime * 0.1) - 0.5) * 0.03;
      finalColor += grain * (1.0 - totalDistortion);
      
      // Vignette effect that responds to activity
      float vignetteStrength = 0.3 - totalDistortion * 0.2;
      float vignette = 1.0 - vignetteStrength * pow(length(originalUv - vec2(0.5)) * 1.4, 2.0);
      finalColor *= vignette;
      
      // Subtle color temperature shift based on activity
      float warmth = totalDistortion * 0.1;
      finalColor.r += warmth * 0.1;
      finalColor.b -= warmth * 0.05;
      
      // Final contrast and saturation boost
      finalColor = pow(finalColor, vec3(0.95 + totalDistortion * 0.1));
      float saturation = 1.0 + totalColorShift * 0.3;
      float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
      finalColor = mix(vec3(luminance), finalColor, saturation);
      
      gl_FragColor = vec4(finalColor, color.a);
    }
  `;

  // Load texture
  const texture = loader.load(img.src, () => {
    console.log("🎨 Advanced texture loaded");
    img.style.opacity = "0";
  });

  const width = footerContainer.offsetWidth;
  const height = footerContainer.offsetHeight;

  // Setup Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, 0.1, 10);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.classList.add("footer-canvas");
  footerContainer.appendChild(renderer.domElement);

  // Trail system for mouse positions
  const trailPositions = Array(20).fill().map(() => new THREE.Vector2(0.5, 0.5));
  const trailStrengths = Array(20).fill(0);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uMouseStrength: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uTrail: { value: trailPositions },
      uTrailStrengths: { value: trailStrengths }
    },
    vertexShader,
    fragmentShader,
  });

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(width, height, 1);
  scene.add(mesh);

  let animationId;
  let lastMouseTime = 0;
  let mouseVelocity = 0;
  let lastMousePos = { x: 0.5, y: 0.5 };

  // Advanced mouse movement handler
  function handleFooterMouseMove(e) {
    const rect = footerContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    
    // Calculate velocity for dynamic effects
    const currentTime = performance.now();
    const deltaTime = currentTime - lastMouseTime;
    const deltaX = x - lastMousePos.x;
    const deltaY = y - lastMousePos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (deltaTime > 0) {
      mouseVelocity = distance / deltaTime * 1000; // pixels per second
      mouseVelocity = Math.min(mouseVelocity, 5.0); // Cap velocity
    }
    
    // Update trail system
    trailPositions.unshift(new THREE.Vector2(x, y));
    trailPositions.pop();
    
    const baseStrength = Math.min(mouseVelocity * 0.3 + 0.2, 1.0);
    trailStrengths.unshift(baseStrength);
    trailStrengths.pop();
    
    // Update uniforms
    material.uniforms.uMouse.value.set(x, y);
    material.uniforms.uMouseStrength.value = baseStrength;
    material.uniforms.uTrail.value = trailPositions;
    material.uniforms.uTrailStrengths.value = trailStrengths;
    
    lastMouseTime = currentTime;
    lastMousePos = { x, y };
  }

  function handleFooterMouseLeave() {
    console.log("🌊 Mouse left footer - fading effects");
    // Don't reset immediately, let animation loop handle fade
  }

  // Event listeners
  footerSection.addEventListener("mousemove", handleFooterMouseMove);
  footerSection.addEventListener("mouseleave", handleFooterMouseLeave);

  // High-performance animation loop
  function animate() {
    animationId = requestAnimationFrame(animate);
    
    // Update time
    material.uniforms.uTime.value += 0.016;
    
    // Fade mouse strength and trail
    material.uniforms.uMouseStrength.value *= 0.98;
    
    // Fade trail strengths
    for (let i = 0; i < trailStrengths.length; i++) {
      trailStrengths[i] *= 0.95;
      if (i > 0) {
        trailStrengths[i] *= 0.85; // Older trail points fade faster
      }
    }
    material.uniforms.uTrailStrengths.value = trailStrengths;
    
    renderer.render(scene, camera);
  }
  animate();

  // Cleanup function
  function cleanup() {
    console.log("🧹 Advanced cleanup initiated");
    footerSection.removeEventListener("mousemove", handleFooterMouseMove);
    footerSection.removeEventListener("mouseleave", handleFooterMouseLeave);
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
  }

  window.footerBulgeCleanup = cleanup;

  // Enhanced resize handler
  function handleResize() {
    const newWidth = footerContainer.offsetWidth;
    const newHeight = footerContainer.offsetHeight;
    
    camera.left = -newWidth / 2;
    camera.right = newWidth / 2;
    camera.top = newHeight / 2;
    camera.bottom = -newHeight / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(newWidth, newHeight);
    mesh.scale.set(newWidth, newHeight, 1);
    material.uniforms.uResolution.value.set(newWidth, newHeight);
  }
  
  window.addEventListener("resize", handleResize);

  console.log("🏆 Awwwards-level footer effect initialized!");
}

// Initialize the magic
initFooterBulgeEffect();
