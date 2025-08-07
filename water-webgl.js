 import * as THREE from "three";

      window.addEventListener("load", () => {
        const image = document.querySelector("img[webgl-grid-anime]");
        const wrapper = image.closest(".webgl-wrapper");

        const settings = {
          gridSize: 20.0,
          aberrationStrength: 0.01,
          distortionAmount: 0.2,
          easeFactor: 0.02,
        };

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(image.src, (texture) => {
          const imgRatio = image.naturalWidth / image.naturalHeight;
          const scene = new THREE.Scene();

          const scale = 1;
          const camera = new THREE.OrthographicCamera(
            -imgRatio * scale,
            imgRatio * scale,
            scale,
            -scale,
            0.1,
            10
          );
          camera.position.z = 1;

          const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
          });
          renderer.setPixelRatio(window.devicePixelRatio);
          wrapper.appendChild(renderer.domElement);

          const uniforms = {
            u_texture: { value: texture },
            u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
            u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
            u_aberrationIntensity: { value: 0 },
            u_time: { value: 0 },
            u_gridSize: { value: settings.gridSize },
            u_aberrationStrength: { value: settings.aberrationStrength },
            u_distortionAmount: { value: settings.distortionAmount },
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

          void main() {
            vec2 gridUV = floor(vUv * vec2(u_gridSize)) / vec2(u_gridSize);
            vec2 centerOfPixel = gridUV + vec2(1.0 / u_gridSize, 1.0 / u_gridSize);

            vec2 mouseDirection = u_mouse - u_prevMouse;
            vec2 pixelToMouseDirection = centerOfPixel - u_mouse;
            float pixelDistanceToMouse = length(pixelToMouseDirection);
            float strength = smoothstep(0.3, 0.0, pixelDistanceToMouse);

            vec2 uvOffset = strength * -mouseDirection * u_distortionAmount;
            vec2 uv = vUv - uvOffset;

            vec4 colorR = texture2D(u_texture, uv + vec2(strength * u_aberrationIntensity * u_aberrationStrength, 0.0));
            vec4 colorG = texture2D(u_texture, uv);
            vec4 colorB = texture2D(u_texture, uv - vec2(strength * u_aberrationIntensity * u_aberrationStrength, 0.0));

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
          scene.add(mesh);

          let easeFactor = settings.easeFactor;
          let mouse = { x: 0.5, y: 0.5 };
          let target = { x: 0.5, y: 0.5 };
          let prev = { x: 0.5, y: 0.5 };
          let intensity = 0;

          function resize() {
            const width = wrapper.offsetWidth;
            const height = width / imgRatio;
            renderer.setSize(width, height);
            renderer.domElement.style.width = `${width}px`;
            renderer.domElement.style.height = `${height}px`;
          }

          resize();
          window.addEventListener("resize", resize);

          function animate() {
            requestAnimationFrame(animate);
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

          wrapper.addEventListener("mousemove", (e) => {
            const rect = wrapper.getBoundingClientRect();
            prev = { ...target };
            target.x = (e.clientX - rect.left) / rect.width;
            target.y = (e.clientY - rect.top) / rect.height;
            intensity = 1;
          });

          wrapper.addEventListener("mouseenter", (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            target.x = mouse.x = x;
            target.y = mouse.y = y;
          });

          wrapper.addEventListener("mouseleave", () => {
            easeFactor = 0.05;
            target = { ...prev };
          });

          // Hide original image
          image.style.visibility = "hidden";
        });
      });
