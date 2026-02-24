console.log("[WebGLDistortion] file loaded");
function createWebGLDistortion(container, image, options = {}) {
if (!container || !image || typeof THREE === "undefined") {
  console.warn("[WebGLDistortion] Init skipped:", {
    containerExists: !!container,
    imageExists: !!image,
    threeAvailable: typeof THREE !== "undefined"
  });
  return;
} else {
  console.log("[WebGLDistortion] Initializing:", {
    container,
    image,
    threeAvailable: true
  });
}

  /* ================= SETTINGS ================= */

  const settings = {
    falloff: 0.12,
    alpha: 0.97,
    dissipation: 0.965,
    distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
    chromaticAberration: 0.0035,
    chromaticSpread: 0.85,
    velocityScale: 0.6,
    velocityDamping: 0.85,
    motionBlurStrength: 0.45,
    motionBlurDecay: 0.9,
    motionBlurThreshold: 0.5,
    ...options
  };

  /* ================= CANVAS ================= */

  let canvas = container.querySelector("[webgl-distorted-canvas]");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("webgl-distorted-canvas", "");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.style.position = "relative";
    container.appendChild(canvas);
  }

  /* ================= THREE CORE ================= */

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setClearColor(0, 0, 0, 0);
  renderer.autoClear = false;

  const mouse = {
    current: new THREE.Vector2(-1, -1),
    target: new THREE.Vector2(-1, -1),
    velocity: new THREE.Vector2(),
    last: new THREE.Vector2(),
    smooth: new THREE.Vector2()
  };

  let flowmapA, flowmapB, displayA, displayB;
  let flowmapMat, distortionMat, mesh;
  let isFirstFrame = true;

  /* ================= SHADERS ================= */

  const vertexShader = `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const flowmapFragment = `
    uniform vec2 uMouse;
    uniform vec2 uVelocity;
    uniform sampler2D uTexture;
    uniform float uFalloff;
    uniform float uAlpha;
    uniform float uDissipation;
    uniform float uAspect;
    varying vec2 vUv;

    void main(){
      vec2 uv = vUv;
      vec4 color = texture2D(uTexture, uv);
      color.rgb *= uDissipation;

      vec2 cursor = uMouse;
      vec2 aspectUv = uv;
      aspectUv.x *= uAspect;
      cursor.x *= uAspect;

      float dist = distance(aspectUv, cursor);
      float influence = 1.0 - smoothstep(0.0, uFalloff, dist);

      vec2 vel = vec2(uVelocity.x, -uVelocity.y) * influence * uAlpha;
      color.rg += vel;
      color.b = length(color.rg) * 2.0;

      gl_FragColor = color;
    }
  `;

  const distortionFragment = `
    uniform sampler2D uLogo;
    uniform sampler2D uFlowmap;
    uniform sampler2D uPreviousFrame;
    uniform float uDistortionStrength;
    uniform float uChromaticAberration;
    uniform float uChromaticSpread;
    uniform float uMotionBlurStrength;
    uniform float uMotionBlurDecay;
    uniform float uMotionBlurThreshold;
    uniform bool uIsFirstFrame;
    varying vec2 vUv;

    void main(){
      vec2 uv = vUv;
      vec3 flow = texture2D(uFlowmap, uv).rgb;
      float mag = length(flow.rg);

      vec2 distortedUv = uv + flow.rg * uDistortionStrength;

      float aberr = mag * uChromaticAberration * 2.0;
      vec2 dir = mag > 0.0 ? normalize(flow.rg) : vec2(0.0);

      vec2 rUv = distortedUv + dir * aberr * uChromaticSpread;
      vec2 gUv = distortedUv;
      vec2 bUv = distortedUv - dir * aberr * uChromaticSpread;

      vec4 r = texture2D(uLogo, rUv);
      vec4 g = texture2D(uLogo, gUv);
      vec4 b = texture2D(uLogo, bUv);

      vec4 color = vec4(r.r, g.g, b.b, g.a);

      if(!uIsFirstFrame){
        vec4 prev = texture2D(uPreviousFrame, uv);
        float blur = smoothstep(uMotionBlurThreshold, uMotionBlurThreshold + 0.05, mag);
        color.rgb = mix(color.rgb, prev.rgb, blur * uMotionBlurStrength * uMotionBlurDecay);
      }

      gl_FragColor = color;
    }
  `;

  /* ================= RENDER TARGET ================= */

  function createRT(w, h) {
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: renderer.capabilities.isWebGL2
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType
    });
  }

  /* ================= SETUP ================= */

  function setup(texture) {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);

    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    flowmapA = createRT(256, 256);
    flowmapB = createRT(256, 256);
    displayA = createRT(w, h);
    displayB = createRT(w, h);

    flowmapMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: flowmapFragment,
      uniforms: {
        uMouse: { value: mouse.current },
        uVelocity: { value: mouse.velocity },
        uTexture: { value: null },
        uFalloff: { value: settings.falloff },
        uAlpha: { value: settings.alpha },
        uDissipation: { value: settings.dissipation },
        uAspect: { value: w / h }
      }
    });

    distortionMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: distortionFragment,
      transparent: true,
      uniforms: {
        uLogo: { value: texture },
        uFlowmap: { value: null },
        uPreviousFrame: { value: null },
        uDistortionStrength: { value: settings.distortionStrength },
        uChromaticAberration: { value: settings.chromaticAberration },
        uChromaticSpread: { value: settings.chromaticSpread },
        uMotionBlurStrength: { value: settings.motionBlurStrength },
        uMotionBlurDecay: { value: settings.motionBlurDecay },
        uMotionBlurThreshold: { value: settings.motionBlurThreshold },
        uIsFirstFrame: { value: true }
      }
    });

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flowmapMat);
    scene.add(mesh);

    setupEvents();
    setupResizeObserver();
    animate();
  }

  /* ================= EVENTS ================= */

  function setupEvents() {
    container.addEventListener("mousemove", e => {
      const r = container.getBoundingClientRect();
      mouse.target.set(
        (e.clientX - r.left) / r.width,
        1 - (e.clientY - r.top) / r.height
      );
    });
  }

  /* ================= RESIZE OBSERVER ================= */

  function setupResizeObserver() {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const w = Math.max(width, 1);
      const h = Math.max(height, 1);

      renderer.setSize(w, h, false);
      displayA.setSize(w, h);
      displayB.setSize(w, h);

      if (flowmapMat) flowmapMat.uniforms.uAspect.value = w / h;
    });
    ro.observe(container);
  }

  /* ================= RENDER LOOP ================= */

  function updateMouse() {
    mouse.last.copy(mouse.current);
    mouse.current.lerp(mouse.target, 0.7);

    const delta = new THREE.Vector2(
      mouse.current.x - mouse.last.x,
      mouse.current.y - mouse.last.y
    ).multiplyScalar(80);

    mouse.velocity.lerp(delta, 0.6).multiplyScalar(settings.velocityDamping);
    mouse.smooth.lerp(mouse.velocity, 0.3);
  }

  function render() {
    updateMouse();

    flowmapMat.uniforms.uVelocity.value.copy(mouse.smooth);
    flowmapMat.uniforms.uTexture.value = flowmapB.texture;

    mesh.material = flowmapMat;
    renderer.setRenderTarget(flowmapA);
    renderer.render(scene, camera);

    mesh.material = distortionMat;
    distortionMat.uniforms.uFlowmap.value = flowmapA.texture;
    distortionMat.uniforms.uPreviousFrame.value = displayB.texture;
    distortionMat.uniforms.uIsFirstFrame.value = isFirstFrame;

    renderer.setRenderTarget(displayA);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    [flowmapA, flowmapB] = [flowmapB, flowmapA];
    [displayA, displayB] = [displayB, displayA];
    isFirstFrame = false;
  }

  function animate() {
    render();
    requestAnimationFrame(animate);
  }

  /* ================= TEXTURE LOAD ================= */

  new THREE.TextureLoader().load(image.src, tex => {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    setup(tex);
  });
}

/* ================= SAFE INITIALIZER ================= */

function initWebGLDistortions() {
  if (typeof THREE === "undefined") {
    requestAnimationFrame(initWebGLDistortions);
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const container = entry.target;
        if (container.__webglInitialized) return;

        const image = container.querySelector("[data-distorted-image]");
        if (!image) {
          console.warn("[WebGLDistortion] No image found in container", container);
          return;
        }

        console.log("[WebGLDistortion] Container entered viewport");

        const start = () => {
          console.log("[WebGLDistortion] Initializing distortion");
          createWebGLDistortion(container, image);
          container.__webglInitialized = true;
          observer.unobserve(container);
        };

        // Wait for lazy image to ACTUALLY be ready
        if (image.complete && image.naturalWidth > 0) {
          start();
        } else {
          image.addEventListener(
            "load",
            () => {
              image.decode?.().finally(start);
            },
            { once: true }
          );
        }
      });
    },
    {
      rootMargin: "200px", // preload before visible
      threshold: 0.01
    }
  );

  document.querySelectorAll("[data-webgl-container]").forEach(container => {
    observer.observe(container);
  });
}

initWebGLDistortions();
