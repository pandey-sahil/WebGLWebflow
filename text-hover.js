import * as THREE from 'three';

function initWebGLDistortion() {
  const container = document.querySelector("[data-webgl-container]");
  const canvas = container?.querySelector("[webgl-distorted-canvas]");
  const image = document.querySelector("[data-distorted-image]");
  if (!container || !canvas || !image) return;

  // ==== SETTINGS ====
  const settings = {
    falloff: 0.12, alpha: 0.97, dissipation: 0.965,
    distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
    chromaticAberration: 0.002, chromaticSpread: 0.6,
    velocityScale: 0.6, velocityDamping: 0.85,
    mouseRadius: 0.1, motionBlurStrength: 0.35,
    motionBlurDecay: 0.88, motionBlurThreshold: 0.5
  };

  // ==== SHADERS ====


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

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

  // ==== CORE ====
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:false });
  renderer.setClearColor(0,0);

  const mouse = {
    current:new THREE.Vector2(-1,-1),
    target:new THREE.Vector2(-1,-1),
    velocity:new THREE.Vector2(),
    last:new THREE.Vector2(-1,-1),
    smooth:new THREE.Vector2()
  };

  let flowmapA, flowmapB, displayA, displayB, mesh, isFirstFrame=true;
  let flowmapMat, distortionMat;

  // ==== HELPERS ====
  function createRT(w,h){
    const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    return new THREE.WebGLRenderTarget(w,h,{
      minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter,
      format:THREE.RGBAFormat, type
    });
  }

  function setup(imageTex){
    // Materials
    flowmapMat = new THREE.ShaderMaterial({
      vertexShader, fragmentShader:flowmapFragment,
      uniforms:{
        uMouse:{value:mouse.current}, uVelocity:{value:mouse.velocity},
        uResolution:{value:new THREE.Vector2()},
        uFalloff:{value:settings.falloff}, uAlpha:{value:settings.alpha},
        uDissipation:{value:settings.dissipation}, uAspect:{value:1},
        uTexture:{value:null}, uTime:{value:0}
      }
    });
    distortionMat = new THREE.ShaderMaterial({
      vertexShader, fragmentShader:distortionFragment, transparent:true,
      uniforms:{
        uLogo:{value:imageTex}, uFlowmap:{value:null}, uPreviousFrame:{value:null},
        uImageScale:{value:new THREE.Vector2(1,1)}, uImageOffset:{value:new THREE.Vector2(0,0)},
        uDistortionStrength:{value:settings.distortionStrength},
        uChromaticAberration:{value:settings.chromaticAberration},
        uChromaticSpread:{value:settings.chromaticSpread},
        uResolution:{value:new THREE.Vector2()},
        uMotionBlurStrength:{value:settings.motionBlurStrength},
        uMotionBlurDecay:{value:settings.motionBlurDecay},
        uMotionBlurThreshold:{value:settings.motionBlurThreshold},
        uIsFirstFrame:{value:true}, uTime:{value:0}
      }
    });

    // Targets
    flowmapA = createRT(128,128); flowmapB = createRT(128,128);
    const w=Math.min(container.clientWidth,512), h=Math.min(container.clientHeight,512);
    displayA=createRT(w,h); displayB=createRT(w,h);

    // Mesh
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), flowmapMat);

    // Events
    container.addEventListener("mousemove",e=>{
      const r=container.getBoundingClientRect();
      mouse.target.set((e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height);
    });
    container.addEventListener("mouseenter",e=>{
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
    flowmapMat.uniforms.uResolution.value.set(w,h);
    flowmapMat.uniforms.uAspect.value = w/h;
    distortionMat.uniforms.uResolution.value.set(w,h);
  }

  function updateMouse(){
    mouse.last.copy(mouse.current);
    mouse.current.lerp(mouse.target,0.7);
    const d=new THREE.Vector2(mouse.current.x-mouse.last.x,mouse.current.y-mouse.last.y).multiplyScalar(80);
    mouse.velocity.lerp(d,0.6).multiplyScalar(settings.velocityDamping);
    mouse.smooth.lerp(mouse.velocity,0.3);
  }

  function render(){
    updateMouse();
    const t=performance.now()*0.001;
    flowmapMat.uniforms.uTime.value=t;
    distortionMat.uniforms.uTime.value=t;
    flowmapMat.uniforms.uMouse.value.copy(mouse.current);
    flowmapMat.uniforms.uVelocity.value.copy(mouse.smooth).multiplyScalar(settings.velocityScale);

    mesh.material=flowmapMat; flowmapMat.uniforms.uTexture.value=flowmapB.texture;
    renderer.setRenderTarget(flowmapA); renderer.render(mesh,camera);

    mesh.material=distortionMat;
    distortionMat.uniforms.uFlowmap.value=flowmapA.texture;
    distortionMat.uniforms.uPreviousFrame.value=displayB.texture;
    distortionMat.uniforms.uIsFirstFrame.value=isFirstFrame;
    renderer.setRenderTarget(displayA); renderer.render(mesh,camera);

    renderer.setRenderTarget(null); renderer.render(mesh,camera);

    [flowmapA,flowmapB]=[flowmapB,flowmapA];
    [displayA,displayB]=[displayB,displayA];
    isFirstFrame=false;
  }

  function animate(){ render(); requestAnimationFrame(animate); }

  // ==== LOAD IMAGE ====
  new THREE.TextureLoader().load(image.src, tex=>{
    tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter;
    tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
    setup(tex);
  });
}

document.addEventListener("DOMContentLoaded",initWebGLDistortion);
