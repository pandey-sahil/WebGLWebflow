import * as THREE from 'three';

function initWebGLDistortion() {
    const container = document.querySelector("[data-webgl-container]");
    const canvas = container?.querySelector(".g_canvas_distortion");
    const image = document.querySelector("[distorted-image]");

    if (!container || !canvas || !image) {
        console.error("Required elements not found");
        return;
    }

    const settings = {
        falloff: 0.18,
        alpha: 0.97,
        dissipation: 0.965,
        distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
        chromaticAberration: 0.004,
        chromaticSpread: 1,
        velocityScale: 0.6,
        velocityDamping: 0.85,
        mouseRadius: 0.18,
        motionBlurStrength: 0.35,
        motionBlurDecay: 0.88,
        motionBlurThreshold: 0.5,
        maxFlow: 0.25,         // clamp flow stored in texture
        maxMouseDelta: 0.035   // clamp raw mouse delta in normalized uv space
    };

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
        uniform float uMaxFlow;

        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            vec4 color = texture2D(uTexture, uv);
            color.rgb *= uDissipation;

            // Add small roaming waves
            float waveX = sin(uv.y * 10.0 + uTime * 2.0) * 0.004;
            float waveY = cos(uv.x * 10.0 + uTime * 1.5) * 0.004;
            vec2 uvForInfluence = uv + vec2(waveX, waveY);

            vec2 cursor = uMouse;
            vec2 aspectUv = uvForInfluence;
            aspectUv.x *= uAspect;
            cursor.x *= uAspect;

            float dist = distance(aspectUv, cursor);
            float influence = 1.0 - smoothstep(0.0, uFalloff, dist);

            vec2 velocityContribution = vec2(uVelocity.x, -uVelocity.y) * influence * uAlpha;
            color.rg += velocityContribution;

            // clamp stored flow to avoid extreme values that cause flicker
            color.rg = clamp(color.rg, -uMaxFlow, uMaxFlow);

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
        uniform float uMaxFlow;

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

            // idle waves before sampling flowmap
            uv.x += sin(uv.y * 8.0 + uTime * 1.5) * 0.008;
            uv.y += cos(uv.x * 8.0 + uTime * 1.2) * 0.008;

            vec3 flow = texture2D(uFlowmap, uv).rgb;
            float flowMagnitude = length(flow.rg);

            // clamp flow before applying distortion so we never jump too far
            vec2 safeFlow = clamp(flow.rg, -uMaxFlow, uMaxFlow);

            vec2 distortedUv = uv + safeFlow * uDistortionStrength;

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

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: false
    });
    renderer.setClearColor(0, 0);

    const mouse = {
        current: new THREE.Vector2(-1, -1),
        target: new THREE.Vector2(-1, -1),
        velocity: new THREE.Vector2(0, 0),
        lastPosition: new THREE.Vector2(-1, -1),
        smoothVelocity: new THREE.Vector2(0, 0)
    };

    let flowmapA, flowmapB, displayA, displayB;
    let logoTexture, flowmapMaterial, distortionMaterial, flowmapMesh;
    let isInitialized = false;
    let isFirstFrame = true;

    function loadTexture() {
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = 'anonymous';
        loader.load(image.src, onTextureLoaded, undefined, onTextureError);
    }

    function onTextureLoaded(texture) {
        logoTexture = texture;
        logoTexture.minFilter = THREE.LinearFilter;
        logoTexture.magFilter = THREE.LinearFilter;
        logoTexture.wrapS = THREE.ClampToEdgeWrapping;
        logoTexture.wrapT = THREE.ClampToEdgeWrapping;

        createMaterials();
        createRenderTargets();
        createMesh();
        setupEventListeners();
        onResize();
        isInitialized = true;
        animate();
    }

    function onTextureError(err) {
        console.error("Failed to load texture", err);
    }

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
                uMaxFlow: { value: settings.maxFlow }
            }
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
                uMaxFlow: { value: settings.maxFlow }
            },
            transparent: true
        });
    }

    function createRenderTargets() {
        const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: type
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
        flowmapMesh = new THREE.Mesh(geometry, flowmapMaterial);
        scene.add(flowmapMesh);
    }

    function setupEventListeners() {
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseenter', onMouseEnter);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('resize', onResize);
    }

    function getMousePosition(clientX, clientY) {
        const rect = container.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width,
            y: 1 - (clientY - rect.top) / rect.height
        };
    }

    function onMouseMove(event) {
        const pos = getMousePosition(event.clientX, event.clientY);
        updateMouseTarget(pos.x, pos.y);
    }

    function onMouseEnter(event) {
        const pos = getMousePosition(event.clientX, event.clientY);
        mouse.current.set(pos.x, pos.y);
        mouse.target.set(pos.x, pos.y);
        mouse.lastPosition.set(pos.x, pos.y);
    }

    function onMouseLeave() {
        mouse.target.set(-1, -1);
    }

    function onTouchStart(event) {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const pos = getMousePosition(touch.clientX, touch.clientY);
            mouse.current.set(pos.x, pos.y);
            mouse.target.set(pos.x, pos.y);
            mouse.lastPosition.set(pos.x, pos.y);
        }
    }

    function onTouchMove(event) {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const pos = getMousePosition(touch.clientX, touch.clientY);
            updateMouseTarget(pos.x, pos.y);
        }
    }

    function onTouchEnd() {
        mouse.target.set(-1, -1);
    }

    function updateMouseTarget(x, y) {
        mouse.target.set(x, y);
    }

    function updateMouse() {
        mouse.lastPosition.copy(mouse.current);
        mouse.current.lerp(mouse.target, 0.7);

        // raw delta in normalized uv space
        const delta = new THREE.Vector2(
            mouse.current.x - mouse.lastPosition.x,
            mouse.current.y - mouse.lastPosition.y
        );

        // clamp sudden large jumps in normalized space
        const maxD = settings.maxMouseDelta;
        if (delta.length() > maxD) delta.setLength(maxD);

        // scale to get velocity feel, lower scalar than before to reduce spikes
        delta.multiplyScalar(120);

        // smooth velocity
        mouse.velocity.lerp(delta, 0.6);
        mouse.smoothVelocity.lerp(mouse.velocity, 0.3);

        // damping
        mouse.velocity.multiplyScalar(settings.velocityDamping);
    }

    function onResize() {
        const { clientWidth, clientHeight } = container;
        renderer.setSize(clientWidth, clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const aspect = clientWidth / clientHeight;
        if (flowmapMaterial && flowmapMaterial.uniforms) {
            flowmapMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
            flowmapMaterial.uniforms.uAspect.value = aspect;
        }
        if (distortionMaterial && distortionMaterial.uniforms && distortionMaterial.uniforms.uResolution) {
            distortionMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
        }

        if (displayA && displayB) {
            const displayWidth = Math.min(clientWidth, 512);
            const displayHeight = Math.min(clientHeight, 512);
            displayA.setSize(displayWidth, displayHeight);
            displayB.setSize(displayWidth, displayHeight);
        }
    }

    function render() {
        if (!isInitialized) return;
        updateMouse();

        const time = performance.now() * 0.001;
        flowmapMaterial.uniforms.uTime.value = time;
        distortionMaterial.uniforms.uTime.value = time;

        flowmapMaterial.uniforms.uMouse.value.copy(mouse.current);
        flowmapMaterial.uniforms.uVelocity.value.copy(mouse.smoothVelocity);
        flowmapMaterial.uniforms.uVelocity.value.multiplyScalar(settings.velocityScale);

        // Render flowmap pass
        flowmapMesh.material = flowmapMaterial;
        flowmapMaterial.uniforms.uTexture.value = flowmapB.texture;
        renderer.setRenderTarget(flowmapA);
        renderer.clear(); // prevent buildup spikes
        renderer.render(scene, camera);

        // Render distortion pass into displayA
        flowmapMesh.material = distortionMaterial;
        distortionMaterial.uniforms.uFlowmap.value = flowmapA.texture;
        distortionMaterial.uniforms.uPreviousFrame.value = displayB.texture;
        distortionMaterial.uniforms.uIsFirstFrame.value = isFirstFrame;
        renderer.setRenderTarget(displayA);
        renderer.clear();
        renderer.render(scene, camera);

        // Render final to screen using the same mesh
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);

        // swap targets
        [flowmapA, flowmapB] = [flowmapB, flowmapA];
        [displayA, displayB] = [displayB, displayA];
        isFirstFrame = false;
    }

    function animate() {
        render();
        requestAnimationFrame(animate);
    }

    // public controls to tune if you need them
    window.updateDistortionSettings = function(newSettings) {
        Object.assign(settings, newSettings);
        if (flowmapMaterial && flowmapMaterial.uniforms) {
            flowmapMaterial.uniforms.uFalloff.value = settings.falloff;
            flowmapMaterial.uniforms.uAlpha.value = settings.alpha;
            flowmapMaterial.uniforms.uDissipation.value = settings.dissipation;
            flowmapMaterial.uniforms.uMaxFlow.value = settings.maxFlow;
        }
        if (distortionMaterial && distortionMaterial.uniforms) {
            distortionMaterial.uniforms.uDistortionStrength.value = settings.distortionStrength;
            distortionMaterial.uniforms.uChromaticAberration.value = settings.chromaticAberration;
            distortionMaterial.uniforms.uChromaticSpread.value = settings.chromaticSpread;
            distortionMaterial.uniforms.uMotionBlurStrength.value = settings.motionBlurStrength;
            distortionMaterial.uniforms.uMotionBlurDecay.value = settings.motionBlurDecay;
            distortionMaterial.uniforms.uMotionBlurThreshold.value = settings.motionBlurThreshold;
            distortionMaterial.uniforms.uMaxFlow.value = settings.maxFlow;
        }
    };

    loadTexture();
}

document.addEventListener('DOMContentLoaded', () => {
    initWebGLDistortion();
});
