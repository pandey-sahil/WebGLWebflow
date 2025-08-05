import * as THREE from 'three';

window.addEventListener('load', () => {
  const sections = document.querySelectorAll('[webgl-anime="water"]');

  sections.forEach((section) => {
    // Create canvas and append to body
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = 0;
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(-10, -10) },
      u_strength: { value: 0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_strength;
      uniform vec2 u_resolution;

      void main() {
        vec2 rippleUV = vUv - u_mouse;
        float dist = length(rippleUV);
        float ripple = u_strength * 0.03 * sin(40.0 * dist - u_time * 6.0) / (dist + 0.01);
        ripple *= smoothstep(0.2, 0.0, dist); // fade outer ring

        vec3 color = vec3(0.0, 0.4, 0.9) + ripple;
        gl_FragColor = vec4(color, ripple);
      }
    `;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', resize);

    let rippleDecay = 0;

    section.addEventListener('mousemove', (e) => {
      const rect = section.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        uniforms.u_mouse.value.set(x, 1 - y);
        rippleDecay = 1.0;
      }
    });

    section.addEventListener('mouseenter', () => {
      rippleDecay = 1.0;
    });

    section.addEventListener('mouseleave', () => {
      rippleDecay = 0;
      uniforms.u_mouse.value.set(-10, -10); // hide effect
    });

    function animate() {
      requestAnimationFrame(animate);
      uniforms.u_time.value += 0.05;
      uniforms.u_strength.value = rippleDecay;
      rippleDecay *= 0.95; // fade ripple

      // Only render when in viewport
      const rect = section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        renderer.render(scene, camera);
      }
    }

    animate();
  });
});
