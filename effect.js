import * as THREE from 'three';

/*
=====================================================
   GLOBAL EFFECT MANAGER WITH TAB SUPPORT
=====================================================
*/
window.WebGLEffects = (function () {
  const effects = [];
  let renderer, scene, camera;
  let currentTab = 'Tab 2'; // Default to list view
  let animationId = null;

  function init() {
    // Shared renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // add class and styling before appending
    renderer.domElement.classList.add("global-webgl-canvas");
    renderer.domElement.classList.add("list-webgl-canvas"); // Also add the CSS class from your styles
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.zIndex = "999";
    renderer.domElement.style.pointerEvents = "none";
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
    
    // Listen for tab changes
    initTabListener();
    
    console.log('Global WebGL renderer initialized');
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
      currentTab = activeTab.getAttribute('data-w-tab') || 'Tab 2';
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
    
    // Only render global effects for list view
    if (currentTab === 'Tab 2') {
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
    initTabEffects
  };
})();

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Hover List Effect Animation
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

  console.log('Initializing HoverListEffect for Tab 2', wrapper);

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

  // LOAD textures - Updated selectors to match your HTML structure
  const links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
  console.log('Found list items:', links.length);
  
  if (links.length === 0) {
    console.warn('No list items found, trying alternative selectors...');
    // Fallback to find the portfolio items
    const portfolioItems = [...wrapper.querySelectorAll('.portfolio20_item-link')];
    console.log('Found portfolio items as fallback:', portfolioItems.length);
  }
  
  const textures = links.map((link, idx) => {
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

  console.log('Loaded textures:', textures.length);

  // If no textures were found with the webgl-anime attributes, let's debug the HTML structure
  if (textures.length === 0) {
    console.log('No textures loaded. Debugging HTML structure...');
    const allImages = wrapper.querySelectorAll('img');
    console.log('All images in wrapper:', allImages.length);
    allImages.forEach((img, idx) => {
      console.log(`Image ${idx}:`, img.src, img.getAttribute('webgl-anime'));
    });
    const allListItems = wrapper.querySelectorAll('.portfolio20_item-link');
    console.log('All portfolio items:', allListItems.length);
    
    // Create a fallback setup
    console.warn('Setting up fallback texture loading...');
    const fallbackTextures = [...allListItems].map((item, idx) => {
      const img = item.querySelector('img');
      if (!img) return null;
      console.log('Loading fallback texture for item', idx, img.src);
      const tex = new THREE.TextureLoader().load(img.src);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    }).filter(tex => tex !== null);
    
    if (fallbackTextures.length > 0) {
      console.log('Using fallback textures:', fallbackTextures.length);
      textures.push(...fallbackTextures);
      // Also update links to use the fallback items
      links.push(...allListItems);
    }
  }

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
    if (!textures[idx]) {
      console.warn('No texture for link', idx);
      return;
    }
    
    console.log('Setting up events for link', idx, link);
    
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
        const rect = img.getBoundingClientRect();
        console.log('Image rect:', rect);
        
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

        mesh.scale.set(meshWidth, meshHeight, 1);

        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        const imageCenterX = rect.left + rect.width / 2;
        const imageCenterY = rect.top + rect.height / 2;
        
        const offsetX = imageCenterX - viewportCenterX;
        const offsetY = viewportCenterY - imageCenterY;
        
        currentMeshPosition.set(offsetX, offsetY, 0);
        mesh.position.copy(currentMeshPosition);
        
        console.log("Image positioned at:", offsetX, offsetY, "Scale:", meshWidth, meshHeight);
      }
    });

    link.addEventListener("mouseleave", () => {
      console.log("Mouse left link", idx);
      fadingOut = true;
    });
  });

  // MOUSE MOVE - relative to the list container
  const listContainer = wrapper.querySelector('.portfolio20_list') || wrapper;
  listContainer.addEventListener("mousemove", (e) => {
    const rect = listContainer.getBoundingClientRect();
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
    uniforms.uTime.value = Date.now() * 0.001;

    if (uniforms.uAlpha.value > 0) {
      offset.x += (targetX - offset.x) * SETTINGS.deformation.smoothing;
      offset.y += (targetY - offset.y) * SETTINGS.deformation.smoothing;

      uniforms.uOffset.value.set(
        (targetX - offset.x) * SETTINGS.deformation.strength,
        -(targetY - offset.y) * SETTINGS.deformation.strength
      );

      uniforms.uRGBOffset.value.set(
        (targetX - offset.x) * 0.001,
        (targetY - offset.y) * 0.001
      );

      mesh.position.copy(currentMeshPosition);
    }

    if (transitioning && uniforms.uMixFactor.value < 1.0) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed;
      if (uniforms.uMixFactor.value >= 1.0) {
        transitioning = false;
        uniforms.uPrevTexture.value = null;
      }
    }

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
