import * as THREE from "three"

/*
=====================================================
   GLOBAL EFFECT MANAGER WITH TAB SUPPORT
=====================================================
*/
window.WebGLEffects = (() => {
  const effects = []
  let renderer, scene, camera
  let currentTab = "Tab 1" // Default to grid view
  let animationId = null
  let scrollBlurEffect = null

  function init() {
    // Shared renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)

    // add class and styling before appending
    renderer.domElement.classList.add("global-webgl-canvas")
    renderer.domElement.classList.add("scroll-blur-canvas")
    renderer.domElement.style.position = "fixed"
    renderer.domElement.style.top = "0"
    renderer.domElement.style.left = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.zIndex = "1" // Lower z-index to not interfere with other animations
    renderer.domElement.style.pointerEvents = "none"
    document.body.appendChild(renderer.domElement)

    // Shared scene + camera
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 5

    // Initialize scroll blur effect
    scrollBlurEffect = initScrollBlurEffect()

    animate()
    window.addEventListener("resize", onResize)

    // Listen for tab changes
    initTabListener()

    console.log("Global WebGL renderer initialized with scroll blur")
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    scrollBlurEffect.cleanup()
    scrollBlurEffect = initScrollBlurEffect()
  }

  function initTabListener() {
    // Placeholder for tab listener initialization
    // This should be implemented based on the specific tab management system used
    console.log("Tab listener initialized")
  }

  function addEffect(effect) {
    effects.push(effect)
  }

  function switchTab(tab) {
    currentTab = tab
    console.log("Switched to tab:", tab)
  }

  function initTabEffects() {
    // Placeholder for initializing tab-specific effects
    console.log("Tab-specific effects initialized")
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate)

    // Always render scroll blur effect (global background)
    if (scrollBlurEffect) {
      scrollBlurEffect.update(time)
      renderer.setRenderTarget(null)
      renderer.clear()
      renderer.render(scrollBlurEffect.scene, scrollBlurEffect.camera)
    }

    // Render tab-specific effects on top
    if (currentTab === "Tab 2") {
      // Update and render list effects
      effects.forEach((e) => {
        if (e.update) e.update(time)
        if (e.scene && e.camera && e.type === "list-hover") {
          renderer.render(e.scene, e.camera)
        }
      })
    }
  }

  init()

  // Expose the renderer so effects can use it
  return {
    addEffect,
    renderer,
    scene,
    camera,
    switchTab,
    getCurrentTab: () => currentTab,
    initTabEffects,
    scrollBlurEffect: () => scrollBlurEffect,
  }
})()

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
Progressive Blur Scroll Effect for Section Reveals - FIXED
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function initScrollBlurEffect() {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform float uScrollProgress;
    uniform float uScrollDir; // +1 = down, -1 = up
    uniform vec2 uResolution;
    varying vec2 vUv;
    
    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    vec3 blur(vec2 uv, float amount) {
      vec3 color = vec3(0.0);
      float total = 0.0;
      
      for(float x = -4.0; x <= 4.0; x += 1.0) {
        for(float y = -4.0; y <= 4.0; y += 1.0) {
          vec2 offset = vec2(x, y) * amount * 0.01;
          float weight = exp(-(x*x + y*y) * 0.1);
          color += vec3(1.0) * weight;
          total += weight;
        }
      }
      
      return color / total;
    }
    
    void main() {
      vec2 st = vUv;
      
      float blurZone;
      float edgeFade;
      
      if (uScrollDir > 0.0) {
        blurZone = smoothstep(0.4, 1.0, st.y);
        edgeFade = smoothstep(0.2, 0.8, st.y);
      } else {
        blurZone = smoothstep(0.4, 1.0, 1.0 - st.y);
        edgeFade = smoothstep(0.2, 0.8, 1.0 - st.y);
      }
      
      float blurAmount = blurZone * uScrollProgress * 2.0;
      vec3 blurredColor = blur(st, blurAmount);
      
      vec3 whiteBase = vec3(0.9, 0.92, 0.95);
      vec3 whiteHighlight = vec3(1.0, 1.0, 1.0);
      
      float n = noise(st * 6.0 + uTime * 0.2);
      vec3 finalColor = mix(whiteBase, whiteHighlight, n * 0.4) * blurredColor;
      
      float opacity = blurAmount * edgeFade * 1.2;
      opacity = clamp(opacity, 0.0, 0.9);
      
      gl_FragColor = vec4(finalColor, opacity);
    }
  `

  const uniforms = {
    uTime: { value: 0 },
    uScrollProgress: { value: 0 },
    uScrollDir: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  }

  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.NormalBlending,
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  let lastScroll = window.pageYOffset
  let scrollVelocity = 0
  let smoothScrollDir = 1.0
  let scrollProgress = 0

  const updateScroll = () => {
    const scrolled = window.pageYOffset
    const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1)

    const newVelocity = scrolled - lastScroll
    scrollVelocity = scrollVelocity * 0.8 + newVelocity * 0.2 // Smooth velocity

    const targetProgress = Math.min(Math.max(scrolled / maxScroll, 0), 1)
    scrollProgress = scrollProgress * 0.9 + targetProgress * 0.1
    uniforms.uScrollProgress.value = scrollProgress

    if (Math.abs(scrollVelocity) > 0.5) {
      const targetDir = scrollVelocity > 0 ? 1.0 : -1.0
      smoothScrollDir = smoothScrollDir * 0.85 + targetDir * 0.15
      uniforms.uScrollDir.value = smoothScrollDir > 0 ? 1.0 : -1.0
    }

    lastScroll = scrolled
  }

  window.addEventListener("scroll", updateScroll, { passive: true })

  const update = (time) => {
    uniforms.uTime.value = time * 0.001
  }

  const resize = () => {
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
  }
  window.addEventListener("resize", resize)

  const cleanup = () => {
    window.removeEventListener("scroll", updateScroll)
    window.removeEventListener("resize", resize)
    geometry.dispose()
    material.dispose()
  }

  return {
    scene,
    camera,
    update,
    cleanup,
  }
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Enhanced Hover List Effect Animation - FIXED POSITIONING
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/
function HoverListEffect(globalRenderer) {
  if (window.WebGLEffects.getCurrentTab() !== "Tab 2") {
    console.log("Skipping list effect - wrong tab")
    return null
  }

  const wrapper = document.querySelector("#tab-list-pane") || document.querySelector('[data-w-tab="Tab 2"]')
  if (!wrapper) {
    console.warn("HoverListEffect: No Tab 2 wrapper found")
    return null
  }

  console.log("Initializing Enhanced HoverListEffect for Tab 2", wrapper)

  const SETTINGS = {
    deformation: {
      strength: 0.00055,
      smoothing: 0.05,
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
      lerpFactor: 0.08,
      responsiveness: 0.6,
    },
  }

  const scene = new THREE.Scene()
  const perspective = 1000
  const offset = new THREE.Vector2(0, 0)
  let targetX = 0,
    targetY = 0
  let currentIndex = -1
  let transitioning = false,
    fadingOut = false

  const camera = new THREE.PerspectiveCamera(
    (180 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  )
  camera.position.set(0, 0, perspective)

  const uniforms = {
    uTime: { value: 0 },
    uAlpha: { value: 0 },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uRGBOffset: { value: new THREE.Vector2(0, 0) },
    uMixFactor: { value: 0 },
    uPrevTexture: { value: null },
  }

  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAlpha;
      uniform vec2 uOffset;
      uniform vec2 uRGBOffset;
      uniform float uMixFactor;
      uniform sampler2D uPrevTexture;
      varying vec2 vUv;
      
      float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      
      void main() {
        vec2 st = vUv;
        vec2 offsetSt = st + uOffset;
        vec2 rgbSt = st + uRGBOffset;
        
        vec4 color = texture2D(uPrevTexture, offsetSt);
        vec4 rgbColor = texture2D(uPrevTexture, rgbSt);
        
        color.rgb += rgbColor.rgb * uAlpha;
        
        gl_FragColor = mix(color, vec4(1.0), uMixFactor);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  wrapper.addEventListener("mousemove", (e) => {
    if (window.WebGLEffects.getCurrentTab() !== "Tab 2" || currentIndex === -1) return

    const rect = wrapper.getBoundingClientRect()

    targetX = e.clientX - rect.left
    targetY = e.clientY - rect.top

    console.log("Mouse move - targetX:", targetX, "targetY:", targetY, "scroll:", window.pageYOffset)
  })

  function update() {
    uniforms.uTime.value = Date.now() * 0.001

    if (uniforms.uAlpha.value > 0 && currentIndex >= 0) {
      offset.x = lerp(offset.x, targetX, SETTINGS.mouse.lerpFactor)
      offset.y = lerp(offset.y, targetY, SETTINGS.mouse.lerpFactor)

      const deltaX = (targetX - offset.x) * SETTINGS.mouse.responsiveness
      const deltaY = (targetY - offset.y) * SETTINGS.mouse.responsiveness

      uniforms.uOffset.value.set(deltaX * SETTINGS.deformation.strength, -deltaY * SETTINGS.deformation.strength)

      const rgbStrength = 0.0008
      uniforms.uRGBOffset.value.set(deltaX * rgbStrength, deltaY * rgbStrength)

      const rect = wrapper.getBoundingClientRect()
      const wrapperCenterX = rect.width / 2
      const wrapperCenterY = rect.height / 2

      const screenCenterX = window.innerWidth / 2
      const screenCenterY = window.innerHeight / 2

      const worldX = lerp(mesh.position.x, rect.left + offset.x - screenCenterX, 0.1)
      const worldY = lerp(mesh.position.y, screenCenterY - (rect.top + offset.y), 0.1)

      mesh.position.set(worldX, worldY, 0)
    }

    if (transitioning && uniforms.uMixFactor.value < 1.0) {
      uniforms.uMixFactor.value += SETTINGS.transition.speed
      if (uniforms.uMixFactor.value >= 1.0) {
        transitioning = false
        uniforms.uPrevTexture.value = null
      }
    }

    if (fadingOut && uniforms.uAlpha.value > 0.0) {
      uniforms.uAlpha.value -= SETTINGS.transition.fadeOutSpeed
      if (uniforms.uAlpha.value <= 0.0) {
        uniforms.uAlpha.value = 0.0
        fadingOut = false
        currentIndex = -1
      }
    }
  }

  const cleanup = () => {
    wrapper.removeEventListener("mousemove", update)
    geometry.dispose()
    material.dispose()
  }

  return {
    scene,
    camera,
    update,
    cleanup,
  }
}

function lerp(start, end, amount) {
  return (1 - amount) * start + amount * end
}
