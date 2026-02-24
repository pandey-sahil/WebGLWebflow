/* ================= WEBGL DISTORTION (FINAL) ================= */

function createWebGLDistortion(container, image, options = {}) {
  if (!container || !image || typeof THREE === "undefined") return;

  /* ========== SETTINGS ========== */

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

  /* ========== CANVAS ========== */

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

  /* ========== THREE CORE ========== */

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false
  });

  renderer.setClearColor(0, 0, 0, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ========== MOUSE STATE ========== */

  const mouse = {
    current: new THREE.Vector2(-1, -1),
    target: new THREE.Vector2(-1, -1),
    last: new THREE.Vector2(-1, -1),
    velocity: new THREE.Vector2(),
    smooth: new THREE.Vector2()
  };

  let flowmapA, flowmapB, displayA, displayB;
  let flowmapMat, distortionMat, mesh;
  let isFirstFrame = true;

  /* ========== SHADERS ========== */

  const vertexShader = `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
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
      vec4 color = texture2D(uTexture, vUv);
      color.rgb *= uDissipation;

      vec2 uv = vUv;
      vec2 m = uMouse;
      uv.x *= uAspect;
      m.x *= uAspect;

      float d = distance(uv, m);
      float f = 1.0 - smoothstep(0.0, uFalloff, d);

      vec2 vel = vec2(uVelocity.x, -uVelocity.y) * f * uAlpha;
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
      vec3 flow = texture2D(uFlowmap, vUv).rgb;
      float mag = length(flow.rg);

      vec2 uv = vUv + flow.rg * uDistortionStrength;

      float ab = mag * uChromaticAberration * 2.0;
      vec2 dir = mag > 0.0 ? normalize(flow.rg) : vec2(0.0);

      vec4 r = texture2D(uLogo, uv + dir * ab * uChromaticSpread);
      vec4 g = texture2D(uLogo, uv);
      vec4 b = texture2D(uLogo, uv - dir * ab * uChromaticSpread);

      vec3 base = vec3(r.r, g.g, b.b);

      float glow = pow(mag, 1.8);
      vec3 glowCol = base * (1.0 + glow * 1.2);
      vec3 col = mix(base, glowCol, smoothstep(0.05, 0.4, mag));

      vec4 outColor = vec4(col, g.a);

      if(!uIsFirstFrame){
        vec4 prev = texture2D(uPreviousFrame, vUv);
        float blur = smoothstep(
          uMotionBlurThreshold,
          uMotionBlurThreshold + 0.05,
          mag
        );
        outColor.rgb = mix(
          outColor.rgb,
          prev.rgb,
          blur * uMotionBlurStrength * uMotionBlurDecay
        );
      }

      gl_FragColor = outColor;
    }
  `;

  /* ========== RENDER TARGET ========== */

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

  /* ========== SETUP ========== */

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
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
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

    bindMouse();
    animate();
  }

  /* ========== MOUSE EVENTS ========== */

  function bindMouse() {
    container.addEventListener("mousemove", e => {
      const r = container.getBoundingClientRect();
      mouse.target.set(
        (e.clientX - r.left) / r.width,
        1 - (e.clientY - r.top) / r.height
      );
    });

    container.addEventListener("mouseenter", e => {
      const r = container.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      mouse.current.set(x, y);
      mouse.target.set(x, y);
      mouse.last.set(x, y);
    });

    container.addEventListener("mouseleave", () => {
      mouse.target.set(-1, -1);
    });
  }

  /* ========== UPDATE ========== */

  function updateMouse() {
    mouse.last.copy(mouse.current);
    mouse.current.lerp(mouse.target, 0.7);

    const d = new THREE.Vector2(
      mouse.current.x - mouse.last.x,
      mouse.current.y - mouse.last.y
    ).multiplyScalar(80);

    mouse.velocity.lerp(d, 0.6).multiplyScalar(settings.velocityDamping);
    mouse.smooth.lerp(mouse.velocity, 0.3);
  }

  function render() {
    updateMouse();

    flowmapMat.uniforms.uVelocity.value.copy(mouse.smooth).multiplyScalar(settings.velocityScale);
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

  /* ========== LOAD IMAGE ========== */

  new THREE.TextureLoader().load(image.currentSrc || image.src, tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    setup(tex);
  });
}

/* ========== INIT ========== */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-webgl-container]").forEach(container => {
    const img = container.querySelector("[data-distorted-image]");
    if (img) createWebGLDistortion(container, img);
  });
});
