// ========== GLOBAL RENDERER ==========
window.WebGLEffects = (function () {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const effects = [];

  function addEffect(effectFn) {
    const { scene, camera, update } = effectFn(renderer.domElement);
    effects.push({ scene, camera, update });
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);

    effects.forEach(({ camera }) => {
      if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
  }
  window.addEventListener("resize", resize);
  resize();

  function animate(time) {
    requestAnimationFrame(animate);
    effects.forEach(({ scene, camera, update }) => {
      if (update) update(time);
      renderer.render(scene, camera);
    });
  }
  animate();

  return { addEffect };
})();

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Grid Hover Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 
function GridAnimeEffect() {
  const image = document.querySelector("img[webgl-grid-anime]");
  const wrapper = image.closest(".webgl-wrapper");
  const imgRatio = image.naturalWidth / image.naturalHeight;

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
}

/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Distortion Effect Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 
function DistortionEffect() {
  const container = document.querySelector("[data-webgl-container]");
  const image = document.querySelector("[distorted-image]");

  if (!container || !image) {
    console.error("DistortionEffect: Required elements not found");
    return { scene: new THREE.Scene(), camera: new THREE.Camera(), update: () => {} };
  }

  // SETTINGS
  const settings = {
    falloff: 0.12,
    alpha: 0.97,
    dissipation: 0.965,
    distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
    chromaticAberration: 0.002,
    chromaticSpread: 0.6,
    velocityScale: 0.6,
    velocityDamping: 0.85,
    mouseRadius: 0.1,
    motionBlurStrength: 0.35,
    motionBlurDecay: 0.88,
    motionBlurThreshold: 0.5,
  };

  // SCENE + CAMERA (NO separate renderer now, will use global one)
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // SHADERS (flowmap + distortion) → copy from your code
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

 const flowmapFragment = `
        uniform vec2 uMouse;
        uniform vec2 uVelocity;
        uniform vec2 uResolution;
        uniform float uFalloff;
        uniform float uAlpha;
        uniform float uDissipation;
        uniform float uAspect;
        uniform sampler2D uTexture;
        uniform float uTime;
        
        varying vec2 vUv;
        
        void main() {
            vec2 uv = vUv;
            vec4 color = texture2D(uTexture, uv);
            color.rgb *= uDissipation;

            // Removed idle wave effect

            vec2 cursor = uMouse;
            vec2 aspectUv = uv;
            aspectUv.x *= uAspect;
            cursor.x *= uAspect;
            
            float dist = distance(aspectUv, cursor);
            float influence = 1.0 - smoothstep(0.0, uFalloff, dist);
            
            vec2 velocityContribution = vec2(uVelocity.x, -uVelocity.y) * influence * uAlpha;
            color.rg += velocityContribution;
            color.b = length(color.rg) * 2.0;
            
            gl_FragColor = color;
        }
    `;

    const distortionFragment = `
        uniform sampler2D uLogo;
        uniform sampler2D uFlowmap;
        uniform sampler2D uPreviousFrame;
        uniform vec2 uImageScale;
        uniform vec2 uImageOffset;
        uniform float uDistortionStrength;
        uniform float uChromaticAberration;
        uniform float uChromaticSpread;
        uniform vec2 uResolution;
        uniform float uMotionBlurStrength;
        uniform float uMotionBlurDecay;
        uniform float uMotionBlurThreshold;
        uniform bool uIsFirstFrame;
        uniform float uTime;
        
        varying vec2 vUv;

        precision mediump float;
        
        vec2 canvasToImageUV(vec2 uv) {
            vec2 centeredUv = (uv - 0.5);
            centeredUv /= uImageScale;
            centeredUv += uImageOffset;
            return centeredUv + 0.5;
        }
        
        vec4 sampleLogoExtended(vec2 uv) {
            vec2 imageUv = canvasToImageUV(uv);
            
            if (imageUv.x < 0.0 || imageUv.x > 1.0 || imageUv.y < 0.0 || imageUv.y > 1.0) {
                return vec4(0.0, 0.0, 0.0, 0.0);
            }
            
            return texture2D(uLogo, imageUv);
        }
        
        bool isWithinImageBounds(vec2 uv) {
            vec2 imageUv = canvasToImageUV(uv);
            return imageUv.x >= 0.0 && imageUv.x <= 1.0 && imageUv.y >= 0.0 && imageUv.y <= 1.0;
        }
        
        void main() {
            vec2 uv = vUv;

            // Removed idle wave movement

            vec3 flow = texture2D(uFlowmap, uv).rgb;
            float flowMagnitude = length(flow.rg);
            
            vec2 distortedUv = uv + flow.rg * uDistortionStrength;
            
            float aberrationAmount = flow.b * uChromaticAberration;
            vec2 flowDirection = length(flow.rg) > 0.0 ? normalize(flow.rg) : vec2(0.0);
            
            vec2 redOffset = flowDirection * aberrationAmount * uChromaticSpread;
            vec2 greenOffset = vec2(-flowDirection.y, flowDirection.x) * aberrationAmount * uChromaticSpread * 0.8;
            vec2 blueOffset = -flowDirection * aberrationAmount * uChromaticSpread;
            
            vec2 redUv = distortedUv + redOffset;
            vec2 greenUv = distortedUv + greenOffset;
            vec2 blueUv = distortedUv + blueOffset;
            
            float r = sampleLogoExtended(redUv).r;
            float g = sampleLogoExtended(greenUv).g;
            float b = sampleLogoExtended(blueUv).b;
            
            vec4 centerSample = sampleLogoExtended(distortedUv);
            
            float alpha = 0.0;
            if (isWithinImageBounds(redUv)) alpha = max(alpha, sampleLogoExtended(redUv).a);
            if (isWithinImageBounds(greenUv)) alpha = max(alpha, sampleLogoExtended(greenUv).a);
            if (isWithinImageBounds(blueUv)) alpha = max(alpha, sampleLogoExtended(blueUv).a);
            if (isWithinImageBounds(distortedUv)) alpha = max(alpha, centerSample.a);
            
            if (alpha < 0.01) {
                gl_FragColor = vec4(0.0);
                return;
            }
            
            vec3 color = vec3(r, g, b);
            float totalBrightness = r + g + b;
            if (totalBrightness < 0.05 && isWithinImageBounds(distortedUv)) {
                color = centerSample.rgb;
            }
            
            if (flowMagnitude > 0.01) {
                float threshold = 0.05;
                if (r > threshold && r > g + 0.1 && r > b + 0.1) {
                    color.r = min(1.0, r * 1.8);
                    color.g *= 0.8;
                    color.b *= 0.8;
                }
                if (g > threshold && g > r + 0.1 && g > b + 0.1) {
                    color.g = min(1.0, g * 1.6);
                    color.r *= 0.8;
                    color.b *= 0.8;
                }
                if (b > threshold && b > r + 0.1 && b > g + 0.1) {
                    color.b = min(1.0, b * 2.0);
                    color.r *= 0.8;
                    color.g *= 0.8;
                }
                
                float glowStrength = flow.b * 0.15;
                color += color * glowStrength;
            }
            
            vec4 currentColor = vec4(color, alpha);
            
            if (!uIsFirstFrame) {
                vec4 previousColor = texture2D(uPreviousFrame, uv);
                float motionAmount = smoothstep(uMotionBlurThreshold, uMotionBlurThreshold + 0.05, flowMagnitude);
                float blurStrength = motionAmount * uMotionBlurStrength;
                vec3 blendedColor = mix(currentColor.rgb, previousColor.rgb, blurStrength * uMotionBlurDecay);
                float blendedAlpha = max(currentColor.a, previousColor.a * uMotionBlurDecay);
                currentColor = vec4(blendedColor, blendedAlpha);
            }
            
            gl_FragColor = currentColor;
        }
    `;

  // MOUSE STATE
  const mouse = {
    current: new THREE.Vector2(-1, -1),
    target: new THREE.Vector2(-1, -1),
    velocity: new THREE.Vector2(0, 0),
    lastPosition: new THREE.Vector2(-1, -1),
    smoothVelocity: new THREE.Vector2(0, 0),
  };

  let flowmapA, flowmapB, displayA, displayB;
  let logoTexture, flowmapMaterial, distortionMaterial, flowmapMesh;
  let isInitialized = false;
  let isFirstFrame = true;

  // LOAD TEXTURE
  new THREE.TextureLoader().load(image.src, (tex) => {
    logoTexture = tex;
    logoTexture.minFilter = THREE.LinearFilter;
    logoTexture.magFilter = THREE.LinearFilter;
    logoTexture.wrapS = THREE.ClampToEdgeWrapping;
    logoTexture.wrapT = THREE.ClampToEdgeWrapping;

    createMaterials();
    createRenderTargets();
    createMesh();
    setupEvents();
    onResize();
    isInitialized = true;
  });

  function createMaterials() {
    flowmapMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: flowmapFragment,
      uniforms: {
        uMouse: { value: mouse.current.clone() },
        uVelocity: { value: mouse.velocity.clone() },
        uResolution: { value: new THREE.Vector2() },
        uFalloff: { value: settings.falloff },
        uAlpha: { value: settings.alpha },
        uDissipation: { value: settings.dissipation },
        uAspect: { value: 1 },
        uTexture: { value: null },
        uTime: { value: 0 },
      },
    });

    distortionMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: distortionFragment,
      uniforms: {
        uLogo: { value: logoTexture },
        uFlowmap: { value: null },
        uPreviousFrame: { value: null },
        uImageScale: { value: new THREE.Vector2(1, 1) },
        uImageOffset: { value: new THREE.Vector2(0, 0) },
        uDistortionStrength: { value: settings.distortionStrength },
        uChromaticAberration: { value: settings.chromaticAberration },
        uChromaticSpread: { value: settings.chromaticSpread },
        uResolution: { value: new THREE.Vector2() },
        uMotionBlurStrength: { value: settings.motionBlurStrength },
        uMotionBlurDecay: { value: settings.motionBlurDecay },
        uMotionBlurThreshold: { value: settings.motionBlurThreshold },
        uIsFirstFrame: { value: true },
        uTime: { value: 0 },
      },
      transparent: true,
    });
  }

  function createRenderTargets() {
    const type = THREE.UnsignedByteType;
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type,
    };

    const flowmapSize = 128;
    flowmapA = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);
    flowmapB = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);

    const displayWidth = Math.min(container.clientWidth, 512);
    const displayHeight = Math.min(container.clientHeight, 512);
    displayA = new THREE.WebGLRenderTarget(displayWidth, displayHeight, options);
    displayB = new THREE.WebGLRenderTarget(displayWidth, displayHeight, options);
  }

  function createMesh() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    flowmapMesh = new THREE.Mesh(geometry, distortionMaterial); // main mesh
    scene.add(flowmapMesh);
  }

  function setupEvents() {
    container.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      mouse.target.set(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height
      );
    });
    container.addEventListener("mouseenter", (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mouse.current.set(x, y);
      mouse.target.set(x, y);
      mouse.lastPosition.set(x, y);
    });
    container.addEventListener("mouseleave", () => {
      mouse.target.set(-1, -1);
    });
    window.addEventListener("resize", onResize);
  }

  function updateMouse() {
    mouse.lastPosition.copy(mouse.current);
    mouse.current.lerp(mouse.target, 0.7);
    const delta = new THREE.Vector2(
      mouse.current.x - mouse.lastPosition.x,
      mouse.current.y - mouse.lastPosition.y
    );
    delta.multiplyScalar(80);
    mouse.velocity.lerp(delta, 0.6);
    mouse.smoothVelocity.lerp(mouse.velocity, 0.3);
    mouse.velocity.multiplyScalar(settings.velocityDamping);
  }

  function onResize() {
    const { clientWidth, clientHeight } = container;
    const aspect = clientWidth / clientHeight;
    flowmapMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
    flowmapMaterial.uniforms.uAspect.value = aspect;
    distortionMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
  }

  function update() {
    if (!isInitialized) return;

    updateMouse();

    const time = performance.now() * 0.001;
    flowmapMaterial.uniforms.uTime.value = time;
    distortionMaterial.uniforms.uTime.value = time;

    flowmapMaterial.uniforms.uMouse.value.copy(mouse.current);
    flowmapMaterial.uniforms.uVelocity.value.copy(mouse.smoothVelocity);
    flowmapMaterial.uniforms.uVelocity.value.multiplyScalar(settings.velocityScale);

    // ping-pong render targets (simulate your original passes)
    flowmapMesh.material = flowmapMaterial;
    flowmapMaterial.uniforms.uTexture.value = flowmapB.texture;
    window.WebGLEffects.renderer.setRenderTarget(flowmapA);
    window.WebGLEffects.renderer.render(flowmapMesh, camera);

    flowmapMesh.material = distortionMaterial;
    distortionMaterial.uniforms.uFlowmap.value = flowmapA.texture;
    distortionMaterial.uniforms.uPreviousFrame.value = displayB.texture;
    distortionMaterial.uniforms.uIsFirstFrame.value = isFirstFrame;
    window.WebGLEffects.renderer.setRenderTarget(displayA);
    window.WebGLEffects.renderer.render(flowmapMesh, camera);

    window.WebGLEffects.renderer.setRenderTarget(null);

    [flowmapA, flowmapB] = [flowmapB, flowmapA];
    [displayA, displayB] = [displayB, displayA];
    isFirstFrame = false;
  }

  return { scene, camera, update };
}



/*
☰☰☰☰☰☰☰☰☰☰☰☰☰
Refactored Hover List Effect Animation
☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 


function HoverListEffect() {
  const wrapper = document.querySelector('[webgl-anime="list-hover-wrapper"]');
  if (!wrapper) {
    console.warn("HoverListEffect: No wrapper found");
    return { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), update: () => {} };
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
uniform float uMixFactor;  // controls crossfade
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

  // CAMERA (will be global rendered)
  const { clientWidth: width, clientHeight: height } = wrapper;
  const aspect = width / height;
  const fov = (180 * (2 * Math.atan(height / 2 / perspective))) / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
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
  });

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
    link.addEventListener("mouseenter", () => {
      uniforms.uPrevTexture.value = uniforms.uTexture.value;
      uniforms.uTexture.value = textures[idx];
      uniforms.uAlpha.value = 1.0;
      uniforms.uMixFactor.value = 0.0;
      currentIndex = idx;
      transitioning = true;
      fadingOut = false;

      const img = link.querySelector('[webgl-anime="image-src"]');
      if (img) {
        const aspect = img.naturalWidth / img.naturalHeight;
        mesh.scale.set(SETTINGS.mesh.baseSize * aspect, SETTINGS.mesh.baseSize, 1);
      }
    });

    link.addEventListener("mouseleave", () => {
      fadingOut = true;
    });
  });

  // MOUSE MOVE
  wrapper.addEventListener("mousemove", (e) => {
    const rect = wrapper.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  });

  // RESIZE
  window.addEventListener("resize", () => {
    const { clientWidth: w, clientHeight: h } = wrapper;
    camera.aspect = w / h;
    camera.fov = (180 * (2 * Math.atan(h / 2 / perspective))) / Math.PI;
    camera.updateProjectionMatrix();
  });

  function update() {
    uniforms.uTime.value = Date.now() * 0.001;

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
      }
    }

    // position mesh at mouse
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
Add all the effcts to the function
☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰☰
*/ 
window.WebGLEffects.addEffect(HoverListEffect);
window.WebGLEffects.addEffect(DistortionEffect);
window.WebGLEffects.addEffect(GridAnimeEffect);
