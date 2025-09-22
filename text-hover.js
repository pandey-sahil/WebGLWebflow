import * as THREE from "three";

function initWebGLDistortion(container) {
  const canvas = container.querySelector("[webgl-distorted-canvas]");
  const image = container.querySelector("[data-distorted-image]");
  if (!canvas || !image) return;

  // ==== SETTINGS ====
  const settings = {
    falloff: 0.12,
    alpha: 0.97,
    dissipation: 0.965,
    distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
    chromaticAberration: 0.0035,
    chromaticSpread: 0.85,
    velocityScale: 0.6,
    velocityDamping: 0.85,
    mouseRadius: 0.12,
    motionBlurStrength: 0.45,
    motionBlurDecay: 0.9,
    motionBlurThreshold: 0.5,
  };

  // ==== SHADERS ====
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

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float noise(vec2 uv){
      vec2 i = floor(uv*256.0);
      vec2 f = fract(uv*256.0);
      float a = rand(i);
      float b = rand(i + vec2(1.0,0.0));
      float c = rand(i + vec2(0.0,1.0));
      float d = rand(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }

    vec2 canvasToImageUV(vec2 uv) {
      vec2 centeredUv = (uv - 0.5);
      centeredUv /= uImageScale;
      centeredUv += uImageOffset;
      return centeredUv + 0.5;
    }

    vec4 sampleLogoExtended(vec2 uv) {
      vec2 imageUv = canvasToImageUV(uv);
      if (imageUv.x < 0.0 || imageUv.x > 1.0 || imageUv.y < 0.0 || imageUv.y > 1.0) return vec4(0.0);
      return texture2D(uLogo, imageUv);
    }

    bool isWithinImageBounds(vec2 uv) {
      vec2 imageUv = canvasToImageUV(uv);
      return imageUv.x >= 0.0 && imageUv.x <= 1.0 && imageUv.y >= 0.0 && imageUv.y <= 1.0;
    }

    void main() {
      vec2 uv = vUv;

      vec3 flow = texture2D(uFlowmap, uv).rgb;
      float flowMagnitude = length(flow.rg);

      vec2 distortedUv = uv + flow.rg * uDistortionStrength;

      float aberrAmount = flowMagnitude * uChromaticAberration * 2.0;
      vec2 flowDirection = length(flow.rg) > 0.0 ? normalize(flow.rg) : vec2(0.0);
      vec2 redOffset = flowDirection * aberrAmount * uChromaticSpread;
      vec2 greenOffset = vec2(-flowDirection.y, flowDirection.x) * aberrAmount * uChromaticSpread * 0.9;
      vec2 blueOffset = -flowDirection * aberrAmount * uChromaticSpread * 1.1;

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
      if (alpha < 0.01) { gl_FragColor = vec4(0.0); return; }

      vec3 color = vec3(r, g, b);

      // Flow-dependent glow (damped for neutral look)
      vec3 glowColor = color * (1.0 + pow(flowMagnitude, 2.2) * 0.15);
      color = mix(color, glowColor, smoothstep(0.05, 0.3, flowMagnitude) * 0.5);

      // Color correction
      float totalBrightness = r + g + b;
      if (totalBrightness < 0.05 && isWithinImageBounds(distortedUv)) color = centerSample.rgb;

      // Motion blur
      vec4 currentColor = vec4(color, alpha);
      if (!uIsFirstFrame) {
        vec4 previousColor = texture2D(uPreviousFrame, uv);
        float motionAmount = smoothstep(uMotionBlurThreshold, uMotionBlurThreshold + 0.05, flowMagnitude);
        float blurStrength = motionAmount * uMotionBlurStrength;
        vec3 blendedColor = mix(currentColor.rgb, previousColor.rgb, blurStrength * uMotionBlurDecay);
        float blendedAlpha = max(currentColor.a, previousColor.a * uMotionBlurDecay);
        currentColor = vec4(blendedColor, blendedAlpha);
      }

      // Vignette
      float vignette = smoothstep(0.8, 0.5, length(vUv-0.5));
      currentColor.rgb *= mix(1.0, 0.85, vignette * (1.0-flowMagnitude));

      // Procedural noise
      float n = (noise(uv*10.0 + uTime*0.1)-0.5)*0.02;
      currentColor.rgb += n;

      gl_FragColor = currentColor;
    }
  `;

  // ==== CORE ====
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;

  const mouse = { current: new THREE.Vector2(-1,-1), target: new THREE.Vector2(-1,-1), velocity: new THREE.Vector2(), last: new THREE.Vector2(-1,-1), smooth: new THREE.Vector2() };
  let flowmapA, flowmapB, displayA, displayB, mesh, isFirstFrame = true;
  let flowmapMat, distortionMat, finalMat;

  function createRT(w, h){
    const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    return new THREE.WebGLRenderTarget(w,h,{ minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat, type });
  }

  function setup(imageTex){
    flowmapMat = new THREE.ShaderMaterial({ vertexShader, fragmentShader: flowmapFragment, uniforms: {
      uMouse:{value:mouse.current}, uVelocity:{value:mouse.velocity}, uResolution:{value:new THREE.Vector2()}, uFalloff:{value:settings.falloff},
      uAlpha:{value:settings.alpha}, uDissipation:{value:settings.dissipation}, uAspect:{value:1}, uTexture:{value:null}, uTime:{value:0}
    }});
    distortionMat = new THREE.ShaderMaterial({ vertexShader, fragmentShader: distortionFragment, transparent:true, depthTest:false, depthWrite:false, uniforms: {
      uLogo:{value:imageTex}, uFlowmap:{value:null}, uPreviousFrame:{value:null},
      uImageScale:{value:new THREE.Vector2(1,1)}, uImageOffset:{value:new THREE.Vector2(0,0)},
      uDistortionStrength:{value:settings.distortionStrength}, uChromaticAberration:{value:settings.chromaticAberration},
      uChromaticSpread:{value:settings.chromaticSpread}, uResolution:{value:new THREE.Vector2()},
      uMotionBlurStrength:{value:settings.motionBlurStrength}, uMotionBlurDecay:{value:settings.motionBlurDecay},
      uMotionBlurThreshold:{value:settings.motionBlurThreshold}, uIsFirstFrame:{value:true}, uTime:{value:0}
    }});
    finalMat = new THREE.MeshBasicMaterial({ map:null });

    const w=Math.min(container.clientWidth,512), h=Math.min(container.clientHeight,512);
    flowmapA=createRT(256,256); flowmapB=createRT(256,256);
    displayA=createRT(w,h); displayB=createRT(w,h);

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), flowmapMat);

    container.addEventListener("mousemove", e=>{
      const r=container.getBoundingClientRect();
      mouse.target.set((e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height);
    });
    container.addEventListener("mouseenter", e=>{
      const r=container.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width, y=1-(e.clientY-r.top)/r.height;
      mouse.current.set(x,y); mouse.target.set(x,y); mouse.last.set(x,y);
    });
    container.addEventListener("mouseleave",()=>mouse.target.set(-1,-1));
    window.addEventListener("resize",onResize);

    onResize(); animate();
  }

  function onResize(){
    const {clientWidth:w, clientHeight:h} = container;
    renderer.setSize(w,h); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    flowmapMat.uniforms.uResolution.value.set(w,h); flowmapMat.uniforms.uAspect.value=w/h;
    distortionMat.uniforms.uResolution.value.set(w,h);
    displayA=createRT(w,h); displayB=createRT(w,h);
  }

  function updateMouse(){
    mouse.last.copy(mouse.current);
    mouse.current.lerp(mouse.target,0.7);
    const d=new THREE.Vector2(mouse.current.x-mouse.last.x, mouse.current.y-mouse.last.y).multiplyScalar(80);
    mouse.velocity.lerp(d,0.6).multiplyScalar(settings.velocityDamping);
    mouse.smooth.lerp(mouse.velocity,0.3);
  }

  function render(){
    updateMouse();
    const t=performance.now()*0.001;
    flowmapMat.uniforms.uTime.value=t; distortionMat.uniforms.uTime.value=t;
    flowmapMat.uniforms.uMouse.value.copy(mouse.current);
    flowmapMat.uniforms.uVelocity.value.copy(mouse.smooth).multiplyScalar(settings.velocityScale);

    mesh.material=flowmapMat; flowmapMat.uniforms.uTexture.value=flowmapB.texture;
    renderer.setRenderTarget(flowmapA); renderer.render(mesh,camera);

    mesh.material=distortionMat;
    distortionMat.uniforms.uFlowmap.value=flowmapA.texture;
    distortionMat.uniforms.uPreviousFrame.value=displayB.texture;
    distortionMat.uniforms.uIsFirstFrame.value=isFirstFrame;
    renderer.setRenderTarget(displayA); renderer.render(mesh,camera);

    // Option A: clean final blit
    mesh.material=finalMat; finalMat.map=displayA.texture;
    renderer.setRenderTarget(null); renderer.render(mesh,camera);

    [flowmapA,flowmapB]=[flowmapB,flowmapA];
    [displayA,displayB]=[displayB,displayA];
    isFirstFrame=false;
  }

  function animate(){ render(); requestAnimationFrame(animate); }

  new THREE.TextureLoader().load(image.src, tex=>{
    tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
    setup(tex);
  });
}

// ==== INIT ALL CONTAINERS ====
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll("[data-webgl-container]").forEach(container=>{
    initWebGLDistortion(container);
  });
});
